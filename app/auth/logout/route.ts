import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookies } from '@/lib/session';
import { buildSsoLogoutUrl } from '@/lib/app-url';
import { resolveOrigin } from '@/lib/resolve-origin';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(buildSsoLogoutUrl());

  // targetOrigin = origin request logout ini sendiri (subdomain tenant tempat
  // user klik logout) — cookie di-set dengan Domain scope platform, jadi
  // domain yang sama otomatis match dari subdomain manapun (lihat lib/session.ts).
  // `resolveOrigin()` (bukan `request.nextUrl.origin` langsung) — sama seperti
  // auth/login/route.ts, hindari salah baca origin di belakang Traefik/Coolify.
  clearSessionCookies(response, resolveOrigin(request));

  // Redirect to Bagdja Login SSO logout so the shared session cookie
  // (bagdja_auth_token) is cleared — otherwise the next login skips the form.
  return response;
}
