'use client';

import { useEffect, useState } from 'react';

import type { ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { apiClient } from '@/lib/proxy-client';
import type { SellersMeResponse } from '@/lib/types';

export interface SellerAddressPrefill {
  address: string | null;
  shippingArea: ShippingAreaSelection | null;
}

const EMPTY: SellerAddressPrefill = { address: null, shippingArea: null };

/**
 * Prefill alamat asal/tujuan pengiriman dari alamat toko user (kalau dia
 * JUGA terdaftar sebagai seller di Market yang sama) — permintaan
 * 2026-09-07: "kalau alamat toko sudah diisi, alamat pengiriman/tujuan
 * otomatis terisi" saat create produk (asal) maupun checkout/registrasi/
 * pelunasan (tujuan) — supaya user yang sekaligus jual-beli tidak perlu
 * ngetik ulang alamat yang sama.
 *
 * `null`/kosong kalau user belum terdaftar seller di Market ini, atau sudah
 * terdaftar tapi belum isi alamat tokonya — form pemanggil tetap kosong
 * seperti sebelumnya (bukan blocking, gagal fetch cukup diam).
 */
export function useSellerAddressPrefill(marketId: string): SellerAddressPrefill {
  const [result, setResult] = useState<SellerAddressPrefill>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    apiClient<SellersMeResponse>(`/api/markets/${marketId}/sellers/me`)
      .then((data) => {
        if (cancelled || !data.seller) return;
        setResult({
          address: data.seller.address,
          shippingArea: data.seller.shipping_area_id
            ? { providerAreaId: data.seller.shipping_area_id, name: data.seller.shipping_area_name ?? '' }
            : null,
        });
      })
      .catch(() => {
        // Non-kritis — gagal fetch cukup diam, form tetap kosong (perilaku lama).
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  return result;
}
