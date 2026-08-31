'use client';

import { createContext, useContext } from 'react';

import type { Seller } from '@/lib/types';

export interface TokoSayaContextValue {
  marketId: string;
  marketSlug: string;
  marketName: string;
  /**
   * `null` = user login tapi BELUM daftar toko di Market ini (polish 31
   * Agustus 2026 — dashboard tetap bisa diakses dalam kondisi ini, tombol
   * "Buat Toko" ada di `DashboardContent`, BUKAN gate full-page yang blokir
   * seluruh `/toko-saya/*` seperti sebelumnya). Konsumen (`produk`,
   * `pengaturan`) WAJIB cek `null` sendiri sebelum pakai field `seller.*`.
   */
  seller: Seller | null;
  refreshSeller: () => Promise<void>;
  registerSeller: (shopName?: string) => Promise<void>;
  registering: boolean;
  registerError: string | null;
}

const TokoSayaContext = createContext<TokoSayaContextValue | null>(null);

export const TokoSayaProvider = TokoSayaContext.Provider;

/** Dipakai halaman Dashboard/Produk/Pengaturan — HARUS dirender di dalam TokoSayaShell. `seller` BISA `null` (belum daftar toko), lihat komentar di atas. */
export function useTokoSaya(): TokoSayaContextValue {
  const ctx = useContext(TokoSayaContext);
  if (!ctx) {
    throw new Error('useTokoSaya must be used within TokoSayaShell');
  }
  return ctx;
}
