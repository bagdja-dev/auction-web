'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { ModePurchasesList } from '../_components/mode-purchases-list';
import { TabSwitcher } from '../_components/tab-switcher';
import { useTokoSaya } from '../_components/toko-saya-context';

type Tab = 'AUCTION' | 'DIRECT_SELL';

const TABS: { key: Tab; label: string }[] = [
  { key: 'AUCTION', label: 'Lelang' },
  { key: 'DIRECT_SELL', label: 'Beli Langsung' },
];

function parseTab(value: string | null): Tab {
  return value === 'DIRECT_SELL' ? 'DIRECT_SELL' : 'AUCTION';
}

/**
 * Menu "Pesanan Saya" (restrukturisasi 2026-09-07, pasangan `toko-content.tsx`
 * — lihat catatan di sana) — KHUSUS sisi buyer, tab dalam berdasarkan mode
 * jual. Tab disinkronkan ke query `?mode=`, pola sama `toko-content.tsx`.
 */
export default function PesananContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { linkBase } = useTokoSaya();
  const tab = parseTab(searchParams.get('mode'));

  function setTab(next: Tab) {
    router.replace(`${linkBase}/toko-saya/pesanan?mode=${next}`);
  }

  return (
    <div className="space-y-4">
      <TabSwitcher tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'AUCTION' ? (
        <ModePurchasesList modeJual="AUCTION" title="Lelang yang Diikuti" />
      ) : (
        <ModePurchasesList modeJual="DIRECT_SELL" title="Barang yang Dibeli" />
      )}
    </div>
  );
}
