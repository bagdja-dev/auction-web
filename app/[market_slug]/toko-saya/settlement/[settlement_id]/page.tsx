import { notFound } from 'next/navigation';

import { getMarketBySlug } from '@/lib/api-client';
import { SettlementStatusClient } from './settlement-status-client';

interface SettlementStatusPageProps {
  params: { market_slug: string; settlement_id: string };
  searchParams: { status?: string };
}

export const metadata = { title: 'Status Pelunasan Lelang · Toko Saya' };

function parseStatusHint(value: string | undefined): 'success' | 'failed' | null {
  return value === 'success' || value === 'failed' ? value : null;
}

/**
 * Dipindah ke dalam Dashboard "Toko Saya" (semula top-level
 * `/{market_slug}/settlement/[settlement_id]`) — pola sama
 * `toko-saya/order/[order_id]/page.tsx`, lihat catatan di sana. Login sudah
 * diproteksi terpusat oleh `middleware.ts`, `AuctionSettlementService`
 * sudah diarahkan ulang ke path baru ini.
 */
export default async function SettlementStatusPage({ params, searchParams }: SettlementStatusPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <SettlementStatusClient
        marketSlug={params.market_slug}
        marketId={market.id}
        settlementId={params.settlement_id}
        statusHint={parseStatusHint(searchParams.status)}
      />
    </div>
  );
}
