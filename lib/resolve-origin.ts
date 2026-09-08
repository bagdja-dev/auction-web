import type { NextRequest } from 'next/server';

import { getAppUrl } from '@/lib/app-url';

/**
 * Bind address (alamat LISTEN container), bukan alamat yang bisa dituju
 * browser. Kalau salah satu ini yang ke-resolve, artinya kita sedang
 * membaca alamat server SENDIRI, bukan asal request user.
 */
const BIND_ADDRESS_HOSTNAMES = new Set(['0.0.0.0', '::', '[::]', '::0', '[::0]']);

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(hostHeader: string): string {
  // Buang port. IPv6 literal (`[::1]:3000`) ikut ke-handle karena bagian
  // dalam bracket tidak boleh dipecah oleh `:`.
  const withoutPort = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  return withoutPort.toLowerCase();
}

function isUsableHost(hostHeader: string | undefined): hostHeader is string {
  if (!hostHeader) return false;
  return !BIND_ADDRESS_HOSTNAMES.has(hostnameOf(hostHeader));
}

function firstHeaderValue(request: NextRequest, name: string): string | undefined {
  return request.headers.get(name)?.split(',')[0]?.trim() || undefined;
}

/**
 * Origin asal request sebenarnya (scheme+host yang BENAR-BENAR dipakai
 * browser user) — dipakai untuk SEMUA redirect yang kita kirim balik.
 *
 * PENTING — `request.nextUrl.origin`/`request.url` TIDAK BOLEH dipakai di
 * deployment ini, bahkan sebagai fallback terakhir. Itu BUKAN dibangun dari
 * header `Host` (asumsi yang salah, dan itu yang bikin bug ini balik terus),
 * melainkan dari alamat LISTEN server. Buktinya di source Next.js yang
 * dipakai, `next/dist/server/lib/router-utils/resolve-routes.js`:
 *
 *   const initUrl = config.experimental.trustHostHeader
 *     ? `https://${req.headers.host}${req.url}`
 *     : opts.port
 *       ? `${protocol}://${formatHostname(opts.hostname || 'localhost')}:${opts.port}${req.url}`
 *       : req.url;
 *
 * `trustHostHeader` tidak diaktifkan, `opts.hostname` = env `HOSTNAME`
 * (Dockerfile men-set `0.0.0.0`, WAJIB supaya container reachable dari
 * Traefik) dan `opts.port` = 3000. Jadi di produksi `nextUrl.origin` SELALU
 * `https://0.0.0.0:3000` — konstan, tidak peduli domain apa yang dibuka
 * user (scheme ikut `https` karena `x-forwarded-proto` ada). Itulah asal
 * redirect ke `https://0.0.0.0:3000/?error=...`: bukan "header forwarded
 * kadang tidak sampai", tapi fallback yang memang tidak pernah benar
 * begitu ia terpakai.
 *
 * Urutan sumber origin, dari yang paling bisa dipercaya:
 *   1. `X-Forwarded-Host` — di-set Traefik/Coolify dari request asli.
 *   2. `Host` — RUNG YANG DULU HILANG, dan justru paling universal:
 *      Traefik meneruskannya apa adanya (`passHostHeader` default true) DAN
 *      Cloudflare milik Owner (domain custom, §3.4 custom-domain-setup.md)
 *      mempertahankannya walau TIDAK men-set `X-Forwarded-Host` sama
 *      sekali. Tanpa rung ini, jalur domain custom yang headernya beda dari
 *      subdomain platform langsung jatuh ke bind address.
 *   3. `getAppUrl()` (`NEXT_PUBLIC_APP_URL`) — host platform tetap. Bukan
 *      tenant origin yang benar, TAPI selalu bisa dibuka browser, jadi user
 *      melihat halaman error yang wajar alih-alih `ERR_CONNECTION_REFUSED`
 *      ke alamat yang tidak ada di jaringan mana pun.
 */
export function resolveOrigin(request: NextRequest): string {
  const forwardedProto = firstHeaderValue(request, 'x-forwarded-proto');

  const forwardedHost = firstHeaderValue(request, 'x-forwarded-host');
  if (isUsableHost(forwardedHost)) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  const host = firstHeaderValue(request, 'host');
  if (isUsableHost(host)) {
    // Tanpa `x-forwarded-proto` (request tidak lewat proxy sama sekali):
    // host dev lokal pasti http, sisanya di infra ini selalu di balik TLS
    // Cloudflare/Traefik.
    const proto = forwardedProto || (LOCAL_HOSTNAMES.has(hostnameOf(host)) ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  return getAppUrl();
}
