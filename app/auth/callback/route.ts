import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookies, isPlatformHost } from '@/lib/session';
import { consumeOAuthState, generateStateId, saveSessionHandoff } from '@/lib/oauth-state-store';
import { resolveVerifiedMarketDomain } from '@/lib/market-domain';
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
    const originHostname = new URL(decoded.origin).hostname;
    const platformOrigin = isPlatformHost(originHostname);
    const localOrigin =
      originHostname === 'localhost' || originHostname === '127.0.0.1';

    // Untuk domain custom, validasi database dilakukan SEBELUM code OAuth
    // ditukar. Origin dari state harus masih terdaftar, aktif,
    // terverifikasi, dan tetap menunjuk Market yang sama seperti saat login
    // dimulai.
    if (!platformOrigin && !localOrigin) {
      const resolvedMarket = await resolveVerifiedMarketDomain(originHostname);
      if (
        !decoded.marketSlug ||
        !resolvedMarket ||
        resolvedMarket.slug !== decoded.marketSlug
      ) {
        console.warn(
          `[auth/callback] custom domain validation failed host=${originHostname} expectedSlug=${decoded.marketSlug ?? 'missing'} actualSlug=${resolvedMarket?.slug ?? 'not-found'}`,
        );
        return NextResponse.redirect(
          new URL('/?error=domain_not_verified', origin),
        );
      }
    }

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

    const user = {
      userId: payload.sub ?? payload.userId,
      email: payload.email,
      username: payload.username,
    };

    if (platformOrigin) {
      // Subdomain platform kita sendiri (`{slug}.lelang.bagdja.com`) — cookie
      // wildcard `.{platformHostname}` valid di-set langsung dari sini
      // (host callback ini SENDIRI juga bagian dari domain yang sama), jalur
      // pendek seperti sebelumnya.
      const response = NextResponse.redirect(new URL(redirectTo, decoded.origin));
      setSessionCookies(response, accessToken, user, decoded.origin);
      return response;
    }

    // Domain custom Owner (mis. `pasarmolly.com`) — SECARA FUNDAMENTAL tidak
    // bisa di-set cookie-nya dari sini (host callback ini tetap
    // `lelang.bagdja.com`, redirect_uri OAuth yang fixed, RFC 6265 melarang
    // cookie lintas domain yang tidak terkait). Titipkan payload sesi lewat
    // handoff sekali-pakai, redirect ke `/auth/session` di origin TENANT
    // ASLI — baru di sana cookie benar-benar bisa di-set. Lihat docblock
    // `SessionHandoffPayload` di lib/oauth-state-store.ts.
    const handoffId = generateStateId();
    const saved = await saveSessionHandoff(handoffId, { accessToken, user, redirectTo });
    if (!saved) {
      return NextResponse.redirect(new URL('/?error=server_misconfigured', origin));
    }

    return NextResponse.redirect(
      new URL(`/auth/session?handoff=${handoffId}`, decoded.origin),
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', origin));
  }
}
