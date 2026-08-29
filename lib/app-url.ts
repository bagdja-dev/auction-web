/**
 * App base URL (without /auth/callback).
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5012/auth/callback';
  return redirectUri.replace(/\/auth\/callback\/?$/, '') || 'http://localhost:5012';
}

/**
 * Bagdja Login (SSO UI) base URL.
 */
export function getLoginUrl(): string {
  return (process.env.NEXT_PUBLIC_AUTH_URL ?? 'https://login.bagdja.com').replace(/\/$/, '');
}

/**
 * Build SSO logout URL — clears bagdja_auth_token cookie on login.bagdja.com
 * then redirects back to the app landing page.
 */
export function buildSsoLogoutUrl(returnTo?: string): string {
  const url = new URL('/logout', getLoginUrl());
  url.searchParams.set('redirect_uri', returnTo ?? getAppUrl());
  return url.toString();
}
