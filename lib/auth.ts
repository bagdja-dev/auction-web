/**
 * OAuth 2.0 PKCE helpers for Bagdja Auth integration.
 *
 * Flow:
 *   1. Generate code_verifier + code_challenge (S256)
 *   2. Redirect to Bagdja Auth /oauth/authorize
 *   3. Auth redirects back with ?code=…&state=…
 *   4. Exchange code + code_verifier → access_token (server-side)
 *
 * Pola diadaptasi persis dari `bagdja-auction-admin/src/lib/auth.ts` — client
 * app OAuth SAMA dengan admin (`auction-market`), hanya `redirect_uri` yang
 * beda (didaftarkan sebagai tambahan di client app yang sama).
 */

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64url(array.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://login.bagdja.com';
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'auction-market';
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5012/auth/callback';

export function buildAuthorizeUrl(state: string, codeChallenge: string, forceLogin = false): string {
  const url = new URL('/oauth/authorize', AUTH_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (forceLogin) {
    url.searchParams.set('prompt', 'login');
  }
  return url.toString();
}
