'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Badge akun untuk `MarketAppBar` (katalog + detail) — polish 31 Agustus
 * 2026, menggantikan tombol "Toko Saya" mentah dengan pola avatar+nama+
 * dropdown yang sudah ada di `toko-saya-shell.tsx` (referensi user: "badge
 * user seperti lainnya"), DITAMBAH nama user tampil langsung di sebelah
 * avatar (bukan cuma inisial, beda dari shell yang cuma tampilkan nama di
 * dalam dropdown). Urutan SENGAJA nama dulu baru avatar (revisi user,
 * bukan avatar-lalu-nama seperti draft pertama) — link dropdown "Toko
 * Saya" juga diganti label "Dashboard" (revisi user).
 *
 * SENGAJA terima `isLoggedIn`/`displayName` sbg PROPS (bukan panggil
 * `useAuth()` sendiri) — supaya bisa dipakai dari pemanggil server
 * component (`catalog-view.tsx`, `isLoggedIn`/nama dihitung server-side via
 * `getSession()`, hindari flash "Masuk" sebelum hydration) MAUPUN client
 * component (`product-detail-view.tsx`, via `useAuth()`) dengan API yang
 * sama. Komponen ini sendiri 'use client' HANYA karena butuh state lokal
 * toggle dropdown, bukan karena butuh resolve identitas sendiri.
 */
export interface AccountBadgeProps {
  marketSlug: string;
  isLoggedIn: boolean;
  /** Username/email user login — `undefined` = tampilkan fallback "Akun". */
  displayName?: string;
}

export function AccountBadge({ marketSlug, isLoggedIn, displayName }: AccountBadgeProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isLoggedIn) {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(`/${marketSlug}/toko-saya`)}`}
        className="rounded-lg border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)] transition hover:bg-zinc-50"
      >
        Masuk
      </Link>
    );
  }

  const name = displayName || 'Akun';
  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menu akun"
        className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-3 pr-1 text-sm font-medium text-zinc-700 transition hover:border-[var(--brand-primary)]"
      >
        <span className="max-w-[9rem] truncate">{name}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white">
          {initials}
        </span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
            <Link
              href={`/${marketSlug}/toko-saya`}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Dashboard
            </Link>
            <a href="/auth/logout" className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
              Keluar
            </a>
          </div>
        </>
      )}
    </div>
  );
}
