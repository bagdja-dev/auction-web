'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { CheckoutPayload, Order } from '@/lib/types';

interface CheckoutFormProps {
  marketSlug: string;
  marketId: string;
  productId: string;
  productName: string;
  price: number;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

interface FormState {
  recipientName: string;
  phone: string;
  address: string;
  courier: string;
}

const EMPTY_FORM: FormState = { recipientName: '', phone: '', address: '', courier: '' };

/**
 * Form checkout DIRECT_SELL. Total bayar = harga produk saja (TIDAK ada
 * hitung ongkir dinamis — keputusan scope, `courier` cuma catatan
 * informasional untuk seller). Sukses -> redirect ke Bagdja Pay
 * (`order.checkout_url`), makanya pakai `window.location.href`, BUKAN
 * `next/navigation` router (keluar domain).
 */
export function CheckoutForm({ marketSlug, marketId, productId, productName, price }: CheckoutFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: CheckoutPayload = {
        recipient_name: form.recipientName,
        phone: form.phone,
        address: form.address,
        courier: form.courier || undefined,
      };

      const order = await apiClient<Order>(
        `/api/markets/${marketId}/products/${productId}/checkout`,
        { method: 'POST', body: JSON.stringify(payload) },
      );

      if (!order.checkout_url) {
        setError('Checkout berhasil dibuat tetapi URL pembayaran tidak tersedia. Silakan hubungi dukungan.');
        setSubmitting(false);
        return;
      }

      window.location.href = order.checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses checkout.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-500">Produk</p>
        <p className="text-base font-medium text-zinc-900">{productName}</p>
        <p className="mt-3 text-sm text-zinc-500">Total Bayar</p>
        <p className="text-xl font-semibold text-[var(--brand-primary)]">{currencyFormatter.format(price)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Penerima</label>
          <input
            type="text"
            required
            value={form.recipientName}
            onChange={(e) => updateField('recipientName', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nomor Telepon</label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Pengiriman</label>
          <textarea
            required
            rows={3}
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Kurir (opsional)</label>
          <input
            type="text"
            placeholder="JNE/J&T/dll — opsional"
            value={form.courier}
            onChange={(e) => updateField('courier', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        {error && <p className="text-sm text-[var(--brand-error)]">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Link
            href={`/${marketSlug}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {submitting ? 'Memproses…' : 'Bayar Sekarang'}
          </button>
        </div>
      </form>
    </div>
  );
}
