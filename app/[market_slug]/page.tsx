import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMarketBySlug, getMarketProducts, type ProductModeJual } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import { resolveTemplate } from '@/components/templates/registry';

export const revalidate = 60;

interface MarketPageProps {
  params: { market_slug: string };
  searchParams: { mode_jual?: string; page?: string };
}

function parseModeJual(value: string | undefined): ProductModeJual | undefined {
  return value === 'AUCTION' || value === 'DIRECT_SELL' ? value : undefined;
}

export async function generateMetadata({ params }: MarketPageProps): Promise<Metadata> {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) return {};
  return { title: market.name };
}

export default async function MarketCatalogPage({ params, searchParams }: MarketPageProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market || !market.is_active) notFound();

  const page = Number(searchParams.page ?? '1') || 1;
  const modeJual = parseModeJual(searchParams.mode_jual);

  const products = await getMarketProducts(params.market_slug, { page, mode_jual: modeJual });
  const { user } = await getSession();

  const { CatalogView } = resolveTemplate(market.template_id);

  return (
    <CatalogView
      market={market}
      marketSlug={params.market_slug}
      products={products}
      page={page}
      modeJual={modeJual}
      isLoggedIn={Boolean(user)}
      displayName={user?.username ?? user?.email ?? undefined}
    />
  );
}
