'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Filter mode jual (Semua/Lelang/Beli Langsung) — DEVIASI SENGAJA dari pola
 * `bagdja-website` (client state): di sini pakai URL searchParams
 * (`?mode_jual=AUCTION`) supaya hasil filter shareable/bookmarkable. Server
 * Component `page.tsx` yang membaca `searchParams` untuk query API.
 */
export default function ModeFilter({ linkBase }: { linkBase: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('mode_jual') ?? '';

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('mode_jual', value);
    } else {
      params.delete('mode_jual');
    }
    const qs = params.toString();
    router.push(`${linkBase}${qs ? `?${qs}` : ''}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
    >
      <option value="">Semua</option>
      <option value="AUCTION">Lelang</option>
      <option value="DIRECT_SELL">Beli Langsung</option>
    </select>
  );
}
