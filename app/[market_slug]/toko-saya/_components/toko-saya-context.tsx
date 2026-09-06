'use client';

import { createContext, useContext } from 'react';

import type { RegisterSellerPayload, Seller } from '@/lib/types';

export interface TokoSayaContextValue {
  marketId: string;
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  marketName: string;
  /** `false` = auction_start_at opsional saat publish — dipakai `ProductFormModal` untuk sembunyikan input tanggal mulai di balik checkbox. */
  requiresScheduledStart: boolean;
  /**
   * Batas panjang teks description produk (setelah HTML di-strip), diatur
   * per-Market lewat Market Settings — dulu hardcode 500 minimum tanpa batas
   * maksimum di `ProductFormModal`, sekarang dinamis (0 = tidak ada batas
   * minimum, `max` `null` = tidak ada batas maksimum). WAJIB dipakai form,
   * BUKAN konstanta lokal — kalau tidak, tombol submit bisa disabled keliru
   * (Market sudah longgarkan batasnya tapi form masih blokir pakai angka lama).
   */
  minDescriptionLength: number;
  maxDescriptionLength: number | null;
  /**
   * `null` = user login tapi BELUM daftar toko di Market ini (polish 31
   * Agustus 2026 — dashboard tetap bisa diakses dalam kondisi ini, tombol
   * "Buat Toko" ada di `DashboardContent`, BUKAN gate full-page yang blokir
   * seluruh `/toko-saya/*` seperti sebelumnya). Konsumen (`produk`,
   * `pengaturan`) WAJIB cek `null` sendiri sebelum pakai field `seller.*`.
   */
  seller: Seller | null;
  refreshSeller: () => Promise<void>;
  /** `true` = berhasil (dipakai `CreateShopModal` untuk auto-close popup). */
  registerSeller: (payload: RegisterSellerPayload) => Promise<boolean>;
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
