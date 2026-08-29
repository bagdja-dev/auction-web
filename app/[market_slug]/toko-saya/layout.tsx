import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { getMarketBySlug } from '@/lib/api-client';
import { TokoSayaShell } from './_components/toko-saya-shell';

interface TokoSayaLayoutProps {
  children: ReactNode;
  params: { market_slug: string };
}

/**
 * Layout STATIS/GLOBAL untuk seluruh halaman "Toko Saya" — SENGAJA TIDAK
 * ikut sistem multi-template (`components/templates/registry.ts`) yang
 * dipakai katalog & detail produk publik. Satu implementasi ini berlaku
 * SAMA untuk semua Market apapun `template_id`-nya — yang diwariskan dari
 * renderer cuma variabel CSS warna brand (`--brand-primary` dkk, dari
 * `app/globals.css`, satu stylesheet global), BUKAN komponen/layout.
 *
 * Shell responsive (topbar + gate registrasi seller + sidebar desktop /
 * grid-menu mobile) ada di `_components/toko-saya-shell.tsx`.
 */
export default async function TokoSayaLayout({ children, params }: TokoSayaLayoutProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <TokoSayaShell marketId={market.id} marketSlug={params.market_slug} marketName={market.name}>
      {children}
    </TokoSayaShell>
  );
}
