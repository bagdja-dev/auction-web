'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Product } from '@/lib/types';
import { useTokoSaya } from '../_components/toko-saya-context';
import { ProductFormModal } from './product-form-modal';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<Product['status'], string> = {
  draft: 'Draft',
  published: 'Dipublikasikan',
  sold: 'Terjual',
  expired: 'Kedaluwarsa',
};

const STATUS_BADGE_CLASS: Record<Product['status'], string> = {
  draft: 'bg-zinc-200 text-zinc-700',
  published: 'bg-[var(--brand-success)] text-white',
  sold: 'bg-[var(--brand-info)] text-white',
  expired: 'bg-[var(--brand-error)] text-white',
};

/** List produk sendiri BERBASIS GRID (bukan tabel/list) + tambah/edit lewat Modal. */
export default function ProdukContent() {
  const { marketId } = useTokoSaya();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient<Product[]>(`/api/markets/${marketId}/products/mine`);
      setProducts(list);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat daftar produk.');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function openCreateModal() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  async function handlePublish(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/publish`, { method: 'POST' });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-900">Produk Saya</h1>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Tambah Produk
        </button>
      </div>

      {loadError && <p className="text-sm text-[var(--brand-error)]">{loadError}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Memuat produk…</p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Belum ada produk. Klik &ldquo;+ Tambah Produk&rdquo; untuk mulai berjualan.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => {
            const cover = product.images?.[0] ?? null;
            const isDraft = product.status === 'draft';
            return (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="aspect-square w-full bg-zinc-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      Tidak ada gambar
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{product.name}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[product.status]}`}
                    >
                      {STATUS_LABEL[product.status]}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {product.mode_jual === 'AUCTION' ? 'Lelang' : 'Beli Langsung'}
                  </p>
                  <p className="text-sm font-semibold text-[var(--brand-primary)]">
                    {currencyFormatter.format(product.price)}
                  </p>

                  {rowError[product.id] && (
                    <p className="text-xs text-[var(--brand-error)]">{rowError[product.id]}</p>
                  )}

                  {isDraft && (
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        disabled={busyId === product.id}
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublish(product.id)}
                        disabled={busyId === product.id}
                        className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                      >
                        {busyId === product.id ? '…' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        disabled={busyId === product.id}
                        className="rounded-md border border-[var(--brand-error)] px-2.5 py-1 text-xs font-medium text-[var(--brand-error)] transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editingProduct}
        onSaved={loadProducts}
      />
    </div>
  );
}
