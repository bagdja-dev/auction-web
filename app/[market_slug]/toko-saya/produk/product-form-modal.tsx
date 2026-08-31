'use client';

import { useEffect, useState } from 'react';

import { Modal } from '@/components/modal';
import { NumberInput } from '@/components/number-input';
import { RichTextEditor } from '@/components/rich-text-editor';
import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { GalleryEditor } from '@/components/upload/gallery-editor';
import { Model3DUpload } from '@/components/upload/model3d-upload';
import { VideoUpload } from '@/components/upload/video-upload';
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
  images: string[];
  videoUrl: string | null;
  model3dUrl: string | null;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  shippingOrigin: ShippingAreaSelection | null;
}

// Deskripsi minimal 500 karakter TEKS (bukan HTML mentah) — dicek juga di
// backend saat publish (`ProductsService.validateForPublish`, BUKAN saat
// draft/create, lihat komentar di sana). Blok submit di sini murni UX
// nudge, bukan satu-satunya lapis validasi.
const MIN_DESCRIPTION_LENGTH = 500;

function plainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').trim().length;
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
  images: [],
  videoUrl: null,
  model3dUrl: null,
  weightGrams: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  shippingOrigin: null,
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
    images: product.images ?? [],
    videoUrl: product.video_url,
    model3dUrl: product.model3d_url,
    weightGrams: product.weight_grams != null ? String(product.weight_grams) : '',
    lengthCm: product.length_cm != null ? String(product.length_cm) : '',
    widthCm: product.width_cm != null ? String(product.width_cm) : '',
    heightCm: product.height_cm != null ? String(product.height_cm) : '',
    shippingOrigin: product.shipping_origin_area_name
      ? { providerAreaId: '', name: product.shipping_origin_area_name }
      : null,
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
  const [descriptionLength, setDescriptionLength] = useState(0);

  useEffect(() => {
    if (!open) return;
    const nextForm = product ? productToForm(product) : { ...EMPTY_FORM };
    setForm(nextForm);
    setDescriptionLength(plainTextLength(nextForm.description));
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
    if (descriptionLength < MIN_DESCRIPTION_LENGTH) {
      setError(`Deskripsi minimal ${MIN_DESCRIPTION_LENGTH} karakter (saat ini ${descriptionLength}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateProductPayload | UpdateProductPayload = {
        slug: form.slug || slugify(form.name),
        name: form.name,
        description: form.description || undefined,
        images: form.images.length > 0 ? form.images : undefined,
        video_url: form.videoUrl ?? undefined,
        model3d_url: form.model3dUrl ?? undefined,
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
        weight_grams: form.weightGrams ? Number(form.weightGrams) : undefined,
        length_cm: form.lengthCm ? Number(form.lengthCm) : undefined,
        width_cm: form.widthCm ? Number(form.widthCm) : undefined,
        height_cm: form.heightCm ? Number(form.heightCm) : undefined,
        shipping_origin_area_name: form.shippingOrigin?.name || undefined,
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
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700">Deskripsi</label>
            <span className={`text-xs font-medium ${descriptionLength < MIN_DESCRIPTION_LENGTH ? 'text-[var(--brand-error)]' : 'text-green-600'}`}>
              {descriptionLength} / {MIN_DESCRIPTION_LENGTH} karakter minimum
            </span>
          </div>
          <RichTextEditor
            value={form.description}
            onChange={(html, textLength) => {
              updateField('description', html);
              setDescriptionLength(textLength);
            }}
            placeholder="Ceritakan kondisi, riwayat, keunikan produk selengkap-lengkapnya — deskripsi detail membantu buyer yakin sebelum bid/beli."
          />
          {descriptionLength < MIN_DESCRIPTION_LENGTH && (
            <p className="mt-1 text-xs text-zinc-400">
              Kurang {MIN_DESCRIPTION_LENGTH - descriptionLength} karakter lagi.
            </p>
          )}
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
          <NumberInput
            required
            value={form.price}
            onChange={(raw) => updateField('price', raw)}
          />
        </div>

        {form.modeJual === 'AUCTION' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Kelipatan Tawar Minimum</label>
              <NumberInput
                value={form.minIncrement}
                onChange={(raw) => updateField('minIncrement', raw)}
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
          <label className="mb-1 block text-sm font-medium text-zinc-700">Gambar Produk</label>
          <GalleryEditor value={form.images} onChange={(images) => updateField('images', images)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Video Produk (opsional)</label>
          <VideoUpload value={form.videoUrl} onChange={(url) => updateField('videoUrl', url)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Model 3D (opsional)</label>
          <Model3DUpload value={form.model3dUrl} onChange={(url) => updateField('model3dUrl', url)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Berat &amp; Dimensi (opsional)</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Berat (gram)</label>
              <NumberInput value={form.weightGrams} onChange={(raw) => updateField('weightGrams', raw)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Panjang (cm)</label>
              <NumberInput value={form.lengthCm} onChange={(raw) => updateField('lengthCm', raw)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Lebar (cm)</label>
              <NumberInput value={form.widthCm} onChange={(raw) => updateField('widthCm', raw)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Tinggi (cm)</label>
              <NumberInput value={form.heightCm} onChange={(raw) => updateField('heightCm', raw)} />
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Opsional — kalau kosong dipakai default 250g/30×30×5cm untuk hitung ongkir.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Lokasi Asal Pengiriman</label>
          <ShippingAreaAutocomplete
            value={form.shippingOrigin}
            onChange={(area) => updateField('shippingOrigin', area)}
            placeholder="Cari kota/kecamatan asal pengiriman produk ini..."
          />
          <p className="mt-1 text-xs text-zinc-400">
            Wajib diisi sebelum produk ini bisa dihitung ongkirnya/dibeli pembeli.
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
            disabled={saving || descriptionLength < MIN_DESCRIPTION_LENGTH}
            title={descriptionLength < MIN_DESCRIPTION_LENGTH ? `Deskripsi belum mencapai ${MIN_DESCRIPTION_LENGTH} karakter minimum` : undefined}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan sebagai Draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
