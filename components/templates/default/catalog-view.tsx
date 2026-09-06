import Link from 'next/link';

import type { Market, PaginatedResult, ProductModeJual, ProductPublic } from '@/lib/api-client';
import { MarketAppBar } from '@/components/market-app-bar';
import ModeFilter from './mode-filter';
import ProductCard from './product-card';

export interface CatalogViewProps {
  market: Market;
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  products: PaginatedResult<ProductPublic>;
  page: number;
  modeJual: ProductModeJual | undefined;
  isLoggedIn: boolean;
  displayName?: string;
}

/**
 * Template renderer default untuk halaman katalog publik. Ini SATU dari
 * (nanti) beberapa template yang bisa dipilih per Market lewat
 * `market.template_id` — lihat `components/templates/registry.ts` untuk
 * resolusinya. TIDAK dipakai oleh halaman "Toko Saya" (layout statis/global,
 * lihat `app/[market_slug]/toko-saya/layout.tsx`).
 */
export default function CatalogView({
  market,
  linkBase,
  products,
  page,
  modeJual,
  isLoggedIn,
  displayName,
}: CatalogViewProps) {
  const { items, total, size } = products;
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <MarketAppBar
        linkBase={linkBase}
        isLoggedIn={isLoggedIn}
        displayName={displayName}
        left={<h1 className="text-2xl font-semibold text-[var(--brand-primary)]">{market.name}</h1>}
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{total} produk</p>
        <ModeFilter linkBase={linkBase} />
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Belum ada produk yang dipublikasikan di Market ini.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} linkBase={linkBase} product={product} market={market} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const qsParams = new URLSearchParams();
            if (modeJual) qsParams.set('mode_jual', modeJual);
            if (p > 1) qsParams.set('page', String(p));
            const qs = qsParams.toString();
            return (
              <Link
                key={p}
                href={`${linkBase}${qs ? `?${qs}` : ''}`}
                className={`rounded-md px-3 py-1.5 ${
                  p === page
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </main>
  );
}
