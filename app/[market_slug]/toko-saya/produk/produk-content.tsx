'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Product } from '@/lib/types';
import { useTokoSaya } from '../_components/toko-saya-context';
import { PageTitle } from '../_components/page-title';
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
  const { marketId, marketSlug, seller } = useTokoSaya();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Bug ditemukan 31 Agustus 2026: `ProductFormModal` TIDAK PERNAH unmount
  // (komponen React yang sama sepanjang hidup halaman ini — cuma anaknya,
  // `<Modal>`, yang unmount/remount lewat `if (!open) return null`), jadi
  // state form internalnya di-seed ulang lewat `useEffect` yang jalan SATU
  // RENDER SETELAH modal kebuka — render pertama (termasuk `RichTextEditor`
  // yang baru pertama kali mount di render itu) sempat pakai state LAMA
  // sebelum di-seed. Efeknya: deskripsi hasil duplicate/edit produk lain
  // kadang tidak nempel ke editor WYSIWYG. `key` di bawah memaksa
  // `ProductFormModal` remount TOTAL tiap kali dibuka (produk apa pun,
  // termasuk buka form "Tambah Baru" dua kali berturut-turut) — state
  // internalnya jadi bisa lazy-init LANGSUNG dari `product` di render
  // pertama, tidak ada lagi render "stale" sebelum ke-seed.
  const [modalSessionKey, setModalSessionKey] = useState(0);

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

  // Belum daftar toko (polish 31 Agustus 2026) — endpoint ini scoped ke
  // seller pemanggil (`SellerOwnershipGuard`), tidak ada gunanya dipanggil
  // kalau seller-nya belum ada sama sekali.
  useEffect(() => {
    if (!seller) return;
    void loadProducts();
  }, [loadProducts, seller]);

  function openCreateModal() {
    setEditingProduct(null);
    setModalOpen(true);
    setModalSessionKey((k) => k + 1);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setModalOpen(true);
    setModalSessionKey((k) => k + 1);
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

  /** "Turunkan" — batalkan publikasi, produk balik jadi draft (bukan dihapus). */
  async function handleUnpublish(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/unpublish`, { method: 'POST' });
      await loadProducts();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal menurunkan produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  /** Duplikat produk (status apapun) jadi draft baru, lalu langsung buka modal edit untuk disesuaikan. */
  async function handleDuplicate(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      const copy = await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/duplicate`, {
        method: 'POST',
      });
      await loadProducts();
      openEditModal(copy);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal menduplikat produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (!seller) {
    return (
      <div className="space-y-4">
        <PageTitle>Produk Saya</PageTitle>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageTitle>Produk Saya</PageTitle>
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

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {isDraft && (
                      <>
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
                      </>
                    )}
                    {product.status === 'published' && (
                      <>
                        <Link
                          href={`/${marketSlug}/products/${product.slug}?view=owner`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Lihat Detail
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleUnpublish(product.id)}
                          disabled={busyId === product.id}
                          className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                        >
                          {busyId === product.id ? '…' : 'Turunkan'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDuplicate(product.id)}
                      disabled={busyId === product.id}
                      title="Duplikat produk ini jadi draft baru"
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Duplikat
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProductFormModal
        key={modalSessionKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editingProduct}
        onSaved={loadProducts}
      />
    </div>
  );
}
