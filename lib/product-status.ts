import type { Market, ProductPublic } from './api-client';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export interface CatalogStatusLabel {
  text: string;
  /** Baris kedua di dalam stempel (mis. harga pemenang) — cuma dipakai variant 'stamp'. */
  subtext?: string;
  /** Kelas warna Tailwind (bg+text) untuk badge — dipakai sama di semua template. */
  className: string;
  /**
   * 'stamp' = "Terjual"/"Dimenangkan" -- sengaja dibuat MENCOLOK (stempel
   * lingkaran merah menutupi tengah gambar), berfungsi juga sebagai media
   * promosi (AUCTION: tunjukkan harga pemenang jadi bukti lelang di platform
   * ini kompetitif; umum: "banyak barang berhasil terjual di sini"), bukan
   * cuma info netral.
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
  product: Pick<
    ProductPublic,
    'mode_jual' | 'status' | 'auction_start_at' | 'auction_end_at' | 'current_highest_bid'
  >,
  market: Pick<Market, 'registration_deadline_minutes'>,
): CatalogStatusLabel | null {
  const now = Date.now();
  const start = product.auction_start_at ? new Date(product.auction_start_at).getTime() : null;
  const end = product.auction_end_at ? new Date(product.auction_end_at).getTime() : null;

  // Dicek dari WAKTU + `current_highest_bid` (bukan cuma `status === 'sold'`)
  // supaya harga pemenang langsung tampil begitu auction_end_at lewat, tanpa
  // menunggu scheduler penutup lelang (BullMQ) sempat ubah status di DB --
  // job itu async, bisa telat/belum jalan sama sekali (mis. Redis belum
  // disiapkan), tapi dari sisi waktu lelangnya SUDAH pasti berakhir.
  if (product.mode_jual === 'AUCTION' && end != null && now >= end && product.current_highest_bid != null) {
    return {
      text: 'Dimenangkan',
      subtext: currencyFormatter.format(product.current_highest_bid),
      className: '',
      variant: 'stamp',
    };
  }

  if (product.status === 'sold') {
    // DIRECT_SELL sold, atau AUCTION 'sold' tapi entah kenapa tanpa
    // current_highest_bid tercatat (seharusnya tidak terjadi, jaga-jaga).
    return { text: 'Terjual', className: '', variant: 'stamp' };
  }

  if (product.mode_jual !== 'AUCTION' || product.status !== 'published') {
    return null;
  }

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
