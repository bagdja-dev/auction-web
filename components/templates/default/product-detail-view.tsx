import Link from 'next/link';

import type { ProductPublic } from '@/lib/api-client';

export interface ProductDetailViewProps {
  marketSlug: string;
  product: ProductPublic;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Template renderer default untuk halaman detail produk publik — pasangan
 * `CatalogView`, lihat catatan di sana soal resolusi template per Market.
 */
export default function ProductDetailView({ marketSlug, product }: ProductDetailViewProps) {
  const isAuction = product.mode_jual === 'AUCTION';
  const images = product.images && product.images.length > 0 ? product.images : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/${marketSlug}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-[var(--brand-primary)]"
      >
        ← Kembali ke katalog
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                Tidak ada gambar
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1).map((src, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={src}
                  alt={`${product.name} ${idx + 2}`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <span
            className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-medium text-white ${
              isAuction ? 'bg-[var(--palette-orange-burn)]' : 'bg-[var(--brand-success)]'
            }`}
          >
            {isAuction ? 'Lelang' : 'Beli Langsung'}
          </span>

          <h1 className="text-2xl font-semibold text-zinc-900">{product.name}</h1>

          {product.seller_shop_name && (
            <p className="text-sm text-zinc-500">Dijual oleh {product.seller_shop_name}</p>
          )}

          <p className="text-2xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(product.price)}
            {isAuction && <span className="ml-1 text-sm font-normal text-zinc-500">(estimasi)</span>}
          </p>

          {isAuction && (
            <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p>Buka lelang: {formatDateTime(product.auction_start_at)}</p>
              <p>Tutup lelang: {formatDateTime(product.auction_end_at)}</p>
              {product.min_increment != null && (
                <p>Kelipatan tawar minimum: {currencyFormatter.format(product.min_increment)}</p>
              )}
            </div>
          )}

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">
              {product.description}
            </p>
          )}

          <button
            type="button"
            disabled
            title="Fitur checkout/bidding segera hadir"
            className="mt-2 w-full cursor-not-allowed rounded-lg bg-zinc-300 px-4 py-3 text-sm font-medium text-zinc-500"
          >
            {isAuction ? 'Ikut Lelang' : 'Beli Sekarang'} — Segera Hadir
          </button>
        </div>
      </div>
    </main>
  );
}
