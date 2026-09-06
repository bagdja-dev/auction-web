'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/proxy-client';
import type { Product, WalletBalance } from '@/lib/types';
import { useTokoSaya } from './toko-saya-context';
import { CreateShopModal } from './create-shop-modal';
import { OrderIcon, ProductIcon, SettingsIcon } from './icons';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/**
 * Dashboard home Toko Saya — di mobile ini juga jadi HALAMAN NAVIGASI utama
 * (grid ikon menu di bawah, `md:hidden`) karena tidak ada sidebar di layar
 * kecil. Di desktop, grid ikon ini disembunyikan karena sudah ada sidebar.
 *
 * Layout SELALU utuh (saldo + stats + menu) — polish 31 Agustus 2026 (revisi
 * kedua): percobaan pertama mengganti SELURUH dashboard dengan card CTA
 * kalau belum ada toko ternyata bukan yang diminta user — yang benar cuma
 * bagian IDENTITAS TOKO (nama+status) yang berubah jadi "Belum ada toko" +
 * tombol "Buat Toko", sisanya (saldo, stats, menu) tetap tampil seperti
 * biasa.
 */
export default function DashboardContent() {
  const { marketId, linkBase, seller, registering, registerError } = useTokoSaya();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [showCreateShopModal, setShowCreateShopModal] = useState(false);

  // Saldo itu wallet PERSONAL (per userId login, sama seperti seluruh
  // platform Bagdja lainnya) — BUKAN milik toko, jadi tetap di-fetch walau
  // belum ada toko sama sekali (beda dari revisi pertama yang salah
  // menyamakan ini dengan data yang scoped-ke-toko).
  useEffect(() => {
    let cancelled = false;
    apiClient<WalletBalance>('/api/wallet/balance')
      .then((data) => !cancelled && setWallet(data))
      .catch(() => !cancelled && setWalletError('Gagal memuat saldo.'));
    return () => {
      cancelled = true;
    };
  }, []);

  // Produk BENAR scoped ke toko (`SellerOwnershipGuard` di backend) — kalau
  // belum ada toko, langsung anggap kosong (stats semua 0) tanpa panggil
  // API sama sekali, bukan `null` selamanya (yang bikin UI stuck di "—").
  useEffect(() => {
    if (!seller) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    apiClient<Product[]>(`/api/markets/${marketId}/products/mine`)
      .then((data) => !cancelled && setProducts(data))
      .catch(() => {
        /* statistik cukup diam kalau gagal, bukan bagian kritis halaman ini */
      });
    return () => {
      cancelled = true;
    };
  }, [marketId, seller]);

  const stats = {
    total: products?.length ?? 0,
    draft: products?.filter((p) => p.status === 'draft').length ?? 0,
    published: products?.filter((p) => p.status === 'published').length ?? 0,
    sold: products?.filter((p) => p.status === 'sold').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <section>
        {seller ? (
          <>
            <h1 className="text-lg font-semibold text-zinc-900">
              {seller.shop_name || 'Toko tanpa nama'}
            </h1>
            <p className="text-sm text-zinc-500">Status: {seller.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Belum ada toko</h1>
              <p className="text-sm text-zinc-500">Buat toko dulu untuk mulai berjualan di Market ini.</p>
              {registerError && <p className="mt-1 text-sm text-[var(--brand-error)]">{registerError}</p>}
            </div>
            <button
              type="button"
              onClick={() => setShowCreateShopModal(true)}
              disabled={registering}
              className="shrink-0 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {registering ? 'Membuat…' : 'Buat Toko'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Saldo</p>
            {walletError ? (
              <p className="mt-1 text-sm text-[var(--brand-error)]">{walletError}</p>
            ) : wallet ? (
              <>
                <p className="mt-1 text-2xl font-semibold text-[var(--brand-primary)]">
                  {currencyFormatter.format(wallet.balance)}
                </p>
                {wallet.held_balance > 0 && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    + {currencyFormatter.format(wallet.held_balance)} tertahan di escrow
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">Memuat…</p>
            )}
          </div>
          <Link
            href={`${linkBase}/toko-saya/wallet`}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Detail Wallet
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Produk', value: stats.total },
          { label: 'Draft', value: stats.draft },
          { label: 'Dipublikasikan', value: stats.published },
          { label: 'Terjual', value: stats.sold },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xl font-semibold text-zinc-900">
              {products === null ? '—' : stat.value}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Grid ikon menu — cuma tampil di mobile (<md), desktop sudah punya sidebar */}
      <section className="grid grid-cols-2 gap-3 md:hidden">
        <Link
          href={`${linkBase}/toko-saya/toko`}
          className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm transition hover:border-[var(--brand-primary)]"
        >
          <ProductIcon className="h-6 w-6 text-[var(--brand-primary)]" />
          <span className="text-sm font-medium text-zinc-700">Toko Saya</span>
        </Link>
        <Link
          href={`${linkBase}/toko-saya/pesanan`}
          className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm transition hover:border-[var(--brand-primary)]"
        >
          <OrderIcon className="h-6 w-6 text-[var(--brand-primary)]" />
          <span className="text-sm font-medium text-zinc-700">Pesanan Saya</span>
        </Link>
        <Link
          href={`${linkBase}/toko-saya/pengaturan`}
          className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm transition hover:border-[var(--brand-primary)]"
        >
          <SettingsIcon className="h-6 w-6 text-[var(--brand-primary)]" />
          <span className="text-sm font-medium text-zinc-700">Pengaturan Toko</span>
        </Link>
      </section>

      <CreateShopModal open={showCreateShopModal} onClose={() => setShowCreateShopModal(false)} />
    </div>
  );
}
