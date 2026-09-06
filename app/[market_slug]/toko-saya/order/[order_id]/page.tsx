import { notFound } from 'next/navigation';

import { getMarketBySlug } from '@/lib/api-client';
import { resolveTenantLinkBase } from '@/lib/tenant-link-base';
import { OrderStatusClient } from './order-status-client';

interface OrderStatusPageProps {
  params: { market_slug: string; order_id: string };
  searchParams: { status?: string };
}

export const metadata = { title: 'Status Pesanan · Toko Saya' };

function parseStatusHint(value: string | undefined): 'success' | 'failed' | null {
  return value === 'success' || value === 'failed' ? value : null;
}

/**
 * Dipindah ke dalam Dashboard "Toko Saya" (semula top-level
 * `/{market_slug}/order/[order_id]`) — setiap user di Market ini bisa
 * sekaligus jadi pembeli & penjual, jadi status pesanan/pengiriman ikut
 * dibungkus di Dashboard yang sama, bukan area terpisah. Login SUDAH
 * diproteksi terpusat oleh `middleware.ts` (pola `/{slug}/toko-saya/*`),
 * jadi TIDAK perlu cek `getSession()` sendiri lagi di sini seperti versi
 * lama. `bagdja-auction-api` (`CheckoutService.checkout()`) sudah diarahkan
 * ulang ke path baru ini untuk `successRedirectUrl`/`failureRedirectUrl`.
 */
export default async function OrderStatusPage({ params, searchParams }: OrderStatusPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <OrderStatusClient
        linkBase={resolveTenantLinkBase(params.market_slug)}
        marketId={market.id}
        orderId={params.order_id}
        statusHint={parseStatusHint(searchParams.status)}
      />
    </div>
  );
}
