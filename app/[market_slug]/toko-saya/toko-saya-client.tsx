'use client';

import { useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import { slugify } from '@/lib/slugify';
import type {
  CreateProductPayload,
  Product,
  ProductModeJual,
  Seller,
  SellersMeResponse,
} from '@/lib/types';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<Product['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  sold: 'Terjual',
  expired: 'Kedaluwarsa',
};

const STATUS_BADGE_CLASS: Record<Product['status'], string> = {
  draft: 'bg-zinc-200 text-zinc-700',
  published: 'bg-[var(--brand-success)] text-white',
  sold: 'bg-[var(--brand-info)] text-white',
  expired: 'bg-[var(--brand-error)] text-white',
};

const EMPTY_FORM = {
  slug: '',
  name: '',
  description: '',
  modeJual: 'DIRECT_SELL' as ProductModeJual,
  price: '',
  minIncrement: '',
  auctionStartAt: '',
  auctionEndAt: '',
  imagesText: '',
};

export default function TokoSayaClient({
  marketId,
  marketSlug,
}: {
  marketId: string;
  marketSlug: string;
}) {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shopName, setShopName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function loadSellerStatus() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient<SellersMeResponse>(`/api/markets/${marketId}/sellers/me`);
      setSeller(res.seller);
      if (res.registered && res.seller) {
        await loadProducts();
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat status seller.');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const list = await apiClient<Product[]>(`/api/markets/${marketId}/products/mine`);
      setProducts(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat daftar produk.');
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    void loadSellerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setRegisterError(null);
    try {
      const created = await apiClient<Seller>(`/api/markets/${marketId}/sellers/register`, {
        method: 'POST',
        body: JSON.stringify(shopName ? { shop_name: shopName } : {}),
      });
      setSeller(created);
      await loadProducts();
    } catch (err) {
      setRegisterError(err instanceof ApiError ? err.message : 'Gagal mendaftar sebagai seller.');
    } finally {
      setRegistering(false);
    }
  }

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    updateForm('name', value);
    if (!slugTouched) {
      updateForm('slug', slugify(value));
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const images = form.imagesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const payload: CreateProductPayload = {
        slug: form.slug || slugify(form.name),
        name: form.name,
        description: form.description || undefined,
        images: images.length > 0 ? images : undefined,
        mode_jual: form.modeJual,
        price: Number(form.price),
      };

      if (form.modeJual === 'AUCTION') {
        if (form.minIncrement) payload.min_increment = Number(form.minIncrement);
        if (form.auctionStartAt) payload.auction_start_at = new Date(form.auctionStartAt).toISOString();
        if (form.auctionEndAt) payload.auction_end_at = new Date(form.auctionEndAt).toISOString();
      }

      await apiClient<Product>(`/api/markets/${marketId}/products`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setForm({ ...EMPTY_FORM });
      setSlugTouched(false);
      await loadProducts();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Gagal membuat produk.');
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/publish`, {
        method: 'POST',
      });
      await loadProducts();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal mempublikasikan produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      await apiClient<{ deleted: boolean }>(`/api/markets/${marketId}/products/${productId}`, {
        method: 'DELETE',
      });
      await loadProducts();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal menghapus produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Memuat…</p>;
  }

  if (loadError && !seller) {
    return <p className="text-sm text-[var(--brand-error)]">{loadError}</p>;
  }

  if (!seller) {
    return (
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-zinc-900">Daftar sebagai Seller</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Kamu belum terdaftar sebagai seller di Market <strong>{marketSlug}</strong>. Daftar dulu
          untuk mulai menjual produk.
        </p>
        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Nama Toko (opsional)
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Toko Saya"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>
          {registerError && <p className="text-sm text-[var(--brand-error)]">{registerError}</p>}
          <button
            type="submit"
            disabled={registering}
            className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {registering ? 'Mendaftar…' : 'Daftar sebagai Seller'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-lg font-medium text-zinc-900">
          {seller.shop_name || 'Toko tanpa nama'}
        </h2>
        <p className="text-sm text-zinc-500">Status: {seller.is_active ? 'Aktif' : 'Nonaktif'}</p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-900">Produk Saya</h2>
        {productsLoading ? (
          <p className="text-sm text-zinc-500">Memuat produk…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada produk. Tambahkan produk baru di bawah.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{product.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[product.status]}`}
                    >
                      {STATUS_LABEL[product.status]}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {product.mode_jual === 'AUCTION' ? 'Lelang' : 'Beli Langsung'} ·{' '}
                    {currencyFormatter.format(product.price)}
                  </p>
                  {rowError[product.id] && (
                    <p className="mt-1 text-xs text-[var(--brand-error)]">{rowError[product.id]}</p>
                  )}
                </div>
                {product.status === 'draft' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePublish(product.id)}
                      disabled={busyId === product.id}
                      className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                    >
                      {busyId === product.id ? '…' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      disabled={busyId === product.id}
                      className="rounded-lg border border-[var(--brand-error)] px-3 py-1.5 text-sm font-medium text-[var(--brand-error)] transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-900">Tambah Produk Baru</h2>
        <form
          onSubmit={handleCreateProduct}
          className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
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
                updateForm('slug', slugify(e.target.value));
              }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
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
                  onChange={() => updateForm('modeJual', 'DIRECT_SELL')}
                />
                Beli Langsung
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode_jual"
                  checked={form.modeJual === 'AUCTION'}
                  onChange={() => updateForm('modeJual', 'AUCTION')}
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
              onChange={(e) => updateForm('price', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          {form.modeJual === 'AUCTION' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Kelipatan Tawar Minimum
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.minIncrement}
                  onChange={(e) => updateForm('minIncrement', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Buka Lelang</label>
                  <input
                    type="datetime-local"
                    value={form.auctionStartAt}
                    onChange={(e) => updateForm('auctionStartAt', e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Tutup Lelang</label>
                  <input
                    type="datetime-local"
                    value={form.auctionEndAt}
                    onChange={(e) => updateForm('auctionEndAt', e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Gambar (satu URL per baris)
            </label>
            <textarea
              value={form.imagesText}
              onChange={(e) => updateForm('imagesText', e.target.value)}
              rows={3}
              placeholder={'https://example.com/foto1.jpg\nhttps://example.com/foto2.jpg'}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Upload file belum tersedia di Fase 1 ini — cukup tempel URL gambar.
            </p>
          </div>

          {createError && <p className="text-sm text-[var(--brand-error)]">{createError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {creating ? 'Menyimpan…' : 'Simpan sebagai Draft'}
          </button>
        </form>
      </section>
    </div>
  );
}
