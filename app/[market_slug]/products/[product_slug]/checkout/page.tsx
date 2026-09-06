import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getMarketBySlug, getMarketProductBySlug } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import { resolveTenantLinkBase } from '@/lib/tenant-link-base';
import { CheckoutForm } from './checkout-form';

interface CheckoutPageProps {
  params: { market_slug: string; product_slug: string };
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const product = await getMarketProductBySlug(params.market_slug, params.product_slug);
  if (!product) return {};
  return { title: `Checkout — ${product.name}` };
}

/**
 * Checkout hanya untuk produk DIRECT_SELL yang masih `published`. Halaman
 * ini SENGAJA tidak diproteksi lewat middleware.ts (lihat catatan di sana)
 * — cek login dilakukan di sini saja.
 */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { token } = await getSession();
  if (!token) {
    const currentPath = `${resolveTenantLinkBase(params.market_slug)}/products/${params.product_slug}/checkout`;
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }

  const [market, product] = await Promise.all([
    getMarketBySlug(params.market_slug),
    getMarketProductBySlug(params.market_slug, params.product_slug),
  ]);
  if (!market || !product) notFound();
  if (product.mode_jual !== 'DIRECT_SELL' || product.status !== 'published') notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Checkout</h1>
      <CheckoutForm
        linkBase={resolveTenantLinkBase(params.market_slug)}
        marketId={market.id}
        productId={product.id}
        productName={product.name}
        price={product.price}
      />
    </main>
  );
}
