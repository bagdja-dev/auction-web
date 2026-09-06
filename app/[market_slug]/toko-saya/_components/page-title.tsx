'use client';

import Link from 'next/link';

import { useTokoSaya } from './toko-saya-context';
import { BackIcon } from './icons';

/**
 * Judul halaman + ikon kembali ke Dashboard — ikonnya HANYA tampil di mobile
 * (`md:hidden`), karena di desktop navigasi antar halaman sudah lewat
 * sidebar (tidak butuh tombol back terpisah).
 */
export function PageTitle({ children }: { children: React.ReactNode }) {
  const { linkBase } = useTokoSaya();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${linkBase}/toko-saya`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 md:hidden"
        aria-label="Kembali ke Dashboard"
      >
        <BackIcon className="h-5 w-5" />
      </Link>
      <h1 className="text-lg font-semibold text-zinc-900">{children}</h1>
    </div>
  );
}
