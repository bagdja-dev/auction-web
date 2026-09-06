import { headers } from 'next/headers';

const PLATFORM_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'https://market.bagdja.com').hostname;
  } catch {
    return 'market.bagdja.com';
  }
})();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Base path untuk link internal (katalog, produk, toko-saya, dst) di halaman
 * Market. Kosong (`''`) kalau diakses via subdomain (`{slug}.market.bagdja.com`)
 * atau custom domain — hostname sudah menyiratkan slug-nya, jadi link internal
 * harus root-relative (`/toko-saya`), BUKAN `/{slug}/toko-saya` (dulu ini bug:
 * link jadi dobel slug, mis. `tokolawas.market.bagdja.com/tokolawas/toko-saya`
 * — persis pola bug yang sudah pernah diperbaiki di
 * `bagdja-website/lib/tenant-link-base.ts`, di sini direplikasi).
 *
 * `/{slug}` kalau diakses path-based (local dev via localhost, atau akses
 * langsung ke apex `market.bagdja.com` sebelum middleware redirect ke
 * subdomain — lihat `middleware.ts` case 1).
 */
export function resolveTenantLinkBase(marketSlug: string): string {
  const host = headers().get('host') ?? '';
  const hostname = host.split(':')[0];
  if (LOCAL_HOSTS.has(hostname) || hostname === PLATFORM_HOST) {
    return `/${marketSlug}`;
  }
  return '';
}
