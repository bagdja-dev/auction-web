'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type { CheckoutPayload, Order, ShippingCostOption } from '@/lib/types';

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
}

const EMPTY_FORM: FormState = { recipientName: '', phone: '', address: '' };

/**
 * Form checkout DIRECT_SELL. Alamat tujuan dipilih lewat autocomplete
 * (`ShippingAreaAutocomplete`) yang mem-validasi ke shipping-service, lalu
 * ongkir dihitung real-time (`POST .../shipping/cost`) begitu area terpilih
 * — buyer pilih salah satu opsi kurir, total bayar = harga produk + ongkir
 * terpilih. Sukses -> redirect ke Bagdja Pay (`order.checkout_url`), makanya
 * pakai `window.location.href`, BUKAN `next/navigation` router (keluar domain).
 */
export function CheckoutForm({ marketSlug, marketId, productId, productName, price }: CheckoutFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [destinationArea, setDestinationArea] = useState<ShippingAreaSelection | null>(null);
  const [costOptions, setCostOptions] = useState<ShippingCostOption[] | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<ShippingCostOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Hitung ongkir real-time begitu area tujuan terpilih.
  useEffect(() => {
    if (!destinationArea) {
      setCostOptions(null);
      setSelectedCourier(null);
      setCostError(null);
      return;
    }
    let cancelled = false;
    setCostLoading(true);
    setCostError(null);
    setSelectedCourier(null);
    (async () => {
      try {
        const options = await apiClient<ShippingCostOption[]>(
          `/api/markets/${marketId}/products/${productId}/shipping/cost`,
          { method: 'POST', body: JSON.stringify({ destination_area_id: destinationArea.providerAreaId }) },
        );
        if (cancelled) return;
        setCostOptions(Array.isArray(options) ? options : []);
      } catch (err) {
        if (cancelled) return;
        setCostOptions(null);
        setCostError(err instanceof ApiError ? err.message : 'Gagal menghitung ongkir untuk tujuan ini.');
      } finally {
        if (!cancelled) setCostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [destinationArea, marketId, productId]);

  const shippingCost = selectedCourier?.cost ?? 0;
  const total = price + shippingCost;

  const canSubmit =
    form.recipientName.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.address.trim() !== '' &&
    Boolean(destinationArea) &&
    Boolean(selectedCourier) &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destinationArea || !selectedCourier) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CheckoutPayload = {
        recipient_name: form.recipientName,
        phone: form.phone,
        address: form.address,
        destination_area_id: destinationArea.providerAreaId,
        destination_area_name: destinationArea.name,
        courier_code: selectedCourier.courierCode,
        courier_service_name: selectedCourier.serviceName,
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
        <p className="mt-3 text-sm text-zinc-500">Harga Produk</p>
        <p className="text-base font-medium text-zinc-900">{currencyFormatter.format(price)}</p>
        <p className="mt-3 text-sm text-zinc-500">Ongkir</p>
        <p className="text-base font-medium text-zinc-900">
          {selectedCourier ? currencyFormatter.format(shippingCost) : '—'}
        </p>
        <p className="mt-3 text-sm text-zinc-500">Total Bayar</p>
        <p className="text-xl font-semibold text-[var(--brand-primary)]">{currencyFormatter.format(total)}</p>
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
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Tujuan (Kota/Kecamatan)</label>
          <ShippingAreaAutocomplete value={destinationArea} onChange={setDestinationArea} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Kurir Pengiriman</label>
          {!destinationArea ? (
            <p className="text-xs text-zinc-400">Isi kota/kecamatan tujuan dulu untuk lihat pilihan kurir & ongkir.</p>
          ) : costLoading ? (
            <p className="text-xs text-zinc-400">Menghitung ongkir…</p>
          ) : costError ? (
            <p className="text-xs text-[var(--brand-error)]">{costError}</p>
          ) : costOptions && costOptions.length > 0 ? (
            <div className="space-y-2">
              {costOptions.map((opt) => {
                const active =
                  selectedCourier?.courierCode === opt.courierCode && selectedCourier?.serviceName === opt.serviceName;
                return (
                  <label
                    key={`${opt.courierCode}-${opt.serviceName}`}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                      active ? 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]' : 'border-zinc-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="courier_option"
                        checked={active}
                        onChange={() => setSelectedCourier(opt)}
                      />
                      <span>
                        <span className="font-semibold uppercase">{opt.courierCode}</span> {opt.serviceName}
                        {(opt.etdMinDays || opt.etdMaxDays) && (
                          <span className="ml-2 text-xs text-zinc-400">
                            Estimasi {opt.etdMinDays ?? '?'}-{opt.etdMaxDays ?? '?'} hari
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="font-semibold">{currencyFormatter.format(opt.cost)}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Tidak ada kurir tersedia untuk tujuan ini.</p>
          )}
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
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {submitting ? 'Memproses…' : 'Bayar Sekarang'}
          </button>
        </div>
      </form>
    </div>
  );
}
