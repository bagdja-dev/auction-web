'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FulfillmentProgress } from '@/components/fulfillment-progress';
import { ProductMediaGallery } from '@/components/product-media-gallery';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type {
  AuctionRegistration,
  AuctionRegistrationMeResponse,
  Order,
  OrderForSellerResponse,
  Product,
  ProductFulfillment,
} from '@/lib/types';
import { useTokoSaya } from '../../_components/toko-saya-context';
import { PageTitle } from '../../_components/page-title';

interface ListingDetailContentProps {
  productId: string;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<Product['status'], string> = {
  draft: 'Draft',
  published: 'Dipublikasikan',
  sold: 'Terjual',
  expired: 'Kedaluwarsa',
};

const STATUS_BADGE_CLASS: Record<Product['status'], string> = {
  draft: 'bg-zinc-200 text-zinc-700',
  published: 'bg-[var(--brand-success)] text-white',
  sold: 'bg-[var(--brand-info)] text-white',
  expired: 'bg-[var(--brand-error)] text-white',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Halaman detail SATU listing milik seller (`toko-saya/listing/[product_id]`)
 * — dipisah dari grid kartu `mode-listing-manager.tsx` supaya galeri media +
 * `FulfillmentProgress` (kalau produk sudah `sold`) punya ruang lega. Layout
 * kolom media+info mengikuti pola `product-detail-view.tsx` (galeri kiri,
 * info kanan berdampingan di desktop, ditumpuk di mobile) — sebelumnya
 * ditumpuk vertikal terus di semua ukuran layar.
 *
 * "Pemenang & Alamat Pengiriman" (baru) — sebelumnya seller SAMA SEKALI
 * tidak punya cara tahu siapa pembeli/pemenang dan ke mana barang harus
 * dikirim dari Dashboard web ini (endpoint `products/:id/registrations`
 * yang sudah ada itu punya guard `AppAccessGuard`, khusus Admin Console
 * staff/owner — beda audiens dari sesi seller di sini, TIDAK bisa dipanggil
 * dari sini). Ditambahkan 2 endpoint baru `SellerOwnershipGuard`:
 * `products/:id/registrations/winner` (AUCTION) dan `products/:id/order`
 * (DIRECT_SELL) — cuma dipanggil kalau produk sudah `sold`.
 */
export default function ListingDetailContent({ productId }: ListingDetailContentProps) {
  const { marketId, linkBase, seller } = useTokoSaya();

  const [product, setProduct] = useState<Product | null>(null);
  const [fulfillment, setFulfillment] = useState<ProductFulfillment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [winner, setWinner] = useState<AuctionRegistration | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [buyerInfoLoading, setBuyerInfoLoading] = useState(false);

  useEffect(() => {
    if (!seller) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiClient<Product[]>(`/api/markets/${marketId}/products/mine`),
      apiClient<ProductFulfillment[]>(`/api/markets/${marketId}/fulfillments/mine`),
    ])
      .then(([products, fulfillments]) => {
        if (cancelled) return;
        setProduct(products.find((p) => p.id === productId) ?? null);
        setFulfillment(fulfillments.find((f) => f.product_id === productId) ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat detail produk.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marketId, productId, seller]);

  // Info pemenang/buyer cuma relevan begitu produk `sold` — request terpisah
  // (bukan digabung ke Promise.all di atas) supaya tidak nunggu tambahan
  // round-trip kalau produknya masih draft/published/expired.
  useEffect(() => {
    if (!product || product.status !== 'sold') return;
    let cancelled = false;
    setBuyerInfoLoading(true);
    const request =
      product.mode_jual === 'AUCTION'
        ? apiClient<AuctionRegistrationMeResponse>(`/api/markets/${marketId}/products/${productId}/registrations/winner`).then(
            (res) => {
              if (!cancelled) setWinner(res.registration);
            },
          )
        : apiClient<OrderForSellerResponse>(`/api/markets/${marketId}/products/${productId}/order`).then((res) => {
            if (!cancelled) setOrder(res.order);
          });
    request
      .catch(() => {
        // Non-kritis — halaman tetap bisa dipakai tanpa info ini, cukup diam.
      })
      .finally(() => {
        if (!cancelled) setBuyerInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marketId, productId, product]);

  const backHref = product
    ? product.mode_jual === 'AUCTION'
      ? `${linkBase}/toko-saya/lelang`
      : `${linkBase}/toko-saya/beli-langsung`
    : `${linkBase}/toko-saya`;

  if (!seller) {
    return (
      <div className="space-y-4">
        <PageTitle>Detail Produk</PageTitle>
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          Anda belum punya toko di Market ini.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageTitle>Detail Produk</PageTitle>
        <p className="text-sm text-zinc-500">Memuat…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <PageTitle>Detail Produk</PageTitle>
        <p className="text-sm text-[var(--brand-error)]">{error ?? 'Produk tidak ditemukan.'}</p>
        <Link href={backHref} className="text-sm text-[var(--brand-primary)] hover:underline">
          ← Kembali
        </Link>
      </div>
    );
  }

  const buyerInfo = product.mode_jual === 'AUCTION' ? winner : order;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle>{product.name}</PageTitle>
      <Link href={backHref} className="inline-block text-sm text-[var(--brand-primary)] hover:underline">
        ← Kembali ke {product.mode_jual === 'AUCTION' ? 'Lelang Saya' : 'Barang yang Dijual'}
      </Link>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <ProductMediaGallery
          images={product.images}
          videoUrl={product.video_url}
          model3dUrl={product.model3d_url}
          alt={product.name}
        />

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[product.status]}`}>
              {STATUS_LABEL[product.status]}
            </span>
            <span className="text-xs text-zinc-500">{product.mode_jual === 'AUCTION' ? 'Lelang' : 'Beli Langsung'}</span>
          </div>
          <p className="text-xl font-semibold text-[var(--brand-primary)]">{currencyFormatter.format(product.price)}</p>
          {product.mode_jual === 'AUCTION' && (
            <div className="space-y-1 text-sm text-zinc-600">
              <p>Buka lelang: {formatDateTime(product.auction_start_at)}</p>
              <p>Tutup lelang: {formatDateTime(product.auction_end_at)}</p>
              {product.min_increment != null && <p>Kelipatan tawar minimum: {currencyFormatter.format(product.min_increment)}</p>}
            </div>
          )}
        </div>
      </div>

      {product.status === 'sold' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">
            {product.mode_jual === 'AUCTION' ? 'Pemenang & Alamat Pengiriman' : 'Pembeli & Alamat Pengiriman'}
          </h2>
          {buyerInfoLoading ? (
            <p className="text-sm text-zinc-500">Memuat…</p>
          ) : buyerInfo ? (
            <div className="space-y-1 text-sm text-zinc-700">
              <p>
                <span className="text-zinc-500">Nama:</span> {buyerInfo.recipient_name}
              </p>
              <p>
                <span className="text-zinc-500">Telepon:</span> {buyerInfo.phone}
              </p>
              <p>
                <span className="text-zinc-500">Alamat:</span> {buyerInfo.address}
              </p>
              <p>
                <span className="text-zinc-500">Tujuan:</span>{' '}
                {buyerInfo.destination_area_name || buyerInfo.destination_area_id}
              </p>
              {'courier_code' in buyerInfo && buyerInfo.courier_code && (
                <p>
                  <span className="text-zinc-500">Kurir:</span> {buyerInfo.courier_code.toUpperCase()}
                  {buyerInfo.courier_service_name ? ` — ${buyerInfo.courier_service_name}` : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {product.mode_jual === 'AUCTION'
                ? 'Belum ada pemenang tercatat untuk produk ini.'
                : 'Belum ada data pesanan untuk produk ini.'}
            </p>
          )}
        </div>
      )}

      {fulfillment ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Progress Pengiriman</h2>
          <FulfillmentProgress marketId={marketId} productId={product.id} role="seller" />
        </div>
      ) : (
        product.status === 'sold' && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
            Belum ada data fulfillment untuk produk ini.
          </p>
        )
      )}
    </div>
  );
}
