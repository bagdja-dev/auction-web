'use client';

import { useState } from 'react';

import { ModeListingManager } from '../_components/mode-listing-manager';
import { ModePurchasesList } from '../_components/mode-purchases-list';
import { RoleTabs } from '../_components/role-tabs';

type Tab = 'SELLING' | 'FOLLOWING';

const TABS: { key: Tab; label: string }[] = [
  { key: 'SELLING', label: 'Lelang Saya' },
  { key: 'FOLLOWING', label: 'Lelang yang Diikuti' },
];

/**
 * Menu "Lelang" (restrukturisasi Dashboard per mode jual, gantikan sebagian
 * "Produk Saya"/"Pesanan"/"Pembelian Saya" lama untuk mode AUCTION) — 2 tab:
 * "Lelang Saya" (jual, sisi seller) dan "Lelang yang Diikuti" (ikut lelang,
 * sisi buyer). Disiapkan supaya kalau nanti ada aturan verifikasi barang
 * sebelum lelang tayang, status tahapannya bisa dipantau langsung di tab
 * "Lelang Saya" per produk.
 */
export default function LelangContent() {
  const [tab, setTab] = useState<Tab>('SELLING');

  return (
    <div className="space-y-4">
      <RoleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'SELLING' ? (
        <ModeListingManager modeJual="AUCTION" title="Lelang Saya" />
      ) : (
        <ModePurchasesList modeJual="AUCTION" title="Lelang yang Diikuti" />
      )}
    </div>
  );
}
