'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { FulfillmentProgress } from '@/components/fulfillment-progress';
import { ProductMediaGallery } from '@/components/product-media-gallery';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type { AuctionSettlement } from '@/lib/types';
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

/**
 * Fase 4 — mirror PERSIS `order-status-client.tsx` (Fase 2): fetch status
 * settlement sekali di mount, lalu POLLING tiap 3 detik selama status masih
 * `PENDING_PAYMENT` (endpoint backend sync dari escrow tiap dipanggil —
 * bukan webhook). Berhenti begitu jadi `HELD`.
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

  // Satu titik return, pola sama `order-status-client.tsx` — `<PageTitle>`
  // ditulis SEKALI di sini, bukan diulang di tiap cabang status.
  let body: React.ReactNode;

  if (error && !settlement) {
    body = (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-[var(--brand-error)]">{error}</div>
    );
  } else if (!status) {
    body = (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Memuat status pelunasan…
      </div>
    );
  } else if (status === 'PENDING_PAYMENT') {
    body = (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Menunggu pembayaran…</p>
        <p className="text-sm text-amber-700">
          Halaman ini akan otomatis memperbarui status begitu pembayaran Anda dikonfirmasi.
          {statusHint === 'failed' && ' Kalau Anda baru saja membatalkan pembayaran, coba lagi dari halaman produk.'}
        </p>
      </div>
    );
  } else {
    // status === 'HELD'
    body = (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Pelunasan berhasil!</p>
          <p className="mt-1 text-sm text-green-700">Dana ditahan di escrow — barang akan segera dikirim seller.</p>
        </div>
        {settlement?.product && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700">{settlement.product.name}</h2>
            <ProductMediaGallery
              images={settlement.product.images}
              videoUrl={settlement.product.video_url}
              model3dUrl={settlement.product.model3d_url}
              alt={settlement.product.name}
            />
          </div>
        )}
        {settlement && (
          <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>
              <span className="text-zinc-500">Harga final:</span> {currencyFormatter.format(settlement.final_amount)}
            </p>
            <p>
              <span className="text-zinc-500">Deposit sudah dibayar:</span>{' '}
              {currencyFormatter.format(settlement.deposit_amount)}
            </p>
            <p>
              <span className="text-zinc-500">Dibayar sekarang:</span>{' '}
              {currencyFormatter.format(settlement.total_amount)}
            </p>
          </div>
        )}
        {settlement && <FulfillmentProgress marketId={marketId} productId={settlement.product_id} role="buyer" />}
        <Link
          href={`${linkBase}/toko-saya`}
          className="inline-block text-sm text-[var(--brand-primary)] hover:underline"
        >
          ← Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle>Status Pelunasan Lelang</PageTitle>
      {body}
    </div>
  );
}
