import { notFound } from 'next/navigation';

import { getMarketBySlug } from '@/lib/api-client';
import TokoSayaClient from './toko-saya-client';

interface TokoSayaPageProps {
  params: { market_slug: string };
}

export const metadata = { title: 'Toko Saya' };

/**
 * PROTECTED oleh middleware.ts (`^/([a-z0-9-]+)/toko-saya(/|$)`) — user yang
 * sampai ke sini PASTI sudah login (cookie `am_buyer_token` ada). Shell
 * statis (header + link kembali) ada di `layout.tsx` sebelah — file ini
 * cukup konten fungsionalnya saja.
 */
export default async function TokoSayaPage({ params }: TokoSayaPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return <TokoSayaClient marketId={market.id} marketSlug={params.market_slug} />;
}
