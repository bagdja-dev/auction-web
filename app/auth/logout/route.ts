import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookies, isPlatformHost } from '@/lib/session';
import { buildSsoLogoutUrl, getAppUrl } from '@/lib/app-url';
import { resolveVerifiedMarketDomain } from '@/lib/market-domain';
import { generateStateId, saveLogoutReturn } from '@/lib/oauth-state-store';
import { resolveOrigin } from '@/lib/resolve-origin';

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const hostname = new URL(origin).hostname;

  // bagdja-login sengaja hanya menerima redirect_uri milik *.bagdja.com
  // (proteksi open redirect), sehingga domain custom tidak boleh dikirim
  // langsung sebagai redirect_uri. Untuk custom domain, kembali dulu ke
  // callback tetap di lelang.bagdja.com; callback itu memvalidasi domain ke
  // database sebelum meneruskan browser ke origin pemanggil.
  let returnAfterSso = origin;
  if (!isPlatformHost(hostname) && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    const market = await resolveVerifiedMarketDomain(hostname);
    const handoffId = generateStateId();
    const saved =
      market &&
      (await saveLogoutReturn(handoffId, {
        origin,
        marketSlug: market.slug,
      }));

    if (saved) {
      const callbackUrl = new URL('/auth/logout/callback', getAppUrl());
      callbackUrl.searchParams.set('handoff', handoffId);
      returnAfterSso = callbackUrl.toString();
    } else {
      console.warn(
        `[auth/logout] gagal menyimpan tujuan logout custom-domain host=${hostname}; fallback ke platform`,
      );
      returnAfterSso = getAppUrl();
    }
  }

  const response = NextResponse.redirect(buildSsoLogoutUrl(returnAfterSso));
  clearSessionCookies(response, origin);

  return response;
}
