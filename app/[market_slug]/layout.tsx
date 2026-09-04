import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getMarketBySlug } from '@/lib/api-client';
import { RealtimeProvider } from '@/components/realtime-provider';
import { AuctionNotificationWatcher } from '@/components/auction-notification-watcher';

interface MarketLayoutProps {
  params: { market_slug: string };
  children: ReactNode;
}

/**
 * `<title>` per-Market — favicon di-skip (tidak ada field logo di kontrak
 * `Market` Fase 1 ini). Pola sama seperti `bagdja-website/app/[website_slug]/layout.tsx`.
 */
export async function generateMetadata({ params }: MarketLayoutProps): Promise<Metadata> {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) return {};

  return {
    title: market.name,
  };
}

/**
 * Layout persisten per Market — TIDAK remount saat navigasi antar halaman
 * di dalam Market yang sama (cuma remount kalau `market_slug` berubah). Ini
 * yang membuat `RealtimeProvider` di bawah jadi koneksi Socket.IO SATU
 * untuk seluruh sesi browsing (bukan dibuat ulang tiap pindah halaman) —
 * lihat catatan lengkap di `components/realtime-provider.tsx`.
 *
 * `market` bisa `null` kalau slug tidak valid — di situasi itu biarkan
 * saja lolos ke `children` (halaman publik/checkout/dst masing-masing
 * sudah `notFound()` sendiri berdasarkan `getMarketBySlug` versi mereka),
 * TAPI `AuctionNotificationWatcher` (butuh `marketId` valid) di-skip.
 */
export default async function MarketLayout({ children, params }: MarketLayoutProps) {
  const market = await getMarketBySlug(params.market_slug);

  return (
    <RealtimeProvider>
      {market && <AuctionNotificationWatcher marketId={market.id} />}
      {children}
    </RealtimeProvider>
  );
}
