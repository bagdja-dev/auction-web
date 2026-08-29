import { notFound } from 'next/navigation';

import { getMarketBySlug } from '@/lib/api-client';
import TokoSayaClient from './toko-saya-client';

interface TokoSayaPageProps {
  params: { market_slug: string };
}

export const metadata = { title: 'Toko Saya' };

/**
 * PROTECTED oleh middleware.ts (`^/([a-z0-9-]+)/toko-saya(/|$)`) — user yang
 * sampai ke sini PASTI sudah login (cookie `am_buyer_token` ada).
 */
export default async function TokoSayaPage({ params }: TokoSayaPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--brand-primary)]">Toko Saya</h1>
      <TokoSayaClient marketId={market.id} marketSlug={params.market_slug} />
    </main>
  );
}
