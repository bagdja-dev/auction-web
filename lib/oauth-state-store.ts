/**
 * Penyimpanan `code_verifier` + `next` path sisi server (Redis biasa via
 * `ioredis`, bukan Upstash — deployment ini di Coolify yang sudah punya
 * Redis self-hosted untuk BullMQ (`bagdja-auction-api`), tidak perlu
 * dependency terpisah ke Upstash cloud), dikunci oleh ID pendek acak yang
 * dikirim sebagai `state` OAuth.
 *
 * Di-port dari `bagdja-website/lib/oauth-state-store.ts` (renderer publik
 * lain di ekosistem yang sudah pakai pola ini di production) — MENGGANTIKAN
 * versi Upstash REST sebelumnya (di-port dari `bagdja-auction-admin`, pola
 * beda-app yang ternyata tidak cocok: permintaan eksplisit user 5 September
 * 2026, reuse Redis self-hosted yang sudah ada, bukan provision Upstash baru).
 *
 * - Bukan cookie murni: Safari tidak konsisten menyimpan Set-Cookie yang
 *   menempel di response redirect → state_mismatch di iOS.
 * - `state` cuma ID pendek (~24 karakter) — tidak di-flag ad-blocker.
 *
 * Fallback priority:
 *   1. Redis — jika `REDIS_URL` dikonfigurasi → pakai ini
 *   2. globalThis memory store — HANYA kalau Redis null DAN `NODE_ENV !== production`
 *      (pakai globalThis supaya tidak hilang saat Next.js hot-reload
 *      module-level state; production TANPA Redis sengaja gagal total,
 *      bukan diam-diam pakai memory yang putus tiap restart/instance beda)
 *   3. Set-Cookie short-lived — cadangan defensif kalau dua di atas gagal
 *      (path `/auth`, di-set sebelum redirect lintas domain ke Auth)
 */
import crypto from 'crypto';
import Redis from 'ioredis';
import { cookies } from 'next/headers';

const STATE_KEY_PREFIX = 'oauth_state:';
const DEFAULT_TTL_SECONDS = 600;
const COOKIE_STATE_PREFIX = 'oauthst_';
/**
 * Grace window setelah state dikonsumsi PERTAMA KALI — bukan langsung
 * dihapus, TTL-nya dipendekkan ke sekian detik ini. Ditambahkan 2026-09-07:
 * request callback yang persis sama (network-level retry dari
 * Cloudflare/Traefik saat origin sempat tidak stabil, mis. lagi restart)
 * bisa menyusul dalam hitungan detik — tanpa grace window ini, retry itu
 * dapat `state_mismatch` walau login PERTAMANYA sudah sukses (cookie sesi
 * SUDAH ter-set), membingungkan user (kelihatan gagal padahal sudah
 * login). `code` OAuth dari IdP tetap sekali-pakai independen di endpoint
 * `/oauth/token` mereka, jadi risiko replay asli (penyerang) tidak
 * bertambah signifikan — window ini cuma menutup celah UX untuk retry
 * jaringan yang sah, bukan melemahkan proteksi replay yang sebenarnya.
 */
const CONSUMED_GRACE_SECONDS = 30;

const SESSION_HANDOFF_KEY_PREFIX = 'session_handoff:';
/**
 * TTL pendek SENGAJA — handoff ini cuma dipakai untuk SATU redirect
 * berikutnya (dari `lelang.bagdja.com/auth/callback` ke
 * `{origin-tenant}/auth/session`), harusnya dikonsumsi dalam hitungan
 * detik. Lihat docblock `SessionHandoffPayload` untuk kenapa hop ini ada.
 */
const SESSION_HANDOFF_TTL_SECONDS = 60;

export interface OAuthStatePayload {
  codeVerifier: string;
  next: string | null;
  /**
   * Slug Market hasil resolusi database saat login dimulai. `null` untuk
   * host platform (`*.market.bagdja.com`/localhost), karena host tersebut
   * tidak memakai tabel custom-domain.
   *
   * Callback custom-domain wajib resolve ulang `origin` ke database dan
   * membandingkan slug-nya dengan nilai ini sebelum membuat session
   * handoff. Dengan begitu domain yang dihapus, dipindah ke Market lain,
   * dinonaktifkan, atau kehilangan status verifikasi selama flow OAuth
   * tidak bisa tetap menerima sesi.
   */
  marketSlug: string | null;
  /**
   * Origin (scheme+host) tempat login DIMULAI — mis. `https://barang-antik.market.bagdja.com`.
   * OAuth `redirect_uri` wajib satu host tetap, jadi callback SELALU jalan di
   * host itu, BUKAN di subdomain tenant asal. Tanpa origin ini, callback tidak
   * tahu harus redirect balik ke subdomain mana, dan cookie sesi (kalau
   * di-set dengan `Domain` attribute) harus di-domain-match ke origin yang
   * benar-benar melayani response (lihat `lib/session.ts`).
   */
  origin: string;
}

