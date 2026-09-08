import { NextRequest, NextResponse } from 'next/server';

import { getAppUrl } from '@/lib/app-url';
import { resolveVerifiedMarketDomain } from '@/lib/market-domain';
import { consumeLogoutReturn } from '@/lib/oauth-state-store';

function fallbackResponse(): NextResponse {
  return NextResponse.redirect(new URL('/', getAppUrl()));
}

/**
 * Landing tetap setelah bagdja-login menghapus cookie SSO.
 *
 * bagdja-login tidak mengizinkan redirect langsung ke domain custom untuk
 * mencegah open redirect. Tujuan asli diambil dari handoff Redis berumur
 * pendek, lalu domain/Market-nya divalidasi ulang sebelum redirect.
 */
export async function GET(request: NextRequest) {
  const handoffId = request.nextUrl.searchParams.get('handoff');
  if (!handoffId) return fallbackResponse();

  const handoff = await consumeLogoutReturn(handoffId);
  if (!handoff) return fallbackResponse();

  let targetOrigin: URL;
  try {
    targetOrigin = new URL(handoff.origin);
  } catch {
    return fallbackResponse();
  }

  if (
    targetOrigin.protocol !== 'https:' ||
    targetOrigin.username ||
    targetOrigin.password ||
    targetOrigin.origin !== handoff.origin
  ) {
    return fallbackResponse();
  }

  const market = await resolveVerifiedMarketDomain(targetOrigin.hostname);
  if (!market || market.slug !== handoff.marketSlug) {
    console.warn(
      `[auth/logout/callback] handoff ditolak host=${targetOrigin.hostname} expectedSlug=${handoff.marketSlug} actualSlug=${market?.slug ?? 'not-found'}`,
    );
    return fallbackResponse();
  }

  return NextResponse.redirect(new URL('/', targetOrigin.origin));
}
