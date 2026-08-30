import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMarketBySlug, getMarketProductBySlug } from '@/lib/api-client';
import { resolveTemplate } from '@/components/templates/registry';

interface ProductDetailPageProps {
  params: { market_slug: string; product_slug: string };
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const product = await getMarketProductBySlug(params.market_slug, params.product_slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const [market, product] = await Promise.all([
    getMarketBySlug(params.market_slug),
    getMarketProductBySlug(params.market_slug, params.product_slug),
  ]);
  if (!market || !product) notFound();

  const { ProductDetailView } = resolveTemplate(market.template_id);

  return <ProductDetailView marketSlug={params.market_slug} marketId={market.id} product={product} />;
}
