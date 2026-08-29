import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { getMarketBySlug } from '@/lib/api-client';

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
 * Kalau nanti template lain menambah warna berbeda per Market, cukup ubah
 * cara variabel CSS itu di-resolve (mis. inline `<style>` per Market) — kode
 * di sini tidak perlu berubah sama sekali.
 */
export default async function TokoSayaLayout({ children, params }: TokoSayaLayoutProps) {
  const market = await getMarketBySlug(params.market_slug);
  if (!market) notFound();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs text-zinc-500">{market.name}</p>
            <h1 className="text-lg font-semibold text-[var(--brand-primary)]">Toko Saya</h1>
          </div>
          <Link
            href={`/${params.market_slug}`}
            className="text-sm text-zinc-500 hover:text-[var(--brand-primary)]"
          >
            ← Kembali ke katalog
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
