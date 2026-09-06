'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Product, ProductFulfillment, ProductModeJual, ProductStatus } from '@/lib/types';
import { useTokoSaya } from './toko-saya-context';
import { PageTitle } from './page-title';
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

/** Urutan tab status — draft (perlu di-publish) & published (aktif) duluan, baru status "selesai" (sold/expired). */
const STATUS_ORDER: ProductStatus[] = ['draft', 'published', 'sold', 'expired'];

type StatusTab = 'ALL' | ProductStatus;

interface ModeListingManagerProps {
  modeJual: ProductModeJual;
  title: string;
}

/**
 * Sisi SELLER menu "Lelang"/"Beli Langsung" (restrukturisasi Dashboard per
 * mode jual) — gabungan `produk/produk-content.tsx` (CRUD: tambah/edit/
 * publish/turunkan/duplikat/lelang-ulang) DAN `pesanan/pesanan-content.tsx`
 * (progress fulfillment untuk produk yang sudah `sold`), yang sebelumnya
 * dua menu terpisah ("Produk Saya"/"Pesanan") — sekarang satu tampilan per
 * mode, filter dilakukan CLIENT-SIDE dari `products/mine`/`fulfillments/mine`
 * (kedua endpoint sudah balas SEMUA mode, tidak ada perubahan backend).
 * `modeJual` DIKUNCI saat tambah produk baru (`ProductFormModal`
 * `defaultModeJual`) — supaya produk yang baru dibuat dari sini pasti
 * muncul di tab yang sama, bukan nyasar ke tab mode lain.
 *
 * Kartu dikelompokkan PER STATUS lewat TAB (draft/published/sold/expired +
 * "Semua", pola sama filter tab `ModePurchasesList`) — revisi dari versi
 * sebelumnya yang menumpuk semua grup status sekaligus (section stack),
 * sekarang cuma satu grid aktif per tab supaya lebih ringkas dipindai.
 * `FulfillmentProgress` TIDAK LAGI expand inline di kartu —
 * dipindah ke halaman detail tersendiri (`toko-saya/listing/[product_id]/`,
 * link "Detail" di tiap kartu) supaya lebih lega, bukan dijejalkan ke grid
 * card yang sempit.
 */
export function ModeListingManager({ modeJual, title }: ModeListingManagerProps) {
  const { marketId, linkBase, seller } = useTokoSaya();

  const [products, setProducts] = useState<Product[]>([]);
  const [fulfillments, setFulfillments] = useState<ProductFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Lihat catatan panjang di `produk-content.tsx` versi lama soal kenapa
  // `key` ini wajib ada (paksa remount total `ProductFormModal` tiap dibuka).
  const [modalSessionKey, setModalSessionKey] = useState(0);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTab>('ALL');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productList, fulfillmentList] = await Promise.all([
        apiClient<Product[]>(`/api/markets/${marketId}/products/mine`),
        apiClient<ProductFulfillment[]>(`/api/markets/${marketId}/fulfillments/mine`),
      ]);
      setProducts(productList);
      setFulfillments(fulfillmentList);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat daftar produk.');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    if (!seller) return;
    void loadData();
  }, [loadData, seller]);

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
      await loadData();
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
      await loadData();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal menghapus produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnpublish(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/unpublish`, { method: 'POST' });
      await loadData();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal menurunkan produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      const copy = await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/duplicate`, {
        method: 'POST',
      });
      await loadData();
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

  async function handleReList(productId: string) {
    setBusyId(productId);
    setRowError((prev) => ({ ...prev, [productId]: '' }));
    try {
      const relisted = await apiClient<Product>(`/api/markets/${marketId}/products/${productId}/re-list`, {
        method: 'POST',
      });
      await loadData();
      openEditModal(relisted);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [productId]: err instanceof ApiError ? err.message : 'Gagal melelang ulang produk.',
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (!seller) {
    return (
      <div className="space-y-4">
        <PageTitle>{title}</PageTitle>
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

  const modeProducts = products.filter((p) => p.mode_jual === modeJual);
  const fulfillmentByProduct = new Map(fulfillments.filter((f) => f.mode_jual === modeJual).map((f) => [f.product_id, f]));

  const statusTabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'ALL', label: 'Semua', count: modeProducts.length },
    ...STATUS_ORDER.map((status) => ({
      key: status,
      label: STATUS_LABEL[status],
      count: modeProducts.filter((p) => p.status === status).length,
    })),
  ];
  const visibleProducts = activeStatusTab === 'ALL' ? modeProducts : modeProducts.filter((p) => p.status === activeStatusTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageTitle>{title}</PageTitle>
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
      ) : modeProducts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Belum ada produk. Klik &ldquo;+ Tambah Produk&rdquo; untuk mulai berjualan.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStatusTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  activeStatusTab === tab.key
                    ? 'bg-[var(--brand-primary)] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Tidak ada produk di status ini.
            </p>
          ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {visibleProducts.map((product) => {
                  const cover = product.images?.[0] ?? null;
                  const isDraft = product.status === 'draft';
                  const hasFulfillment = fulfillmentByProduct.has(product.id);
                  const detailHref = `${linkBase}/toko-saya/listing/${product.id}`;
                  return (
                    <div
                      key={product.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                    >
                      <Link href={detailHref} className="aspect-square w-full bg-zinc-100">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                            Tidak ada gambar
                          </div>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={detailHref} className="line-clamp-2 text-sm font-medium text-zinc-900 hover:underline">
                            {product.name}
                          </Link>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[product.status]}`}
                          >
                            {STATUS_LABEL[product.status]}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[var(--brand-primary)]">
                          {currencyFormatter.format(
                            product.mode_jual === 'AUCTION' && product.current_highest_bid != null
                              ? product.current_highest_bid
                              : product.price,
                          )}
                        </p>
                        {product.mode_jual === 'AUCTION' && product.current_highest_bid != null && (
                          <p className="text-xs text-zinc-500">
                            Harga pembukaan: {currencyFormatter.format(product.price)}
                          </p>
                        )}
                        {hasFulfillment && (
                          <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            Progress pengiriman tersedia
                          </span>
                        )}

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
                                href={`${linkBase}/products/${product.slug}?view=owner`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                              >
                                Lihat Publik
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
                          {product.status === 'expired' && (
                            <button
                              type="button"
                              onClick={() => handleReList(product.id)}
                              disabled={busyId === product.id}
                              title="Bikin draft baru hasil copy produk ini untuk dilelang/dijual ulang"
                              className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                            >
                              {busyId === product.id ? '…' : 'Lelang Ulang'}
                            </button>
                          )}
                          <Link
                            href={detailHref}
                            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                          >
                            Detail
                          </Link>
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
        </div>
      )}

      <ProductFormModal
        key={modalSessionKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editingProduct}
        onSaved={loadData}
        defaultModeJual={modeJual}
      />
    </div>
  );
}
