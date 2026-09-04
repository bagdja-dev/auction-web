/**
 * Resolusi tenant (Market) berdasarkan Host header, 3 kasus — pola PERSIS
 * dari `bagdja-website/middleware.ts` (lihat file itu untuk alasan desain
 * lengkap per kasus), disesuaikan untuk Auction Market:
 *
 *  1. Host = apex platform (`market.bagdja.com`) + path /{slug}/...
 *     -> redirect permanen ke subdomain https://{slug}.market.bagdja.com/...
 *  2. Host = {slug}.market.bagdja.com (wildcard subdomain)
 *     -> rewrite ke /{slug}/... (slug diambil langsung dari hostname, tanpa panggilan API)
 *  3. Host lain (kandidat custom domain)
 *     -> tanya API GET /api/public/resolve-domain?host=..., rewrite kalau ketemu
 *
 * Semua rewrite memakai prefix generik `/{slug}${pathname}` sehingga route
 * [market_slug]/... dipakai apa adanya, tanpa perubahan.
 */
import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5010';
const PLATFORM_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://market.bagdja.com').hostname;
  } catch {
    return 'market.bagdja.com';
  }
})();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const SUBDOMAIN_PATTERN = new RegExp(`^([a-z0-9-]+)\\.${PLATFORM_HOST.replace(/\./g, '\\.')}$`);

// ─── Route protected (wajib login seller/buyer) ─────────────────────────
// Seluruh halaman "Dashboard" (Produk, Pesanan, Pembelian Saya, Pengaturan,
// termasuk status Order/Settlement pasca-pembayaran) dibungkus di
// `/{slug}/toko-saya/*` — satu pattern ini cukup untuk melindungi semuanya,
// tidak perlu ditambah per fitur baru selama tetap dinest di sini.
const PROTECTED_PATH_PATTERN = /^\/([a-z0-9-]+)\/toko-saya(\/|$)/;

function shouldProtect(pathname: string): boolean {
  return PROTECTED_PATH_PATTERN.test(pathname);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/auth/login', request.nextUrl.origin);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

function hasSession(request: NextRequest): boolean {
  return Boolean(request.cookies.get('am_buyer_token')?.value);
}

async function resolveSlugForDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/resolve-domain?host=${encodeURIComponent(host)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string };
    return data.slug ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host') ?? '';
  const hostname = hostHeader.split(':')[0];

  // Route auth (/auth/*) TIDAK boleh di-rewrite jadi slug tenant — dilayani
  // di host asal (localhost / custom domain) supaya callback OAuth dan login
  // jalan di domain tempat user memulai.
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // Protect `/{slug}/toko-saya` — cek session SEBELUM tenant resolution,
  // karena di localhost path langsung `/{slug}/toko-saya`.
  if (shouldProtect(request.nextUrl.pathname)) {
    if (!hasSession(request)) {
      return redirectToLogin(request);
    }
    return NextResponse.next();
  }

  if (!hostname || LOCAL_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  // Case 1: apex platform host + /{slug}/... -> modernize to subdomain
  if (hostname === PLATFORM_HOST) {
    const [, slug, ...rest] = request.nextUrl.pathname.split('/');
    if (slug) {
      const redirectUrl = new URL(request.nextUrl);
      redirectUrl.protocol = 'https:';
      redirectUrl.host = `${slug}.${PLATFORM_HOST}`;
      redirectUrl.pathname = rest.length ? `/${rest.join('/')}` : '/';
      return NextResponse.redirect(redirectUrl, 308);
    }
    return NextResponse.next();
  }

  // Case 2: wildcard subdomain -> rewrite using the slug parsed straight from the hostname
  const subdomainMatch = hostname.match(SUBDOMAIN_PATTERN);
  if (subdomainMatch) {
    const slug = subdomainMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${request.nextUrl.pathname}`;
    if (shouldProtect(url.pathname)) {
      if (!hasSession(request)) {
        return redirectToLogin(request);
      }
      return NextResponse.rewrite(url);
    }
    return NextResponse.rewrite(url);
  }

  // Case 3: candidate custom domain -> ask the API
  const slug = await resolveSlugForDomain(hostname);
  if (slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${request.nextUrl.pathname}`;
    if (shouldProtect(url.pathname)) {
      if (!hasSession(request)) {
        return redirectToLogin(request);
      }
      return NextResponse.rewrite(url);
    }
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
