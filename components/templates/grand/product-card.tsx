import Link from 'next/link';

import type { ProductPublic } from '@/lib/api-client';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Kartu produk gaya "masonry" ala Pinterest — tinggi kartu mengikuti rasio
 * gambar asli (bukan aspect-square seragam seperti template `default`), jadi
 * grid terlihat menumpuk tidak rata. Dipasangkan dengan `columns-*` CSS di
 * `catalog-view.tsx` (bukan `grid`) — itulah yang menghasilkan efek masonry
 * tanpa JS tambahan.
 */
export default function ProductCardGrand({
  marketSlug,
  product,
}: {
  marketSlug: string;
  product: ProductPublic;
}) {
  const isAuction = product.mode_jual === 'AUCTION';
  const cover = product.images?.[0] ?? null;

  return (
    <Link href={`/${marketSlug}/products/${product.slug}`} className="group mb-4 block break-inside-avoid">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-100 shadow-sm transition group-hover:shadow-xl">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center text-xs text-zinc-400">
            Tidak ada gambar
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow ${
            isAuction ? 'bg-[var(--palette-orange-burn)]' : 'bg-[var(--brand-success)]'
          }`}
        >
          {isAuction ? 'Lelang' : 'Beli Langsung'}
        </span>
      </div>

      <div className="px-0.5 pt-2.5">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{product.name}</h3>
        {isAuction ? (
          <p className="mt-0.5 text-xs text-zinc-500">
            Estimasi {currencyFormatter.format(product.price)} · tutup {formatDate(product.auction_end_at)}
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(product.price)}
          </p>
        )}
        {product.seller_shop_name && (
          <p className="mt-0.5 text-xs text-zinc-400">{product.seller_shop_name}</p>
        )}
      </div>
    </Link>
  );
}
