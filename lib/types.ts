/**
 * Tipe data ber-auth (lewat BFF proxy) yang dipertukarkan dengan
 * `bagdja-auction-api`. Sama persis dengan `bagdja-auction-admin/src/lib/types.ts`
 * untuk bagian Seller/Product — ASUMSIKAN shape ini persis sampai ada
 * perubahan eksplisit dari sisi API.
 */

export type ProductModeJual = 'AUCTION' | 'DIRECT_SELL';
export type ProductStatus = 'draft' | 'published' | 'sold' | 'expired';

export interface Seller {
  id: string;
  market_id: string;
  user_id: string;
  shop_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SellersMeResponse {
  registered: boolean;
  seller: Seller | null;
}

export interface Product {
  id: string;
  market_id: string;
  seller_id: string;
  slug: string;
  name: string;
  description: string | null;
  images: string[] | null;
  video_url: string | null;
  model3d_url: string | null;
  mode_jual: ProductModeJual;
  status: ProductStatus;
  price: number;
  min_increment: number | null;
  auction_start_at: string | null;
  auction_end_at: string | null;
  stock: number;
  re_listed_from_id: string | null;
  /** Berat/dimensi untuk hitung ongkir — default kalau kosong: 250g, 30x30x5cm. */
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  /** Nama area asal pengiriman produk ini (hasil pilih dari shipping area search) — WAJIB diisi sebelum produk ini bisa dibeli. */
  shipping_origin_area_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  slug: string;
  name: string;
  description?: string;
  images?: string[];
  video_url?: string;
  model3d_url?: string;
  mode_jual: ProductModeJual;
  price: number;
  min_increment?: number;
  auction_start_at?: string;
  auction_end_at?: string;
  weight_grams?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_origin_area_name?: string | null;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface UpdateSellerPayload {
  shop_name?: string;
}

/** Hasil `GET /api/public/shipping/areas?q=` — no-auth, dipakai autocomplete alamat tujuan. */
export interface ShippingArea {
  providerAreaId: string;
  name: string;
  type: string;
}

/** Hasil `POST /api/markets/:marketId/products/:productId/shipping/cost`. */
export interface ShippingCostOption {
  courierCode: string;
  serviceName: string;
  cost: number;
  etdMinDays?: number;
  etdMaxDays?: number;
}

export interface WalletBalance {
  id: string;
  currency_code: string;
  balance: number;
  held_balance: number;
  is_active: boolean;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'HELD' | 'FAILED';

export interface Order {
  id: string;
  market_id: string;
  product_id: string;
  seller_id: string;
  buyer_user_id: string;
  recipient_name: string;
  phone: string;
  address: string;
  total_amount: number;
  currency: string;
  escrow_id: string | null;
  payment_request_id: string | null;
  checkout_url: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  shipping_cost: number;
  destination_area_id: string;
  destination_area_name: string | null;
  courier_code: string;
  courier_service_name: string | null;
}

export interface CheckoutPayload {
  recipient_name: string;
  phone: string;
  address: string;
  destination_area_id: string;
  destination_area_name?: string;
  courier_code: string;
  courier_service_name?: string;
}

export type AuctionRegistrationStatus = 'PENDING_PAYMENT' | 'HELD';

/** Registrasi + deposit lelang — pasangan `Order` di atas tapi untuk mode AUCTION (Fase 3). */
export interface AuctionRegistration {
  id: string;
  market_id: string;
  product_id: string;
  buyer_user_id: string;
  recipient_name: string;
  phone: string;
  address: string;
  destination_area_id: string;
  destination_area_name: string;
  deposit_amount: number;
  currency: string;
  escrow_id: string | null;
  payment_request_id: string | null;
  checkout_url: string | null;
  status: AuctionRegistrationStatus;
  created_at: string;
  updated_at: string;
}

export interface RegisterAuctionPayload {
  recipient_name: string;
  phone: string;
  address: string;
  destination_area_id: string;
  destination_area_name: string;
}

export interface AuctionRegistrationMeResponse {
  registered: boolean;
  registration: AuctionRegistration | null;
}

/** Hasil `GET .../deposit-preview`. */
export interface DepositPreview {
  deposit_amount: number;
  currency: string;
}

/** Satu baris tawaran lelang. */
export interface AuctionBid {
  id: string;
  product_id: string;
  bidder_user_id: string;
  amount: number;
  created_at: string;
}

/** Hasil `POST .../bids` — bid yang baru dibuat + snapshot produk terbaru. */
export interface PlaceBidResponse {
  bid: AuctionBid;
  product: {
    current_highest_bid: number | null;
    highest_bidder_id: string | null;
    status: ProductStatus;
    [key: string]: unknown;
  };
}
