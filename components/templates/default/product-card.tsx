import Link from 'next/link';

import type { Market, ProductPublic } from '@/lib/api-client';
import { getCatalogStatusLabel } from '@/lib/product-status';
import { AuctionCountdown } from '@/components/auction-countdown';
import { SoldStamp } from '@/components/sold-stamp';

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

export default function ProductCard({
  linkBase,
  product,
  market,
}: {
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  product: ProductPublic;
  market: Market;
}) {
  const isAuction = product.mode_jual === 'AUCTION';
  const cover = product.images?.[0] ?? null;
  const statusLabel = getCatalogStatusLabel(product, market);

  return (
    <Link
      href={`${linkBase}/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-[var(--brand-primary)] hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-zinc-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Tidak ada gambar
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-1 text-xs font-medium text-white ${
            isAuction ? 'bg-[var(--palette-orange-burn)]' : 'bg-[var(--brand-success)]'
          }`}
        >
          {isAuction ? 'Lelang' : 'Beli Langsung'}
        </span>
        {statusLabel &&
          (statusLabel.variant === 'stamp' ? (
            <SoldStamp text={statusLabel.text} subtext={statusLabel.subtext} />
          ) : (
            <span
              className={`absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-medium ${statusLabel.className}`}
            >
              {statusLabel.text}
            </span>
          ))}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{product.name}</h3>
        {product.seller_shop_name && (
          <p className="text-xs text-zinc-500">{product.seller_shop_name}</p>
        )}

        {isAuction ? (
          <div className="mt-1 space-y-0.5 text-xs text-zinc-600">
            <p>Estimasi: {currencyFormatter.format(product.price)}</p>
            <p>Buka: {formatDateTime(product.auction_start_at)}</p>
            <p>Tutup: {formatDateTime(product.auction_end_at)}</p>
            <AuctionCountdown
              compact
              status={product.status}
              auctionStartAt={product.auction_start_at}
              auctionEndAt={product.auction_end_at}
              registrationDeadlineMinutes={market.registration_deadline_minutes}
            />
          </div>
        ) : (
          <p className="mt-1 text-base font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(product.price)}
          </p>
        )}
      </div>
    </Link>
  );
}
