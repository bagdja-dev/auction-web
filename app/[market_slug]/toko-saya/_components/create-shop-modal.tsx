'use client';

import { useState } from 'react';

import { Modal } from '@/components/modal';
import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { useTokoSaya } from './toko-saya-context';

interface CreateShopModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Form "Buat Toko" (popup, permintaan 2026-09-07) — dulu tombol "Buat Toko"
 * langsung panggil `registerSeller()` tanpa form sama sekali (shop_name
 * kosong, tidak ada alamat). Sekarang kumpulkan nama + alamat lengkap +
 * alamat format pengiriman (`ShippingAreaAutocomplete`, sama komponen yang
 * dipakai registrasi lelang/checkout) SEKALIGUS di sini — lewat
 * `registerSeller()` context yang sama (`toko-saya-shell.tsx`), jadi tetap
 * satu sumber loading/error state (`registering`/`registerError`).
 */
export function CreateShopModal({ open, onClose }: CreateShopModalProps) {
  const { registerSeller, registering, registerError } = useTokoSaya();

  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [shippingArea, setShippingArea] = useState<ShippingAreaSelection | null>(null);

  const canSubmit = shopName.trim() !== '' && address.trim() !== '' && shippingArea !== null && !registering;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingArea) return;
    const success = await registerSeller({
      shop_name: shopName,
      address,
      shipping_area_id: shippingArea.providerAreaId,
      shipping_area_name: shippingArea.name,
    });
    if (success) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Buat Toko">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Toko</label>
          <input
            type="text"
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Lengkap</label>
          <textarea
            required
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Tujuan (Kota/Kecamatan)</label>
          <ShippingAreaAutocomplete value={shippingArea} onChange={setShippingArea} />
        </div>

        {registerError && <p className="text-sm text-[var(--brand-error)]">{registerError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {registering ? 'Membuat…' : 'Buat Toko'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
