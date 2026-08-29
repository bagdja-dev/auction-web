import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMarketBySlug, getMarketProducts, type ProductModeJual } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import ModeFilter from '@/components/mode-filter';
import ProductCard from '@/components/product-card';

export const revalidate = 60;

interface MarketPageProps {
  params: { market_slug: string };
  searchParams: { mode_jual?: string; page?: string };
}

function parseModeJual(value: string | undefined): ProductModeJual | undefined {
  return value === 'AUCTION' || value === 'DIRECT_SELL' ? value : undefined;
}

export async function generateMetadata({ params }: MarketPageProps): Promise<Metadata> {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) return {};
  return { title: market.name };
}

export default async function MarketCatalogPage({ params, searchParams }: MarketPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market || !market.is_active) notFound();

  const page = Number(searchParams.page ?? '1') || 1;
  const modeJual = parseModeJual(searchParams.mode_jual);

  const { items: products, total, size } = await getMarketProducts(params.market_slug, {
    page,
    mode_jual: modeJual,
  });

  const { user } = await getSession();
  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-primary)]">{market.name}</h1>
        {user ? (
          <Link
            href={`/${params.market_slug}/toko-saya`}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            Toko Saya
          </Link>
        ) : (
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/${params.market_slug}/toko-saya`)}`}
            className="rounded-lg border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)] transition hover:bg-zinc-50"
          >
            Masuk
          </Link>
        )}
      </header>

      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">{total} produk</p>
        <ModeFilter marketSlug={params.market_slug} />
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Belum ada produk yang dipublikasikan di Market ini.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} marketSlug={params.market_slug} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const params2 = new URLSearchParams();
            if (modeJual) params2.set('mode_jual', modeJual);
            if (p > 1) params2.set('page', String(p));
            const qs = params2.toString();
            return (
              <Link
                key={p}
                href={`/${params.market_slug}${qs ? `?${qs}` : ''}`}
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
