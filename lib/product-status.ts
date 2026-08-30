import type { Market, ProductPublic } from './api-client';

export interface CatalogStatusLabel {
  text: string;
  /** Kelas warna Tailwind (bg+text) untuk badge — dipakai sama di semua template. */
  className: string;
  /**
   * 'stamp' = "Terjual" -- sengaja dibuat MENCOLOK (stempel lingkaran merah
   * menutupi tengah gambar), berfungsi juga sebagai media promosi ("banyak
   * barang berhasil terjual di platform ini"), bukan cuma info netral.
   * 'pill' = badge kecil biasa di pojok gambar (status lain yang lebih netral).
   */
  variant: 'stamp' | 'pill';
}

/**
 * Label status tambahan untuk kartu produk di katalog publik — badge mode
 * jual ("Lelang"/"Beli Langsung") TETAP ada terpisah, ini cuma info status
 * SIKLUS HIDUP produk itu di atasnya: null kalau tidak ada yang perlu
 * ditonjolkan (mis. AUCTION yang masih terbuka pendaftarannya, atau
 * DIRECT_SELL yang masih `published`).
 *
 * Produk berstatus `expired` tidak pernah sampai ke sini — sudah difilter
 * di `PublicService.getProducts()` (backend), TIDAK muncul sama sekali di
 * katalog (`overview.md`/diskusi 30 Agustus 2026: "selama belum expired
 * tetap muncul di katalog").
 */
export function getCatalogStatusLabel(
  product: Pick<ProductPublic, 'mode_jual' | 'status' | 'auction_start_at' | 'auction_end_at'>,
  market: Pick<Market, 'registration_deadline_minutes'>,
): CatalogStatusLabel | null {
  if (product.status === 'sold') {
    return { text: 'Terjual', className: '', variant: 'stamp' };
  }

  if (product.mode_jual !== 'AUCTION' || product.status !== 'published') {
    return null;
  }

  const now = Date.now();
  const start = product.auction_start_at ? new Date(product.auction_start_at).getTime() : null;
  const end = product.auction_end_at ? new Date(product.auction_end_at).getTime() : null;

  if (start != null && now >= start && (end == null || now < end)) {
    return { text: 'Lelang berlangsung', className: 'bg-[var(--brand-primary)] text-white', variant: 'pill' };
  }

  if (start != null && market.registration_deadline_minutes != null) {
    const deadline = start - market.registration_deadline_minutes * 60_000;
    if (now >= deadline && now < start) {
      return { text: 'Pendaftaran ditutup', className: 'bg-zinc-500 text-white', variant: 'pill' };
    }
  }

  return null;
}
