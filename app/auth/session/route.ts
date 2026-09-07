import { NextRequest, NextResponse } from 'next/server';

import { setSessionCookies } from '@/lib/session';
import { consumeSessionHandoff } from '@/lib/oauth-state-store';
import { resolveOrigin } from '@/lib/resolve-origin';

/**
 * Hop KEDUA login untuk domain custom (`pasarmolly.com` dkk) — dituju
 * `app/auth/callback/route.ts` lewat redirect `?handoff=<id>` SETELAH token
 * exchange sukses di sana. Request INI genuinely dilayani "sebagai" origin
 * tenant asli (lewat Traefik ke app yang sama, tapi dari sudut pandang
 * browser host-nya benar `pasarmolly.com`) — makanya cookie sesi BARU
 * di-set di sini, bukan di `/auth/callback` (lihat docblock
 * `SessionHandoffPayload` di lib/oauth-state-store.ts untuk alasan lengkap
 * kenapa hop ini perlu ada sama sekali).
 */
export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const handoffId = request.nextUrl.searchParams.get('handoff');

  if (!handoffId) {
    return NextResponse.redirect(new URL('/?error=missing_params', origin));
  }

  const decoded = await consumeSessionHandoff(handoffId);
  if (!decoded) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', origin));
  }

  const response = NextResponse.redirect(new URL(decoded.redirectTo, origin));
  setSessionCookies(response, decoded.accessToken, decoded.user, origin);
  return response;
}
