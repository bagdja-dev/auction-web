const MARKET_PUBLIC_TAG_PREFIX = 'market-public:';

/**
 * Satu tag per Market, dipasang ke SEMUA fetch publik yang scoped ke Market
 * itu (info Market, daftar produk, detail produk — lihat `lib/api-client.ts`)
 * — cukup satu `revalidateTag()` untuk membuat seluruh cache publik Market
 * ini stale sekaligus, dipicu `bagdja-auction-api` lewat
 * `app/api/internal/revalidate/route.ts` begitu ada publish/unpublish produk.
 */
export function marketPublicTag(marketSlug: string): string {
  return `${MARKET_PUBLIC_TAG_PREFIX}${marketSlug}`;
}
