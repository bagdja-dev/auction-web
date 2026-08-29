'use client';

import { useEffect, useState } from 'react';

import { Modal } from '@/components/modal';
import { ApiError, apiClient } from '@/lib/proxy-client';
import { slugify } from '@/lib/slugify';
import type { CreateProductPayload, Product, ProductModeJual, UpdateProductPayload } from '@/lib/types';
import { useTokoSaya } from '../_components/toko-saya-context';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null`/`undefined` = mode tambah baru. Diisi = mode edit (HANYA untuk produk berstatus draft). */
  product?: Product | null;
  onSaved: () => void;
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  modeJual: ProductModeJual;
  price: string;
  minIncrement: string;
  auctionStartAt: string;
  auctionEndAt: string;
  imagesText: string;
}

const EMPTY_FORM: FormState = {
  slug: '',
  name: '',
  description: '',
  modeJual: 'DIRECT_SELL',
  price: '',
  minIncrement: '',
  auctionStartAt: '',
  auctionEndAt: '',
  imagesText: '',
};

/** ISO datetime -> value yang diterima <input type="datetime-local"> (tanpa detik/timezone). */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function productToForm(product: Product): FormState {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description ?? '',
    modeJual: product.mode_jual,
    price: String(product.price),
    minIncrement: product.min_increment != null ? String(product.min_increment) : '',
    auctionStartAt: toDatetimeLocal(product.auction_start_at),
    auctionEndAt: toDatetimeLocal(product.auction_end_at),
    imagesText: product.images?.join('\n') ?? '',
  };
}

/**
 * Form tambah/edit produk di dalam Modal — satu komponen untuk kedua mode
 * (create/edit), dibedakan lewat prop `product`. Edit HANYA untuk produk
 * draft (aturan backend), jadi modal ini tidak dipakai untuk produk yang
 * sudah published/sold/expired.
 */
export function ProductFormModal({ open, onClose, product, onSaved }: ProductFormModalProps) {
  const { marketId } = useTokoSaya();
  const isEdit = !!product;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(product ? productToForm(product) : { ...EMPTY_FORM });
    setSlugTouched(!!product);
    setError(null);
  }, [open, product]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    updateField('name', value);
    if (!slugTouched) updateField('slug', slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const images = form.imagesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const payload: CreateProductPayload | UpdateProductPayload = {
        slug: form.slug || slugify(form.name),
        name: form.name,
        description: form.description || undefined,
        images: images.length > 0 ? images : undefined,
        mode_jual: form.modeJual,
        price: Number(form.price),
        min_increment: form.modeJual === 'AUCTION' && form.minIncrement ? Number(form.minIncrement) : undefined,
        auction_start_at:
          form.modeJual === 'AUCTION' && form.auctionStartAt
            ? new Date(form.auctionStartAt).toISOString()
            : undefined,
        auction_end_at:
          form.modeJual === 'AUCTION' && form.auctionEndAt
            ? new Date(form.auctionEndAt).toISOString()
            : undefined,
      };

      if (isEdit && product) {
        await apiClient<Product>(`/api/markets/${marketId}/products/${product.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient<Product>(`/api/markets/${marketId}/products`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Produk</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Slug</label>
          <input
            type="text"
            required
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              updateField('slug', slugify(e.target.value));
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Deskripsi</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Mode Jual</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode_jual"
                checked={form.modeJual === 'DIRECT_SELL'}
                onChange={() => updateField('modeJual', 'DIRECT_SELL')}
              />
              Beli Langsung
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode_jual"
                checked={form.modeJual === 'AUCTION'}
                onChange={() => updateField('modeJual', 'AUCTION')}
              />
              Lelang
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Harga {form.modeJual === 'AUCTION' && '(estimasi/harga awal)'}
          </label>
          <input
            type="number"
            required
            min={0}
            value={form.price}
            onChange={(e) => updateField('price', e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        {form.modeJual === 'AUCTION' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Kelipatan Tawar Minimum</label>
              <input
                type="number"
                min={0}
                value={form.minIncrement}
                onChange={(e) => updateField('minIncrement', e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Buka Lelang</label>
                <input
                  type="datetime-local"
                  value={form.auctionStartAt}
                  onChange={(e) => updateField('auctionStartAt', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Tutup Lelang</label>
                <input
                  type="datetime-local"
                  value={form.auctionEndAt}
                  onChange={(e) => updateField('auctionEndAt', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Gambar (satu URL per baris)</label>
          <textarea
            value={form.imagesText}
            onChange={(e) => updateField('imagesText', e.target.value)}
            rows={3}
            placeholder={'https://example.com/foto1.jpg\nhttps://example.com/foto2.jpg'}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Upload file belum tersedia di Fase 1 ini — cukup tempel URL gambar.
          </p>
        </div>

        {error && <p className="text-sm text-[var(--brand-error)]">{error}</p>}

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
            disabled={saving}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan sebagai Draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
