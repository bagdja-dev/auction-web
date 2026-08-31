'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Seller, UpdateSellerPayload } from '@/lib/types';
import { useTokoSaya } from '../_components/toko-saya-context';
import { PageTitle } from '../_components/page-title';

export default function PengaturanContent() {
  const { marketId, marketSlug, seller, refreshSeller } = useTokoSaya();

  // Inisialisasi dari `seller?.shop_name` (bisa `null` — belum daftar toko,
  // polish 31 Agustus 2026) — hook TIDAK BOLEH dipanggil kondisional
  // (Rules of Hooks), jadi guard "belum punya toko" di bawah dilakukan
  // SETELAH semua hook, bukan early-return sebelum `useState` ini.
  const [shopName, setShopName] = useState(seller?.shop_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!seller) {
    return (
      <div className="max-w-md space-y-4">
        <PageTitle>Pengaturan Toko</PageTitle>
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          Anda belum punya toko di Market ini. Buat toko dulu lewat halaman{' '}
          <Link href={`/${marketSlug}/toko-saya`} className="font-medium text-[var(--brand-primary)] hover:underline">
            Dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: UpdateSellerPayload = { shop_name: shopName };
      await apiClient<Seller>(`/api/markets/${marketId}/sellers/me`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshSeller();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan toko.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <PageTitle>Pengaturan Toko</PageTitle>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Toko</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Toko Saya"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        {error && <p className="text-sm text-[var(--brand-error)]">{error}</p>}
        {success && <p className="text-sm text-[var(--brand-success)]">Tersimpan.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  );
}
