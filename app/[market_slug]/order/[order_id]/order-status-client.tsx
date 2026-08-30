'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Order } from '@/lib/types';

interface OrderStatusClientProps {
  marketSlug: string;
  marketId: string;
  orderId: string;
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
 * Fetch status order sekali di mount, lalu POLLING tiap 3 detik selama
 * status masih `PENDING_PAYMENT` (endpoint backend sync dari escrow tiap
 * dipanggil — bukan webhook). Berhenti begitu jadi `HELD`/`FAILED`.
 */
export function OrderStatusClient({ marketSlug, marketId, orderId, statusHint }: OrderStatusClientProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      try {
        const data = await apiClient<Order>(`/api/markets/${marketId}/orders/${orderId}`);
        if (cancelled) return;
        setOrder(data);
        setError(null);
        if (data.status !== 'PENDING_PAYMENT' && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat status pesanan.');
      }
    }

    fetchOrder();
    intervalRef.current = setInterval(fetchOrder, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [marketId, orderId]);

  if (error && !order) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-[var(--brand-error)]">
        {error}
      </div>
    );
  }

  const status = order?.status ?? (statusHint === 'success' ? 'PENDING_PAYMENT' : statusHint === 'failed' ? 'FAILED' : null);

  if (!status) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Memuat status pesanan…
      </div>
    );
  }

  if (status === 'PENDING_PAYMENT') {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Menunggu pembayaran…</p>
        <p className="text-sm text-amber-700">
          Halaman ini akan otomatis memperbarui status begitu pembayaran Anda dikonfirmasi.
        </p>
      </div>
    );
  }

  if (status === 'HELD') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Pembayaran berhasil!</p>
          <p className="mt-1 text-sm text-green-700">
            Dana ditahan di escrow, produk sudah jadi milik Anda.
          </p>
        </div>
        {order && (
          <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>
              <span className="text-zinc-500">Total:</span>{' '}
              {currencyFormatter.format(order.total_amount)}
            </p>
            <p>
              <span className="text-zinc-500">Penerima:</span> {order.recipient_name}
            </p>
            <p>
              <span className="text-zinc-500">Telepon:</span> {order.phone}
            </p>
            <p>
              <span className="text-zinc-500">Alamat:</span> {order.address}
            </p>
            {order.courier && (
              <p>
                <span className="text-zinc-500">Kurir:</span> {order.courier}
              </p>
            )}
          </div>
        )}
        <Link
          href={`/${marketSlug}`}
          className="inline-block text-sm text-[var(--brand-primary)] hover:underline"
        >
          ← Kembali ke katalog
        </Link>
      </div>
    );
  }

  // status === 'FAILED'
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-[var(--brand-error)]">Pembayaran gagal.</p>
        <p className="mt-1 text-sm text-red-700">Silakan coba lagi dari halaman produk.</p>
      </div>
      <Link
        href={`/${marketSlug}`}
        className="inline-block text-sm text-[var(--brand-primary)] hover:underline"
      >
        ← Kembali ke katalog
      </Link>
    </div>
  );
}
