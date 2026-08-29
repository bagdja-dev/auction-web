import Link from 'next/link';

import type { Market, PaginatedResult, ProductModeJual, ProductPublic } from '@/lib/api-client';
import ModeFilter from '../default/mode-filter';
import ProductCardGrand from './product-card';

export interface CatalogViewProps {
  market: Market;
  marketSlug: string;
  products: PaginatedResult<ProductPublic>;
  page: number;
  modeJual: ProductModeJual | undefined;
  isLoggedIn: boolean;
}

/**
 * Template "grand" — grid masonry ala Pinterest untuk kartu produk (lihat
 * `product-card.tsx`). Struktur halaman (header, filter, pagination) sama
 * persis dengan template `default`, cuma bagian grid produknya yang beda
 * (`columns-*` + `break-inside-avoid`, bukan `grid` seragam).
 */
export default function CatalogView({
  market,
  marketSlug,
  products,
  page,
  modeJual,
  isLoggedIn,
}: CatalogViewProps) {
  const { items, total, size } = products;
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-primary)]">{market.name}</h1>
        {isLoggedIn ? (
          <Link
            href={`/${marketSlug}/toko-saya`}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            Toko Saya
          </Link>
        ) : (
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/${marketSlug}/toko-saya`)}`}
            className="rounded-lg border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)] transition hover:bg-zinc-50"
          >
            Masuk
          </Link>
        )}
      </header>

      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{total} produk</p>
        <ModeFilter marketSlug={marketSlug} />
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Belum ada produk yang dipublikasikan di Market ini.
        </p>
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {items.map((product) => (
            <ProductCardGrand key={product.id} marketSlug={marketSlug} product={product} />
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
                href={`/${marketSlug}${qs ? `?${qs}` : ''}`}
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
