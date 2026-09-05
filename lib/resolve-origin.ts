import type { NextRequest } from 'next/server';

/**
 * Origin asal request sebenarnya. `request.nextUrl.origin` dibangun dari
 * header `Host` mentah yang diterima Next.js — di belakang reverse proxy
 * (Traefik/Coolify) ini kadang meleset (mis. jadi bind address container
 * sendiri, `0.0.0.0:3000`, bukan domain publik). `X-Forwarded-Host` +
 * `X-Forwarded-Proto` jauh lebih bisa dipercaya karena proxy SELALU
 * men-set-nya sendiri berdasarkan request asli dari browser, terlepas dari
 * isu apapun di penerusan `Host` biasa.
 *
 * Di-port dari `bagdja-website/lib/resolve-origin.ts` — bug produksi yang
 * sama (redirect ke `0.0.0.0:3000` alih-alih domain publik) muncul di
 * `bagdja-auction-web` karena fix ini belum ikut ter-port saat alur OAuth
 * di-copy (4 September 2026).
 */
export function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    const forwardedProto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}
