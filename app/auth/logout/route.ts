import { NextResponse } from 'next/server';

import { clearSession } from '@/lib/session';
import { buildSsoLogoutUrl } from '@/lib/app-url';

export async function GET() {
  await clearSession();

  // Redirect to Bagdja Login SSO logout so the shared session cookie
  // (bagdja_auth_token) is cleared — otherwise the next login skips the form.
  return NextResponse.redirect(buildSsoLogoutUrl());
}
