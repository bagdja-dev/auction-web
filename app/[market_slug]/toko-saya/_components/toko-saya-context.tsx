'use client';

import { createContext, useContext } from 'react';

import type { Seller } from '@/lib/types';

export interface TokoSayaContextValue {
  marketId: string;
  marketSlug: string;
  marketName: string;
  seller: Seller;
  refreshSeller: () => Promise<void>;
}

const TokoSayaContext = createContext<TokoSayaContextValue | null>(null);

export const TokoSayaProvider = TokoSayaContext.Provider;

/** Dipakai halaman Dashboard/Produk/Pengaturan — HARUS dirender di dalam TokoSayaShell (seller sudah pasti terdaftar di titik ini). */
export function useTokoSaya(): TokoSayaContextValue {
  const ctx = useContext(TokoSayaContext);
  if (!ctx) {
    throw new Error('useTokoSaya must be used within TokoSayaShell');
  }
  return ctx;
}
