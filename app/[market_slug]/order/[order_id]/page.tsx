import { notFound, redirect } from 'next/navigation';

import { getMarketBySlug } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import { OrderStatusClient } from './order-status-client';

interface OrderStatusPageProps {
  params: { market_slug: string; order_id: string };
  searchParams: { status?: string };
}

export const metadata = { title: 'Status Pesanan' };

function parseStatusHint(value: string | undefined): 'success' | 'failed' | null {
  return value === 'success' || value === 'failed' ? value : null;
}

/**
 * Server Component tipis — cek login (sama seperti checkout, TIDAK lewat
 * middleware.ts, lihat catatan di sana), lalu render client component yang
 * melakukan polling status order. `?status=success|failed` (dari
 * `successRedirectUrl`/`failureRedirectUrl` Bagdja Pay) dibaca di sini
 * (bukan `useSearchParams` di client, biar tidak perlu Suspense boundary)
 * dan diteruskan sebagai hint awal sebelum polling pertama selesai.
 */
export default async function OrderStatusPage({ params, searchParams }: OrderStatusPageProps) {
  const { token } = await getSession();
  if (!token) {
    const currentPath = `/${params.market_slug}/order/${params.order_id}`;
    redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);
  }

  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Status Pesanan</h1>
      <OrderStatusClient
        marketSlug={params.market_slug}
        marketId={market.id}
        orderId={params.order_id}
        statusHint={parseStatusHint(searchParams.status)}
      />
    </main>
  );
}
