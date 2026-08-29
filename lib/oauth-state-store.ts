/**
 * Penyimpanan `code_verifier` + `next` path sisi server (Upstash Redis),
 * dikunci oleh ID pendek acak yang dikirim sebagai `state` OAuth.
 *
 * Pola PERSIS di-port dari `bagdja-auction-admin/src/lib/oauth-state-store.ts`
 * (yang sendiri porting dari `bagdja-website-admin`/`bagdja-pos/admin`) — lihat
 * file itu untuk alasan desain lengkap (kenapa bukan cookie, kenapa bukan
 * `state` terenkripsi).
 */
import crypto from 'crypto';
import { Redis } from '@upstash/redis';

const STATE_KEY_PREFIX = 'oauth_state:';
const DEFAULT_TTL_SECONDS = 600;

export interface OAuthStatePayload {
  codeVerifier: string;
  next: string | null;
}

let cachedClient: Redis | null | undefined;

/**
 * Terima dua konvensi nama env var — `KV_REST_API_URL`/`KV_REST_API_TOKEN`
 * (dipakai Vercel Marketplace waktu connect provider apa pun termasuk
 * Upstash, demi kompatibilitas mundur dengan `@vercel/kv`) atau
 * `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (penamaan asli
 * Upstash kalau di-provision langsung tanpa lewat Marketplace Vercel).
 */
function getRedisClient(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Placeholder "TODO-isi-..." (belum dikonfigurasi) harus dianggap "belum
  // dikonfigurasi", bukan value asli — kalau tidak, client Redis dibuat
  // dengan URL sampah dan langsung throw saat dipakai (bukan fallback).
  const isConfigured = Boolean(url && token && url.startsWith('https://'));

  cachedClient = isConfigured ? new Redis({ url: url!, token: token! }) : null;
  return cachedClient;
}

/**
 * Fallback in-memory — dipakai HANYA kalau Upstash belum dikonfigurasi DAN
 * bukan production (biar kesalahan config di production tetap kelihatan,
 * bukan diam-diam "berhasil" pakai memory lalu putus tiap restart/instance
 * berbeda). Untuk dev lokal ini cukup: satu proses Next.js, state cuma
 * hidup ~10 menit dan sekali pakai — tidak butuh Redis sungguhan.
 */
const memoryStore = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>();

function isMemoryFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function purgeExpiredMemoryEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

/** ID pendek acak (~24 karakter base64url) — dikirim sebagai `state` ke IdP. */
export function generateStateId(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export async function saveOAuthState(
  id: string,
  payload: OAuthStatePayload,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    if (!isMemoryFallbackAllowed()) return false;
    purgeExpiredMemoryEntries();
    memoryStore.set(`${STATE_KEY_PREFIX}${id}`, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  // Kirim object langsung (bukan JSON.stringify manual) — SDK @upstash/redis
  // otomatis JSON-encode saat SET dan JSON-decode saat GET/GETDEL.
  await redis.set(`${STATE_KEY_PREFIX}${id}`, payload, { ex: ttlSeconds });
  return true;
}

/** Sekali pakai — baca lalu langsung hapus (`GETDEL`, atomik) supaya `state` tidak bisa dipakai ulang (replay). */
export async function consumeOAuthState(id: string): Promise<OAuthStatePayload | null> {
  const redis = getRedisClient();
  if (!redis) {
    if (!isMemoryFallbackAllowed()) return null;
    const key = `${STATE_KEY_PREFIX}${id}`;
    const entry = memoryStore.get(key);
    memoryStore.delete(key);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.payload;
  }

  const raw = await redis.getdel<OAuthStatePayload | string>(`${STATE_KEY_PREFIX}${id}`);
  if (!raw) return null;

  try {
    const payload = typeof raw === 'string' ? (JSON.parse(raw) as OAuthStatePayload) : raw;
    if (!payload?.codeVerifier) return null;
    return payload;
  } catch {
    return null;
  }
}
