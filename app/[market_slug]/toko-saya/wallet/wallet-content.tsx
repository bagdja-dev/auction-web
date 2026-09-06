'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import { formatWalletTransactionType } from '@/lib/wallet-transaction-labels';
import type { WalletBalance, WalletTransaction, WalletTransactionsResponse } from '@/lib/types';
import { PageTitle } from '../_components/page-title';

const PAGE_SIZE = 20;

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * "Detail Wallet" — riwayat mutasi saldo (topup, rilis escrow, refund
 * deposit kalah lelang, potongan platform, dll), dibuka dari tombol
 * "Detail Wallet" di kartu Saldo Dashboard. Wallet PERSONAL per-userId
 * (sama seperti seluruh platform Bagdja, BUKAN scoped ke Market ini) —
 * halaman ini tetap dibungkus di dalam Dashboard "Toko Saya" murni untuk
 * konsistensi shell (topbar+sidebar+back button), bukan karena datanya
 * terkait Market. Backend `GET /api/wallet/transactions` proxy ke
 * `bagdja-payment-service` (`GET /payments/transactions`), pola di-port
 * dari `bagdja-website-api` yang sudah lebih dulu punya fitur ini.
 *
 * Layout header-tetap + list-scroll-sendiri (bukan `position: sticky`) —
 * root `h-full flex-col`: blok saldo+judul `shrink-0` (tidak ikut scroll
 * sama sekali), daftar transaksi `flex-1 overflow-y-auto` (kotak sendiri,
 * tingginya = sisa layar setelah header, BUKAN halaman `<main>` Dashboard
 * yang ikut scroll). `<main>` di `toko-saya-shell.tsx` py sudah py flex-1
 * di dalam `h-screen` — punya tinggi pasti, jadi `h-full` di sini valid
 * resolve terhadap itu, TIDAK butuh ubah shell. Infinite scroll (bukan
 * tombol Sebelumnya/Berikutnya) via `IntersectionObserver` di sentinel
 * paling bawah list, `root` di-set ke kotak scroll itu sendiri.
 */
export default function WalletContent() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiClient<WalletBalance>('/api/wallet/balance')
      .then((data) => !cancelled && setBalance(data))
      .catch(() => !cancelled && setBalanceError('Gagal memuat saldo.'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat awal (halaman 1, GANTI seluruh list) — terpisah dari "muat lagi"
  // (append) supaya effect ini bisa punya deps kosong (jalan sekali).
  useEffect(() => {
    let cancelled = false;
    setLoadingInitial(true);
    apiClient<WalletTransactionsResponse>(`/api/wallet/transactions?page=1&size=${PAGE_SIZE}`)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setPage(res.meta.currentPage);
        setTotalPages(res.meta.totalPages);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat transaksi.');
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (totalPages != null && page >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await apiClient<WalletTransactionsResponse>(
        `/api/wallet/transactions?page=${nextPage}&size=${PAGE_SIZE}`,
      );
      setItems((prev) => [...prev, ...res.data]);
      setPage(res.meta.currentPage);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat transaksi.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (loadingInitial) return;
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingInitial, loadMore]);

  const hasMore = totalPages == null || page < totalPages;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div className="shrink-0 space-y-4 pb-4">
        <PageTitle>Wallet</PageTitle>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Saldo</p>
          {balanceError ? (
            <p className="mt-1 text-sm text-[var(--brand-error)]">{balanceError}</p>
          ) : balance ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-[var(--brand-primary)]">
                {currencyFormatter.format(balance.balance)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                + {currencyFormatter.format(balance.held_balance)} tertahan
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">Memuat…</p>
          )}
        </div>

        <h2 className="text-sm font-semibold text-zinc-700">Riwayat Transaksi</h2>
        {loadError && <p className="text-sm text-[var(--brand-error)]">{loadError}</p>}
      </div>

      {loadingInitial ? (
        <p className="text-sm text-zinc-500">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Belum ada riwayat transaksi.
        </p>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="divide-y divide-zinc-100">
            {items.map((tx) => {
              const isCredit = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{formatWalletTransactionType(tx.type)}</p>
                    {tx.description && <p className="truncate text-xs text-zinc-500">{tx.description}</p>}
                    <p className="text-xs text-zinc-400">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      isCredit ? 'text-[var(--brand-success)]' : 'text-[var(--brand-error)]'
                    }`}
                  >
                    {isCredit ? '+' : ''}
                    {currencyFormatter.format(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="p-4 text-center text-xs text-zinc-400">
              {loadingMore ? 'Memuat lagi…' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
