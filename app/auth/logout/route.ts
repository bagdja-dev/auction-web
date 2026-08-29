import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookies } from '@/lib/session';
import { buildSsoLogoutUrl } from '@/lib/app-url';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(buildSsoLogoutUrl());

  // targetOrigin = origin request logout ini sendiri (subdomain tenant tempat
  // user klik logout) — cookie di-set dengan Domain scope platform, jadi
  // domain yang sama otomatis match dari subdomain manapun (lihat lib/session.ts).
  clearSessionCookies(response, request.nextUrl.origin);

  // Redirect to Bagdja Login SSO logout so the shared session cookie
  // (bagdja_auth_token) is cleared — otherwise the next login skips the form.
  return response;
}
