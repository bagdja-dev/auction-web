'use client';

import { useState } from 'react';

import { ModeListingManager } from '../_components/mode-listing-manager';
import { ModePurchasesList } from '../_components/mode-purchases-list';
import { RoleTabs } from '../_components/role-tabs';

type Tab = 'SELLING' | 'BOUGHT';

const TABS: { key: Tab; label: string }[] = [
  { key: 'SELLING', label: 'Barang yang Dijual' },
  { key: 'BOUGHT', label: 'Barang yang Dibeli' },
];

/**
 * Menu "Beli Langsung" (restrukturisasi Dashboard per mode jual, gantikan
 * sebagian "Produk Saya"/"Pesanan"/"Pembelian Saya" lama untuk mode
 * DIRECT_SELL) — 2 tab: "Barang yang Dijual" (jual, sisi seller) dan
 * "Barang yang Dibeli" (beli, sisi buyer), pola sama `lelang-content.tsx`.
 */
export default function BeliLangsungContent() {
  const [tab, setTab] = useState<Tab>('SELLING');

  return (
    <div className="space-y-4">
      <RoleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'SELLING' ? (
        <ModeListingManager modeJual="DIRECT_SELL" title="Barang yang Dijual" />
      ) : (
        <ModePurchasesList modeJual="DIRECT_SELL" title="Barang yang Dibeli" />
      )}
    </div>
  );
}
