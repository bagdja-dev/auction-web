import CatalogViewDefault from './default/catalog-view';
import ProductDetailViewDefault from './default/product-detail-view';

export interface RendererTemplate {
  CatalogView: typeof CatalogViewDefault;
  ProductDetailView: typeof ProductDetailViewDefault;
}

const TEMPLATES: Record<string, RendererTemplate> = {
  default: { CatalogView: CatalogViewDefault, ProductDetailView: ProductDetailViewDefault },
};

/**
 * Resolusi template renderer per Market (`market.template_id`, kolom sudah
 * ada sejak Fase 0 — "template terpilih dari katalog"). HANYA dipakai untuk
 * halaman katalog & detail produk PUBLIK — "Toko Saya" sengaja TIDAK ikut
 * sistem ini (layout statis/global, lihat
 * `app/[market_slug]/toko-saya/layout.tsx`).
 *
 * Baru ada 1 template ("default") — tambah entry baru di `TEMPLATES` di atas
 * begitu template lain siap, TIDAK perlu ubah kode pemanggil (page.tsx cukup
 * pakai `market.template_id` apa adanya).
 */
export function resolveTemplate(templateId: string | null): RendererTemplate {
  return TEMPLATES[templateId ?? 'default'] ?? TEMPLATES.default;
}
