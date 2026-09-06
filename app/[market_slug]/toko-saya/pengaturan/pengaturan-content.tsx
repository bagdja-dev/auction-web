'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Seller, SellerAdditionalFee, UpdateSellerPayload } from '@/lib/types';
import { useTokoSaya } from '../_components/toko-saya-context';
import { PageTitle } from '../_components/page-title';

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

/** ID lokal (bukan dikirim ke server) — cuma buat `key` React tiap baris biaya, unik walau label sama/kosong sementara diketik. */
function localRowId(): string {
  return Math.random().toString(36).slice(2);
}

export default function PengaturanContent() {
  const { marketId, linkBase, seller, refreshSeller } = useTokoSaya();

  // Inisialisasi dari `seller` (bisa `null` — belum daftar toko, polish 31
  // Agustus 2026) — hook TIDAK BOLEH dipanggil kondisional (Rules of Hooks),
  // jadi guard "belum punya toko" di bawah dilakukan SETELAH semua hook,
  // bukan early-return sebelum `useState` ini. Field sama persis dengan
  // `CreateShopModal` (form "Buat Toko") — permintaan 2026-09-07: halaman
  // ini sekarang bisa edit SEMUA info yang dikumpulkan saat bikin toko,
  // bukan cuma nama.
  const [shopName, setShopName] = useState(seller?.shop_name ?? '');
  const [address, setAddress] = useState(seller?.address ?? '');
  const [shippingArea, setShippingArea] = useState<ShippingAreaSelection | null>(
    seller?.shipping_area_id
      ? { providerAreaId: seller.shipping_area_id, name: seller.shipping_area_name ?? '' }
      : null,
  );
  const [fees, setFees] = useState<(SellerAdditionalFee & { _id: string })[]>(
    () => (seller?.additional_fees ?? []).map((fee) => ({ ...fee, _id: localRowId() })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!seller) {
    return (
      <div className="space-y-4">
        <PageTitle>Pengaturan Toko</PageTitle>
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          Anda belum punya toko di Market ini. Buat toko dulu lewat halaman{' '}
          <Link href={`${linkBase}/toko-saya`} className="font-medium text-[var(--brand-primary)] hover:underline">
            Dashboard
          </Link>
          .
        </p>
      </div>
    );
  }

  function addFeeRow() {
    setFees((prev) => [...prev, { _id: localRowId(), label: '', amount: 0 }]);
  }

  function updateFeeRow(id: string, patch: Partial<SellerAdditionalFee>) {
    setFees((prev) => prev.map((fee) => (fee._id === id ? { ...fee, ...patch } : fee)));
  }

  function removeFeeRow(id: string) {
    setFees((prev) => prev.filter((fee) => fee._id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: UpdateSellerPayload = {
        shop_name: shopName,
        address,
        shipping_area_id: shippingArea?.providerAreaId,
        shipping_area_name: shippingArea?.name,
        // Baris dengan label kosong dibuang (bukan dikirim setengah jadi) —
        // replace-all, jadi kirim daftar bersih apa adanya.
        additional_fees: fees
          .filter((fee) => fee.label.trim() !== '')
          .map(({ label, amount }) => ({ label, amount })),
      };
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
    <div className="space-y-4">
      <PageTitle>Pengaturan Toko</PageTitle>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
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

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat (Kota/Kecamatan)</label>
              <ShippingAreaAutocomplete value={shippingArea} onChange={setShippingArea} />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Lengkap</label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Biaya Tambahan (2026-09-07) — HANYA data setting, BELUM otomatis
            dihitung ke tagihan buyer manapun (checkout/pelunasan) — itu
            keputusan eksplisit, disepakati jadi fitur terpisah nanti. */}
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Biaya Tambahan</h2>
            <p className="text-xs text-zinc-500">
              Daftar biaya bebas untuk referensi Anda sendiri (mis. &ldquo;Biaya Packing&rdquo;: Rp10.000) —
              belum otomatis ditambahkan ke tagihan pembeli.
            </p>
          </div>

          {fees.length > 0 && (
            <div className="space-y-2">
              {fees.map((fee) => (
                <div key={fee._id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fee.label}
                    onChange={(e) => updateFeeRow(fee._id, { label: e.target.value })}
                    placeholder="Nama biaya (mis. Biaya Packing)"
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={fee.amount}
                    onChange={(e) => updateFeeRow(fee._id, { amount: Number(e.target.value) || 0 })}
                    placeholder="Nominal"
                    className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeeRow(fee._id)}
                    aria-label="Hapus biaya"
                    className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-500 transition hover:bg-zinc-50 hover:text-[var(--brand-error)]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addFeeRow}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            + Tambah Biaya
          </button>

          {fees.some((fee) => fee.label.trim() !== '') && (
            <p className="text-xs text-zinc-400">
              Preview: {fees.filter((f) => f.label.trim()).map((f) => `${f.label} (${NUMBER_FORMATTER.format(f.amount)})`).join(', ')}
            </p>
          )}
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
