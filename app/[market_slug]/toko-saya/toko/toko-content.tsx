'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { ModeListingManager } from '../_components/mode-listing-manager';
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
 * Menu "Toko Saya" (restrukturisasi 2026-09-07 — dulu pengelompokan per MODE
 * jual dengan tab dalam per role di `lelang-content.tsx`/`beli-langsung-content.tsx`;
 * sekarang dibalik: pengelompokan per ROLE — halaman ini KHUSUS sisi seller
 * — tab dalam berdasarkan mode jual). Tab disinkronkan ke query `?mode=`
 * (bukan cuma local state) supaya tombol "kembali" dari halaman detail
 * listing (`listing-detail-content.tsx`) bisa mendarat di tab yang benar
 * sesuai mode produk asal, bukan selalu tab default.
 */
export default function TokoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { linkBase } = useTokoSaya();
  const tab = parseTab(searchParams.get('mode'));

  function setTab(next: Tab) {
    router.replace(`${linkBase}/toko-saya/toko?mode=${next}`);
  }

  return (
    <div className="space-y-4">
      <TabSwitcher tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'AUCTION' ? (
        <ModeListingManager modeJual="AUCTION" title="Lelang Saya" />
      ) : (
        <ModeListingManager modeJual="DIRECT_SELL" title="Barang yang Dijual" />
      )}
    </div>
  );
}
