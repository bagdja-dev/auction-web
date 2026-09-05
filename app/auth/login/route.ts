import { NextRequest, NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge, buildAuthorizeUrl } from '@/lib/auth';
import { generateStateId, saveOAuthState } from '@/lib/oauth-state-store';
import { resolveOrigin } from '@/lib/resolve-origin';

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export async function GET(request: NextRequest) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  // Origin asal login (subdomain tenant / domain publik) — dipakai callback
  // untuk redirect balik, karena request.url di callback SELALU host
  // redirect_uri OAuth yang tetap. `resolveOrigin()` (bukan `request.nextUrl.origin`
  // langsung) supaya tidak meleset jadi bind address container (`0.0.0.0:3000`)
  // di belakang Traefik/Coolify — lihat lib/resolve-origin.ts.
  const origin = resolveOrigin(request);

  // code_verifier + next path disimpan di Upstash Redis (bukan cookie) —
  // supaya tidak bergantung pada cookie yang di-set sebelum redirect
  // bertahan lintas navigasi ke IdP dan balik lagi. `state` yang dikirim ke
  // IdP cuma ID pendek acak (lihat lib/oauth-state-store.ts).
  const stateId = generateStateId();
  const saved = await saveOAuthState(stateId, { codeVerifier, next, origin });
  if (!saved) {
    console.error('Upstash Redis belum dikonfigurasi (KV_REST_API_URL/TOKEN atau UPSTASH_REDIS_REST_URL/TOKEN)');
    return NextResponse.redirect(new URL('/?error=server_misconfigured', origin));
  }

  const authorizeUrl = buildAuthorizeUrl(stateId, codeChallenge);
  return NextResponse.redirect(authorizeUrl);
}
