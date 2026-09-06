import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { marketPublicTag } from '@/lib/revalidate';

/**
 * Dipanggil `bagdja-auction-api` (`RevalidateClientService`) begitu produk
 * publish/unpublish — bikin cache publik Market ini (`lib/api-client.ts`,
 * tag `market-public:{slug}`) langsung stale, TANPA menunggu `revalidate: 60`
 * (ISR berkala) kadaluarsa sendiri. Internal-only — diverifikasi lewat shared
 * secret (header `x-internal-secret`), BUKAN endpoint publik.
 *
 * Route ini otomatis lolos dari `middleware.ts` (matcher-nya mengecualikan
 * `/api/*`), jadi tidak ikut logic rewrite tenant subdomain.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const marketSlug = body?.marketSlug;
  if (typeof marketSlug !== 'string' || !marketSlug) {
    return NextResponse.json({ error: 'marketSlug is required' }, { status: 400 });
  }

  const tag = marketPublicTag(marketSlug);
  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag });
}