/**
 * Payload dikirim lewat hop tambahan `/auth/session?handoff=<id>` — HANYA
 * dipakai untuk domain custom (bukan subdomain platform, lihat
 * `session.ts` `getCookieDomain`). Alasan hop ini ada: `/auth/callback`
 * SELALU jalan di host `redirect_uri` OAuth yang tetap (mis.
 * `lelang.bagdja.com`) — server itu SECARA FUNDAMENTAL tidak bisa men-set
 * cookie untuk domain lain yang tidak terkait (`pasarmolly.com`), apa pun
 * `Domain` attribute-nya (proteksi cookie browser, BUKAN bug yang bisa
 * di-workaround dari sisi kita). Solusinya: titipkan payload sesi di sini
 * (server-side, sekali pakai, TTL pendek), redirect balik ke ORIGIN TENANT
 * ASLI (`pasarmolly.com`, lewat Traefik ke app yang sama) — baru DI SANA
 * cookie di-set, karena request itu genuinely dilayani "sebagai"
 * `pasarmolly.com` dari sudut pandang browser.
 */
export interface SessionHandoffPayload {
  accessToken: string;
  user: { userId: string; email?: string; username?: string };
  redirectTo: string;
}

type MemoryEntry<T = OAuthStatePayload> = { payload: T; expiresAt: number };

// globalThis (bukan module-level `let`) — supaya tidak hilang saat Next.js
// hot-reload me-reset module state di dev, dan Symbol.for() unik per app
// kalau suatu saat beberapa Next.js app ke-bundle dalam satu proses.
const GLOBAL_STORE_KEY = Symbol.for('bagdja.auction.renderer.oauthMemoryStore');
const GLOBAL_HANDOFF_STORE_KEY = Symbol.for('bagdja.auction.renderer.sessionHandoffMemoryStore');
const GLOBAL_CLIENT_KEY = Symbol.for('bagdja.auction.renderer.redisClient');

type OAuthGlobal = {
  [GLOBAL_STORE_KEY]?: Map<string, MemoryEntry>;
  [GLOBAL_HANDOFF_STORE_KEY]?: Map<string, MemoryEntry<SessionHandoffPayload>>;
  [GLOBAL_CLIENT_KEY]?: Redis | null;
};

function getOAuthGlobal(): OAuthGlobal {
  const g = globalThis as unknown as OAuthGlobal;
  if (!g[GLOBAL_STORE_KEY]) {
    g[GLOBAL_STORE_KEY] = new Map<string, MemoryEntry>();
  }
  if (!g[GLOBAL_HANDOFF_STORE_KEY]) {
    g[GLOBAL_HANDOFF_STORE_KEY] = new Map<string, MemoryEntry<SessionHandoffPayload>>();
  }
  return g;
}

function getMemoryStore(): Map<string, MemoryEntry> {
  return getOAuthGlobal()[GLOBAL_STORE_KEY]!;
}

function getHandoffMemoryStore(): Map<string, MemoryEntry<SessionHandoffPayload>> {
  return getOAuthGlobal()[GLOBAL_HANDOFF_STORE_KEY]!;
}

function getCachedRedisClient(): Redis | null | undefined {
  return getOAuthGlobal()[GLOBAL_CLIENT_KEY];
}

function setCachedRedisClient(value: Redis | null): void {
  getOAuthGlobal()[GLOBAL_CLIENT_KEY] = value;
}

function getRedisClient(): Redis | null {
  const cached = getCachedRedisClient();
  if (cached !== undefined) return cached;

  const url = process.env.REDIS_URL;
  const isConfigured = Boolean(url && /^rediss?:\/\//.test(url) && !url.includes('change-me'));

  if (!isConfigured) {
    setCachedRedisClient(null);
    return null;
  }

  const client = new Redis(url!, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  });
  // ioredis emits 'error' pada tiap hiccup koneksi — tanpa listener ini Node
  // akan crash (unhandled 'error' event). Reconnect ditangani ioredis
  // sendiri, di sini cuma log supaya tidak silent.
  client.on('error', (err) => {
    console.error(`[oauth-state] redis client error: ${err?.message ?? err}`);
  });

  setCachedRedisClient(client);
  return client;
}

function isMemoryFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function purgeExpiredEntries<T>(store: Map<string, MemoryEntry<T>>): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function purgeExpiredMemoryEntries(): void {
  purgeExpiredEntries(getMemoryStore());
}

/** ID pendek acak (~24 karakter base64url) — dikirim sebagai `state` ke IdP. */
export function generateStateId(): string {
  return crypto.randomBytes(18).toString('base64url');
}

