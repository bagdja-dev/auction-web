'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { FulfillmentProgress } from '@/components/fulfillment-progress';
import { ProductMediaGallery } from '@/components/product-media-gallery';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type { AuctionSettlement, AuctionSettlementStatus } from '@/lib/types';
import { PageTitle } from '../../_components/page-title';

interface SettlementStatusClientProps {
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  marketId: string;
  settlementId: string;
  /** Dari `?status=success|failed` (query redirect Bagdja Pay) — cuma indikator awal sebelum polling pertama selesai. */
  statusHint: 'success' | 'failed' | null;
}

const POLL_INTERVAL_MS = 3000;

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<AuctionSettlementStatus, string> = {
  PENDING_PAYMENT: 'Menunggu Pembayaran',
  HELD: 'Lunas',
};

const STATUS_BADGE_CLASS: Record<AuctionSettlementStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  HELD: 'bg-[var(--brand-success)] text-white',
};

/**
 * Fase 4 — mirror PERSIS `order-status-client.tsx` (Fase 2): fetch status
 * settlement sekali di mount, lalu POLLING tiap 3 detik selama status masih
 * `PENDING_PAYMENT` (endpoint backend sync dari escrow tiap dipanggil —
 * bukan webhook). Berhenti begitu jadi `HELD`.
 *
 * Layout (2026-09-07) disamakan dengan `listing-detail-content.tsx` — judul
 * produk + link kembali di atas, grid galeri (kiri) + card status/harga
 * (kanan), lalu card alamat & progress pengiriman di bawah — bukan lagi
 * kotak alert warna-warni bertumpuk seperti sebelumnya.
 */
export function SettlementStatusClient({ linkBase, marketId, settlementId, statusHint }: SettlementStatusClientProps) {
  const [settlement, setSettlement] = useState<AuctionSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSettlement() {
      try {
        const data = await apiClient<AuctionSettlement>(`/api/markets/${marketId}/settlements/${settlementId}`);
        if (cancelled) return;
        setSettlement(data);
        setError(null);
        if (data.status !== 'PENDING_PAYMENT' && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat status pelunasan.');
      }
    }

    fetchSettlement();
    intervalRef.current = setInterval(fetchSettlement, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [marketId, settlementId]);

  const status = settlement?.status ?? (statusHint === 'success' ? 'PENDING_PAYMENT' : null);
  const backHref = `${linkBase}/toko-saya/pesanan?mode=AUCTION`;

  if (error && !settlement) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageTitle>Status Pelunasan Lelang</PageTitle>
        <p className="text-sm text-[var(--brand-error)]">{error}</p>
        <Link href={backHref} className="inline-block text-sm text-[var(--brand-primary)] hover:underline">
          ← Kembali ke Pesanan Saya
        </Link>
      </div>
    );
  }

  if (!status || !settlement) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageTitle>Status Pelunasan Lelang</PageTitle>
        <p className="text-sm text-zinc-500">Memuat status pelunasan…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageTitle>{settlement.product?.name ?? 'Status Pelunasan Lelang'}</PageTitle>
      <Link href={backHref} className="inline-block text-sm text-[var(--brand-primary)] hover:underline">
        ← Kembali ke Pesanan Saya
      </Link>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {settlement.product && (
          <ProductMediaGallery
            images={settlement.product.images}
            videoUrl={settlement.product.video_url}
            model3dUrl={settlement.product.model3d_url}
            alt={settlement.product.name}
          />
        )}

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <p className="text-xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(settlement.total_amount)}
          </p>
          <div className="space-y-1 text-sm text-zinc-600">
            <p>Harga final: {currencyFormatter.format(settlement.final_amount)}</p>
            <p>Deposit sudah dibayar: {currencyFormatter.format(settlement.deposit_amount)}</p>
            {settlement.courier_code && (
              <p>
                Kurir: {settlement.courier_code.toUpperCase()}
                {settlement.courier_service_name ? ` — ${settlement.courier_service_name}` : ''}
              </p>
            )}
            <p>Ongkir: {currencyFormatter.format(settlement.shipping_cost)}</p>
          </div>
          {status === 'PENDING_PAYMENT' ? (
            <p className="pt-1 text-sm text-amber-700">
              Menunggu pembayaran — halaman ini otomatis memperbarui status begitu pembayaran Anda
              dikonfirmasi.
              {statusHint === 'failed' && ' Kalau Anda baru saja membatalkan pembayaran, coba lagi dari halaman produk.'}
            </p>
          ) : (
            <p className="pt-1 text-sm text-green-700">
              Pelunasan berhasil — dana ditahan di escrow, barang akan segera dikirim seller.
            </p>
          )}
        </div>
      </div>

      {/* `recipient_name` dkk cuma terisi kalau Market requires_registration=false
          (alamat dikumpulkan saat pelunasan, bukan saat registrasi — lihat
          `CreateSettlementDto`) — Market default (requires_registration=true)
          tidak perlu tampilkan ini lagi, buyer sudah tahu alamatnya sendiri
          dari saat registrasi. */}
      {status === 'HELD' && settlement.recipient_name && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Alamat Pengiriman</h2>
          <div className="space-y-1 text-sm text-zinc-700">
            <p>
              <span className="text-zinc-500">Penerima:</span> {settlement.recipient_name}
            </p>
            <p>
              <span className="text-zinc-500">Telepon:</span> {settlement.phone}
            </p>
            <p>
              <span className="text-zinc-500">Alamat:</span> {settlement.address}
            </p>
            <p>
              <span className="text-zinc-500">Tujuan:</span>{' '}
              {settlement.destination_area_name || settlement.destination_area_id}
            </p>
          </div>
        </div>
      )}

      {status === 'HELD' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Progress Pengiriman</h2>
          <FulfillmentProgress marketId={marketId} productId={settlement.product_id} role="buyer" />
        </div>
      )}
    </div>
  );
}
