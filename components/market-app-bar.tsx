import type { ReactNode } from 'react';

import { AccountBadge } from '@/components/account-badge';

/**
 * App bar Market — diekstrak dari markup `<header>` yang SEBELUMNYA
 * diduplikasi persis di `catalog-view.tsx` (template `default` & `grand`,
 * cuma beda warna/tebal border), dan SEBELUMNYA tidak pernah dipasang di
 * halaman detail produk sama sekali (permintaan user 31 Agustus 2026:
 * pertahankan app bar yang sama di halaman detail — back-to-market di kiri,
 * badge akun di kanan).
 *
 * Slot kiri (`left`) fleksibel per halaman — katalog isi nama Market
 * (bukan link, sudah di halaman itu), detail isi link "← Kembali" ke
 * katalog. Slot kanan SELALU `AccountBadge` (avatar+nama+dropdown, polish
 * 31 Agustus 2026 — SEBELUMNYA tombol "Toko Saya" mentah, diganti supaya
 * konsisten dgn badge akun yang sudah ada di `toko-saya-shell.tsx`).
 *
 * Server-safe (tidak ada hook client di FILE INI — `AccountBadge` sendiri
 * yang 'use client', diimpor sbg child) — dipakai baik dari server
 * component (`catalog-view.tsx`) maupun client component
 * (`product-detail-view.tsx`).
 */
export interface MarketAppBarProps {
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  isLoggedIn: boolean;
  /** Username/email user login — diteruskan apa adanya ke `AccountBadge`. */
  displayName?: string;
  left: ReactNode;
  /** Border bawah beda per template katalog (`default` vs `grand`) — default cocok utk halaman detail (template tunggal, tidak ikut sistem `template_id`). */
  borderClassName?: string;
}

export function MarketAppBar({
  linkBase,
  isLoggedIn,
  displayName,
  left,
  borderClassName = 'border-b border-zinc-200',
}: MarketAppBarProps) {
  return (
    <header
      className={`sticky top-0 z-10 mb-8 flex flex-wrap items-center justify-between gap-4 bg-white pb-6 pt-4 ${borderClassName}`}
    >
      {left}
      <AccountBadge linkBase={linkBase} isLoggedIn={isLoggedIn} displayName={displayName} />
    </header>
  );
}
