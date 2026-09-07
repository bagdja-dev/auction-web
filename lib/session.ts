/**
 * Cookie-based session untuk renderer publik (buyer/seller) — multi-tenant
 * subdomain wildcard (`{market_slug}.market.bagdja.com`), BUKAN single-host
 * seperti admin console.
 *
 * OAuth `redirect_uri` wajib satu host tetap (teregistrasi, proteksi
 * open-redirect) — callback SELALU jalan di host itu, BUKAN di subdomain
 * tenant asal. Tanpa `Domain=.market.bagdja.com` di cookie, cookie itu
 * ke-scope host-only ke host callback saja dan tidak pernah sampai ke
 * subdomain tenant setelah redirect balik (lihat `app/auth/callback/route.ts`
 * yang membaca `decoded.origin` dari `oauth-state-store.ts`).
 *
 * Pola & fix persis di-port dari `bagdja-website/lib/session.ts` (BUG
 * production 25 Agustus 2026 di sana: `Domain` attribute harus domain-match
 * host yang BENAR-BENAR melayani response — RFC 6265 — kalau tidak, browser
 * DIAM-DIAM membuang seluruh `Set-Cookie` itu). `getCookieOptions()` karena
 * itu WAJIB terima `targetHostname` eksplisit (dari origin login asli),
 * BUKAN diasumsikan dari `NEXT_PUBLIC_PLATFORM_URL` — dan di-skip total kalau
 * hostname itu local (`LOCAL_HOSTS`, sama seperti middleware.ts) supaya
 * perilaku dev lokal tidak bergantung isi env production.
 *
 * Write (`setSessionCookies`/`clearSessionCookies`) nempel langsung ke object
 * `NextResponse` yang benar-benar di-return Route Handler (BUKAN lewat
 * `cookies()` ambient) — mutasi cookie ambient yang di-attach ke response
 * yang dikonstruksi belakangan terbukti tidak konsisten ke-merge di
 * production di belakang reverse proxy (temuan yang sama di `bagdja-website`).
 * Read (`getSession`) tetap lewat `cookies()` ambient — satu-satunya cara
 * baca cookie di Server Component (read-only, tidak ada response untuk
 * di-attach).
 */
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const TOKEN_COOKIE = 'am_buyer_token';
const USER_COOKIE = 'am_buyer_user';

/** Sama seperti middleware.ts — host dev lokal, tidak pernah domain-match subdomain wildcard produksi. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * BUG (2026-09-07): fungsi ini SEBELUMNYA selalu balas `.{platformHostname}`
 * apa pun `targetHostname`-nya — parameter itu cuma dipakai buat cek
 * `LOCAL_HOSTS`, tidak pernah benar-benar menentukan domain cookie. Untuk
 * tenant subdomain platform (`moly.lelang.bagdja.com`) ini kebetulan tidak
 * kelihatan salah (memang seharusnya `.lelang.bagdja.com`), TAPI untuk
 * domain custom Owner (`pasarmolly.com`, sama sekali BUKAN subdomain
 * platform) hasilnya SELALU Domain attribute yang tidak match host asli —
 * RFC 6265 mewajibkan Domain match host yang benar-benar melayani respons,
 * jadi browser DIAM-DIAM membuang seluruh `Set-Cookie` (bukan error yang
 * kelihatan). Efeknya: user "berhasil" login (state/token exchange sukses),
 * tapi mendarat di `pasarmolly.com` tanpa cookie sesi sama sekali → app
 * anggap belum login → auto-redirect ke `/auth/login` lagi → berulang.
 *
 * Sekarang `targetHostname` benar-benar dipakai: wildcard cookie
 * (`.{platformHostname}`) HANYA kalau target memang subdomain (atau sama
 * persis) platform kita sendiri; domain custom dapat cookie host-only
 * (`undefined` — otomatis ter-scope ke domain itu sendiri, tidak perlu
 * attribute `Domain` apa pun).
 */
/**
 * `true` kalau `targetHostname` adalah subdomain (atau sama persis)
 * platform kita sendiri (`NEXT_PUBLIC_PLATFORM_URL`) — dipakai `session.ts`
 * (tentukan cookie wildcard vs host-only) DAN `app/auth/callback/route.ts`
 * (tentukan perlu hop `/auth/session` handoff atau tidak), harus konsisten
 * di kedua tempat jadi diekspor dari sini, satu sumber kebenaran.
 */
export function isPlatformHost(targetHostname: string): boolean {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL;
  if (!platformUrl) return false;

  try {
    const platformHostname = new URL(platformUrl).hostname;
    return targetHostname === platformHostname || targetHostname.endsWith(`.${platformHostname}`);
  } catch {
    return false;
  }
}

function getCookieDomain(targetHostname: string): string | undefined {
  if (LOCAL_HOSTS.has(targetHostname)) return undefined;
  if (!isPlatformHost(targetHostname)) return undefined;

  // isPlatformHost() sudah pastikan NEXT_PUBLIC_PLATFORM_URL valid & match —
  // aman parse ulang di sini buat ambil hostname-nya.
  const platformHostname = new URL(process.env.NEXT_PUBLIC_PLATFORM_URL!).hostname;
  return `.${platformHostname}`;
}

/** `targetHostname` = host yang benar-benar akan menerima response ini — WAJIB diisi benar, jangan diasumsikan dari env. */
function getCookieOptions(targetHostname: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    domain: getCookieDomain(targetHostname),
  };
}

export interface SessionUser {
  userId: string;
  email?: string;
  username?: string;
}

/**
 * Attach cookie sesi ke response yang akan di-return Route Handler.
 * `targetOrigin` = origin (scheme+host) yang BENAR-BENAR akan menerima
 * response ini — di callback route ini `decoded.origin` (origin login asli,
 * lihat catatan di atas), BUKAN `request.url` (yang selalu host `redirect_uri`
 * OAuth tetap).
 */
export function setSessionCookies(
  response: NextResponse,
  token: string,
  user: SessionUser,
  targetOrigin: string,
): void {
  const hostname = new URL(targetOrigin).hostname;
  const cookieOptions = getCookieOptions(hostname);
  response.cookies.set(TOKEN_COOKIE, token, cookieOptions);
  response.cookies.set(USER_COOKIE, JSON.stringify(user), {
    ...cookieOptions,
    httpOnly: false, // client component (hooks/use-auth.ts) perlu baca info user
  });
}

/** Hapus cookie sesi dari response yang akan di-return Route Handler. `targetOrigin` — lihat catatan `setSessionCookies`. */
export function clearSessionCookies(response: NextResponse, targetOrigin: string): void {
  const hostname = new URL(targetOrigin).hostname;
  const cookieOptions = getCookieOptions(hostname);
  // Delete via .set(..., maxAge: 0) dengan domain/path yang SAMA persis
  // dengan saat di-set — .delete(name) tanpa domain tidak akan match cookie
  // yang di-set dengan Domain attribute (browser treat sebagai cookie beda).
  response.cookies.set(TOKEN_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set(USER_COOKIE, '', { ...cookieOptions, httpOnly: false, maxAge: 0 });
}

export async function getSession(): Promise<{
  token: string | null;
  user: SessionUser | null;
}> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value ?? null;
  const userStr = jar.get(USER_COOKIE)?.value ?? null;

  let user: SessionUser | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }

  return { token, user };
}
