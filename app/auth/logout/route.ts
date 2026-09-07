import { NextRequest, NextResponse } from 'next/server';

import { clearSessionCookies } from '@/lib/session';
import { buildSsoLogoutUrl } from '@/lib/app-url';
import { resolveOrigin } from '@/lib/resolve-origin';

export async function GET(request: NextRequest) {
  // Origin request logout ini sendiri (subdomain tenant/domain custom tempat
  // user klik logout) — SEBELUMNYA `buildSsoLogoutUrl()` dipanggil tanpa
  // argumen, jatuh ke `getAppUrl()` (URL platform TETAP dari env,
  // `lelang.bagdja.com`) sehingga user SELALU kembali ke situ walau login
  // dari domain custom (mis. `pasarmolly.com`) — bug porting yang sama
  // seperti soal `0.0.0.0:3000`, dibandingkan dengan `bagdja-website`
  // (referensi asal) yang sudah benar pakai `resolveOrigin()` di sini juga.
  const origin = resolveOrigin(request);

  const response = NextResponse.redirect(buildSsoLogoutUrl(origin));

  // cookie di-set dengan Domain scope platform, jadi domain yang sama
  // otomatis match dari subdomain manapun (lihat lib/session.ts).
  clearSessionCookies(response, origin);

  // Redirect to Bagdja Login SSO logout so the shared session cookie
  // (bagdja_auth_token) is cleared — otherwise the next login skips the form.
  return response;
}
