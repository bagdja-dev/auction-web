import { NextRequest, NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, buildAuthorizeUrl } from '@/lib/auth';
import { generateStateId, saveOAuthState } from '@/lib/oauth-state-store';
import { resolveVerifiedMarketDomain } from '@/lib/market-domain';
import { resolveOrigin } from '@/lib/resolve-origin';
import { isPlatformHost } from '@/lib/session';

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export async function GET(request: NextRequest) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  // Origin asal login (subdomain tenant / domain publik) — dipakai callback
  // untuk redirect balik, karena request.url di callback SELALU host
  // redirect_uri OAuth yang tetap. `resolveOrigin()` (bukan `request.nextUrl.origin`
  // langsung) supaya tidak meleset jadi bind address container (`0.0.0.0:3000`)
  // di belakang Traefik/Coolify — lihat lib/resolve-origin.ts.
  const origin = resolveOrigin(request);
  const originUrl = new URL(origin);
  const isLocal =
    originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';

  // Domain custom tidak cukup hanya berhasil masuk lewat router Traefik:
  // ikat percobaan OAuth ini ke Market aktif+terverifikasi yang terdaftar
  // di database. Callback akan memvalidasi pasangan domain/slug ini lagi
  // sebelum sesi diserahkan kembali ke domain custom.
  let marketSlug: string | null = null;
  if (!isLocal && !isPlatformHost(originUrl.hostname)) {
    const market = await resolveVerifiedMarketDomain(originUrl.hostname);
    if (!market) {
      console.warn(
        `[auth/login] custom domain tidak aktif/terverifikasi host=${originUrl.hostname}`,
      );
      return NextResponse.redirect(
        new URL('/?error=domain_not_verified', origin),
      );
    }
    marketSlug = market.slug;
  }

  // code_verifier + next path disimpan di Redis (bukan cookie) — supaya
  // tidak bergantung pada cookie yang di-set sebelum redirect bertahan
  // lintas navigasi ke IdP dan balik lagi. `state` yang dikirim ke IdP
  // cuma ID pendek acak (lihat lib/oauth-state-store.ts).
  const stateId = generateStateId();
  console.log(
    `[auth/login] host=${request.headers.get('host')} x-forwarded-host=${request.headers.get('x-forwarded-host')} x-forwarded-proto=${request.headers.get('x-forwarded-proto')} resolvedOrigin=${origin} stateId=${stateId}`,
  );
  const saved = await saveOAuthState(stateId, {
    codeVerifier,
    next,
    origin,
    marketSlug,
  });
  console.log(`[auth/login] saveOAuthState stateId=${stateId} saved=${saved}`);
  if (!saved) {
    console.error('Redis belum dikonfigurasi/tidak bisa diakses (REDIS_URL)');
    return NextResponse.redirect(new URL('/?error=server_misconfigured', origin));
  }

  const authorizeUrl = buildAuthorizeUrl(stateId, codeChallenge);
  return NextResponse.redirect(authorizeUrl);
}
