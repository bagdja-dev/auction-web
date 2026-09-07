import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies } from '@/lib/session';
import { consumeOAuthState } from '@/lib/oauth-state-store';
import { resolveOrigin } from '@/lib/resolve-origin';

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://login.bagdja.com';
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'auction-market';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? '';
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5012/auth/callback';

export async function GET(request: NextRequest) {
  // `resolveOrigin()` (bukan `request.url`/`request.nextUrl.origin` langsung)
  // — di belakang Traefik/Coolify itu bisa meleset jadi bind address
  // container (`0.0.0.0:3000`), lihat lib/resolve-origin.ts. Dipakai untuk
  // SEMUA redirect error di route ini (`request.url` tidak pernah dipakai
  // lagi sebagai base redirect), supaya user tidak pernah diarahkan ke host
  // yang tidak bisa diakses browser-nya.
  const origin = resolveOrigin(request);
  console.log(
    `[auth/callback] host=${request.headers.get('host')} x-forwarded-host=${request.headers.get('x-forwarded-host')} x-forwarded-proto=${request.headers.get('x-forwarded-proto')} resolvedOrigin=${origin}`,
  );

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  console.log(`[auth/callback] state=${state} hasCode=${Boolean(code)} error=${error}`);

  if (error) {
    return NextResponse.redirect(new URL('/?error=auth_denied', origin));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', origin));
  }

  // code_verifier + next path dibaca dari Redis (sekali pakai, lalu dihapus)
  // — bukan dari cookie, supaya tidak terpengaruh Safari yang tidak
  // konsisten menyimpan Set-Cookie yang menempel di response redirect (lihat
  // login/route.ts).
  const decoded = await consumeOAuthState(state);
  console.log(`[auth/callback] consumeOAuthState state=${state} found=${Boolean(decoded)}`);

  if (!decoded) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', origin));
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
      return NextResponse.redirect(new URL('/?error=token_failed', origin));
    }

    const data = await tokenRes.json();
    const accessToken: string = data.access_token;

    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );

    const nextPath = decoded.next;
    const redirectTo =
      nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : '/';

    // Redirect balik ke origin login ASLI (subdomain tenant), BUKAN
    // `request.url` (selalu host `redirect_uri` OAuth tetap) — lihat catatan
    // di lib/session.ts soal kenapa ini juga menentukan Domain cookie.
    const response = NextResponse.redirect(new URL(redirectTo, decoded.origin));

    setSessionCookies(
      response,
      accessToken,
      {
        userId: payload.sub ?? payload.userId,
        email: payload.email,
        username: payload.username,
      },
      decoded.origin,
    );

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', origin));
  }
}
