import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getMarketBySlug } from '@/lib/api-client';

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

export default function MarketLayout({ children }: MarketLayoutProps) {
  return children;
}
