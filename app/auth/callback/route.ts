import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/session';
import { consumeOAuthState } from '@/lib/oauth-state-store';

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://login.bagdja.com';
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'auction-market';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? '';
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5012/auth/callback';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?error=auth_denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', request.url));
  }

  // code_verifier + next path dibaca dari Upstash Redis (sekali pakai, lalu
  // dihapus) — bukan dari cookie, supaya tidak terpengaruh Safari yang tidak
  // konsisten menyimpan Set-Cookie yang menempel di response redirect (lihat
  // login/route.ts).
  const decoded = await consumeOAuthState(state);

  if (!decoded) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
  }

  const codeVerifier = decoded.codeVerifier;

  try {
    const tokenRes = await fetch(`${AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Token exchange failed:', errBody);
      return NextResponse.redirect(new URL('/?error=token_failed', request.url));
    }

    const data = await tokenRes.json();
    const accessToken: string = data.access_token;

    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );

    await setSession(accessToken, {
      userId: payload.sub ?? payload.userId,
      email: payload.email,
      username: payload.username,
    });

    const nextPath = decoded.next;

    const redirectTo =
      nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : '/';

    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}
