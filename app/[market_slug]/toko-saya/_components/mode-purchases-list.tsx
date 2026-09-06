'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { PurchaseCategory, PurchaseRow, ProductModeJual } from '@/lib/types';
import { useTokoSaya } from './toko-saya-context';
import { PageTitle } from './page-title';

interface ModePurchasesListProps {
  modeJual: ProductModeJual;
  title: string;
}

type FilterTab = 'ALL' | 'ACTION_NEEDED' | 'ONGOING' | 'DONE';

const FILTER_TABS: { key: FilterTab; label: string; categories: PurchaseCategory[] | null }[] = [
  { key: 'ALL', label: 'Semua', categories: null },
  {
    key: 'ACTION_NEEDED',
    label: 'Perlu Dibayar',
    categories: ['AWAITING_DEPOSIT', 'AWAITING_PAYMENT', 'AWAITING_SETTLEMENT'],
  },
  { key: 'ONGOING', label: 'Berjalan', categories: ['ONGOING_AUCTION', 'IN_FULFILLMENT'] },
  { key: 'DONE', label: 'Selesai & Riwayat', categories: ['COMPLETED', 'LOST', 'FORFEITED', 'FAILED'] },
];

const CATEGORY_LABEL: Record<PurchaseCategory, string> = {
  AWAITING_DEPOSIT: 'Menunggu Pembayaran Deposit',
  ONGOING_AUCTION: 'Sedang Mengikuti Lelang',
  AWAITING_PAYMENT: 'Menunggu Pembayaran',
  AWAITING_SETTLEMENT: 'Menang — Menunggu Pelunasan',
  IN_FULFILLMENT: 'Dalam Proses Pengiriman',
  COMPLETED: 'Selesai',
  LOST: 'Kalah Lelang',
  FORFEITED: 'Deposit Hangus (Telat Lunas)',
  FAILED: 'Pembayaran Gagal',
};

const CATEGORY_BADGE_CLASS: Record<PurchaseCategory, string> = {
  AWAITING_DEPOSIT: 'bg-amber-100 text-amber-700',
  ONGOING_AUCTION: 'bg-blue-100 text-blue-700',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-700',
  AWAITING_SETTLEMENT: 'bg-amber-100 text-amber-700',
  IN_FULFILLMENT: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-[var(--brand-success)] text-white',
  LOST: 'bg-zinc-100 text-zinc-600',
  FORFEITED: 'bg-red-100 text-red-700',
  FAILED: 'bg-red-100 text-red-700',
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function ctaFor(row: PurchaseRow, linkBase: string): { label: string; href: string } | null {
  // `?from=dashboard` dibaca `product-detail-view.tsx` supaya halaman detail
  // produk yang dibuka dari sini punya tombol "Kembali ke Dashboard".
  const productHref = `${linkBase}/products/${row.product_slug}?from=dashboard`;

  switch (row.category) {
    case 'AWAITING_DEPOSIT':
      return { label: 'Lanjutkan Pembayaran', href: row.checkout_url ?? productHref };
    case 'ONGOING_AUCTION':
      return { label: 'Lihat Lelang', href: productHref };
    case 'AWAITING_PAYMENT':
      return {
        label: row.checkout_url ? 'Lanjutkan Pembayaran' : 'Lihat Pesanan',
        href: row.checkout_url ?? `${linkBase}/toko-saya/order/${row.order_id}`,
      };
    case 'AWAITING_SETTLEMENT':
      return {
        label: row.checkout_url ? 'Lanjutkan Pelunasan' : 'Lihat Status',
        href: row.checkout_url ?? `${linkBase}/toko-saya/settlement/${row.settlement_id}`,
      };
    case 'IN_FULFILLMENT':
    case 'COMPLETED':
      return {
        label: row.category === 'COMPLETED' ? 'Lihat Detail' : 'Lihat Progress Pengiriman',
        href: row.settlement_id
          ? `${linkBase}/toko-saya/settlement/${row.settlement_id}`
          : row.order_id
            ? `${linkBase}/toko-saya/order/${row.order_id}`
            : productHref,
      };
    case 'FAILED':
      return { label: 'Coba Lagi', href: productHref };
    case 'LOST':
    case 'FORFEITED':
      return { label: 'Lihat Produk', href: productHref };
    default:
      return null;
  }
}

/**
 * Sisi BUYER menu "Lelang"/"Beli Langsung" (restrukturisasi Dashboard per
 * mode jual) — sebelumnya "Pembelian Saya" tunggal berisi kedua mode
 * campur (dengan badge mode per baris); sekarang di-split jadi dua
 * instance komponen ini, satu per `modeJual`. Badge mode DIHAPUS dari
 * baris (redundan — tab tempatnya sudah menyatakan mode). Backend tetap
 * satu endpoint `purchases/mine` yang sama (balas SEMUA mode), filter
 * `row.mode_jual === modeJual` dilakukan di sini.
 */
export function ModePurchasesList({ modeJual, title }: ModePurchasesListProps) {
  const { marketId, linkBase } = useTokoSaya();

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient<PurchaseRow[]>(`/api/markets/${marketId}/purchases/mine`)
      .then((data) => {
        if (!cancelled) setRows(data.filter((r) => r.mode_jual === modeJual));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar pembelian.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marketId, modeJual]);

  const activeCategories = FILTER_TABS.find((t) => t.key === activeTab)?.categories ?? null;
  const filteredRows = activeCategories ? rows.filter((r) => activeCategories.includes(r.category)) : rows;

  return (
    <div className="space-y-4">
      <PageTitle>{title}</PageTitle>

      {loading ? (
        <p className="text-sm text-zinc-500">Memuat daftar pembelian…</p>
      ) : error ? (
        <p className="text-sm text-[var(--brand-error)]">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Belum ada yang Anda ikuti/beli di Market ini.
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Tidak ada item di kategori ini.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredRows.map((row) => {
                const cta = ctaFor(row, linkBase);
                return (
                  <div
                    key={row.product_id}
                    className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="aspect-square w-full bg-zinc-100">
                      {row.product_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.product_image} alt={row.product_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          Tidak ada gambar
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{row.product_name}</h3>
                      </div>
                      <span
                        className={`inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_BADGE_CLASS[row.category]}`}
                      >
                        {CATEGORY_LABEL[row.category]}
                      </span>
                      <p className="text-sm font-semibold text-[var(--brand-primary)]">
                        {currencyFormatter.format(row.amount)}
                      </p>

                      {cta && (
                        <div className="mt-auto pt-2">
                          <Link
                            href={cta.href}
                            className="block w-full rounded-md bg-[var(--brand-primary)] px-2.5 py-1.5 text-center text-xs font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
                          >
                            {cta.label}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
