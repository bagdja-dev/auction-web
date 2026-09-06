import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getMarketBySlug, getMarketProductBySlug } from '@/lib/api-client';
import { resolveTemplate } from '@/components/templates/registry';
import { resolveTenantLinkBase } from '@/lib/tenant-link-base';

interface ProductDetailPageProps {
  params: { market_slug: string; product_slug: string };
}

const META_DESCRIPTION_MAX_LENGTH = 160;

/** `product.description` sekarang HTML dari WYSIWYG — meta tag butuh teks polos, bukan markup mentah. */
function toMetaDescription(html: string | null): string | undefined {
  if (!html) return undefined;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > META_DESCRIPTION_MAX_LENGTH ? `${text.slice(0, META_DESCRIPTION_MAX_LENGTH - 1)}…` : text;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const product = await getMarketProductBySlug(params.market_slug, params.product_slug);
  if (!product) return {};
  return {
    title: product.name,
    description: toMetaDescription(product.description),
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const [market, product] = await Promise.all([
    getMarketBySlug(params.market_slug),
    getMarketProductBySlug(params.market_slug, params.product_slug),
  ]);
  if (!market || !product) notFound();

  const { ProductDetailView } = resolveTemplate(market.template_id);

  return (
    <ProductDetailView
      marketSlug={params.market_slug}
      linkBase={resolveTenantLinkBase(params.market_slug)}
      marketId={market.id}
      marketName={market.name}
      product={product}
      registrationDeadlineMinutes={market.registration_deadline_minutes}
    />
  );
}