function cookieKeyFor(stateId: string): string {
  return `${COOKIE_STATE_PREFIX}${stateId.slice(0, 8)}`;
}

export async function saveOAuthState(
  stateId: string,
  payload: OAuthStatePayload,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${STATE_KEY_PREFIX}${stateId}`;

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      return true;
    } catch (error: any) {
      console.error(`[oauth-state] save REDIS FAIL stateId=${stateId}: ${error?.message ?? error}`);
    }
  }

  if (!isMemoryFallbackAllowed()) {
    console.error('[oauth-state] save: production mode & no redis → fail');
    return false;
  }

  purgeExpiredMemoryEntries();
  getMemoryStore().set(key, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });

  try {
    const jar = await cookies();
    jar.set(cookieKeyFor(stateId), JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: ttlSeconds,
    });
  } catch {
    // Set-Cookie dari Route Handler bisa gagal di konteks tertentu (mis.
    // sudah lewat batas response) — memory store di atas tetap cukup untuk dev lokal.
  }

  return true;
}

/**
 * GET lalu perpendek TTL ke `CONSUMED_GRACE_SECONDS` (BUKAN langsung DEL) —
 * retry jaringan yang menyusul dalam grace window itu dapat payload yang
 * SAMA (bukan `state_mismatch`), lihat docblock konstantanya.
 */
export async function consumeOAuthState(stateId: string): Promise<OAuthStatePayload | null> {
  const redis = getRedisClient();
  const key = `${STATE_KEY_PREFIX}${stateId}`;

  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        await redis.expire(key, CONSUMED_GRACE_SECONDS);
        const payload = JSON.parse(raw) as OAuthStatePayload;
        if (payload?.codeVerifier) return payload;
      }
    } catch (error: any) {
      console.error(`[oauth-state] consume REDIS FAIL stateId=${stateId}: ${error?.message ?? error}`);
    }
  }

  if (isMemoryFallbackAllowed()) {
    const store = getMemoryStore();
    const entry = store.get(key);
    if (entry) store.set(key, { ...entry, expiresAt: Date.now() + CONSUMED_GRACE_SECONDS * 1000 });
    if (entry && entry.expiresAt > Date.now()) return entry.payload;

    try {
      const jar = await cookies();
      const ck = cookieKeyFor(stateId);
      const rawCookie = jar.get(ck)?.value ?? null;
      if (rawCookie) {
        const parsed = JSON.parse(rawCookie) as OAuthStatePayload;
        jar.delete(ck);
        if (parsed?.codeVerifier) return parsed;
      }
    } catch {
      // Cookie fallback opsional — diam kalau gagal, sudah jelas dari return null di bawah.
    }
  }

  return null;
}

/** Lihat docblock `SessionHandoffPayload` — dipanggil `auth/callback/route.ts` sebelum redirect ke `/auth/session` di origin tenant asli. */
export async function saveSessionHandoff(
  handoffId: string,
  payload: SessionHandoffPayload,
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${SESSION_HANDOFF_KEY_PREFIX}${handoffId}`;

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), 'EX', SESSION_HANDOFF_TTL_SECONDS);
      return true;
    } catch (error: any) {
      console.error(`[session-handoff] save REDIS FAIL handoffId=${handoffId}: ${error?.message ?? error}`);
    }
  }

  if (!isMemoryFallbackAllowed()) {
    console.error('[session-handoff] save: production mode & no redis → fail');
    return false;
  }

  const store = getHandoffMemoryStore();
  purgeExpiredEntries(store);
  store.set(key, { payload, expiresAt: Date.now() + SESSION_HANDOFF_TTL_SECONDS * 1000 });
  return true;
}

/** Sekali pakai — pola sama `consumeOAuthState` (grace window, bukan langsung hapus, lihat `CONSUMED_GRACE_SECONDS`). */
export async function consumeSessionHandoff(handoffId: string): Promise<SessionHandoffPayload | null> {
  const redis = getRedisClient();
  const key = `${SESSION_HANDOFF_KEY_PREFIX}${handoffId}`;

  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        await redis.expire(key, CONSUMED_GRACE_SECONDS);
        const payload = JSON.parse(raw) as SessionHandoffPayload;
        if (payload?.accessToken) return payload;
      }
    } catch (error: any) {
      console.error(`[session-handoff] consume REDIS FAIL handoffId=${handoffId}: ${error?.message ?? error}`);
    }
  }

  if (isMemoryFallbackAllowed()) {
    const store = getHandoffMemoryStore();
    const entry = store.get(key);
    if (entry) store.set(key, { ...entry, expiresAt: Date.now() + CONSUMED_GRACE_SECONDS * 1000 });
    if (entry && entry.expiresAt > Date.now()) return entry.payload;
  }

  return null;
}
