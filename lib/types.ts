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

/** Satu baris mutasi wallet — `GET /api/wallet/transactions`. Positif = kredit (masuk), negatif = debit (keluar). */
export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: string;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  external_id: string | null;
  description: string | null;
  created_at: string;
  currency: string | null;
}

export interface WalletTransactionsResponse {
  data: WalletTransaction[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export type OrderStatus = 'PENDING_PAYMENT' | 'HELD' | 'FAILED';

/** Ringkasan produk untuk galeri media (`ProductMediaGallery`) — ditempel di `GET :id` Order/Settlement, lihat `common/dto/product-media-summary.dto.ts` (backend). */
export interface ProductMediaSummary {
  name: string;
  slug: string;
  images: string[] | null;
  video_url: string | null;
  model3d_url: string | null;
}

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
  /** Cuma terisi di `GET .../orders/:orderId` (relasi `product` di-load di sana). */
  product?: ProductMediaSummary;
}

/** Hasil `GET .../products/:productId/order` — sisi SELLER, dipakai `listing-detail-content.tsx` untuk lihat alamat kirim buyer. */
export interface OrderForSellerResponse {
  exists: boolean;
  order: Order | null;
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

export type AuctionRegistrationStatus = 'PENDING_PAYMENT' | 'HELD' | 'REFUNDED' | 'FORFEITED';

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
  bidder_username: string | null;
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

export type AuctionSettlementStatus = 'PENDING_PAYMENT' | 'HELD';

/** Tagihan pelunasan pemenang lelang (Fase 4) — `final_amount - deposit_amount`, escrow terpisah dari deposit. */
export interface AuctionSettlement {
  id: string;
  market_id: string;
  product_id: string;
  registration_id: string;
  buyer_user_id: string;
  seller_id: string;
  final_amount: number;
  deposit_amount: number;
  total_amount: number;
  currency: string;
  escrow_id: string | null;
  payment_request_id: string | null;
  checkout_url: string | null;
  status: AuctionSettlementStatus;
  created_at: string;
  updated_at: string;
  /** Cuma terisi di `GET .../settlements/:id` (relasi `product` di-load di sana). */
  product?: ProductMediaSummary;
}

export interface AuctionSettlementMeResponse {
  exists: boolean;
  settlement: AuctionSettlement | null;
}

export type MasterFlowFormFieldType = 'text' | 'textarea' | 'number' | 'image_url';

export interface MasterFlowFormField {
  key: string;
  label: string;
  type: MasterFlowFormFieldType;
  required: boolean;
}

/** Definisi satu step Master Flow (Fase 5) — SATU Master Flow berlaku untuk semua produk di Market. */
export interface MasterFlowStep {
  id: string;
  market_id: string;
  sequence: number;
  status_name: string;
  description: string | null;
  process_day: number | null;
  form_schema: MasterFlowFormField[] | null;
  release_percentage: number | null;
  guaranty_days: number | null;
  created_at: string;
  updated_at: string;
}

export type ProductFulfillmentStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface ProductFulfillment {
  id: string;
  market_id: string;
  product_id: string;
  seller_id: string;
  buyer_user_id: string;
  mode_jual: ProductModeJual;
  current_step_sequence: number;
  current_step_guaranty_ends_at: string | null;
  final_guaranty_ends_at: string | null;
  total_released: number;
  status: ProductFulfillmentStatus;
  created_at: string;
  updated_at: string;
}

export type ProductFulfillmentEventType =
  | 'STEP_COMPLETED'
  | 'STEP_RELEASE_APPROVED'
  | 'STEP_AUTO_RELEASED'
  | 'DELIVERED'
  | 'AUTO_DELIVERED';

export interface ProductFulfillmentLog {
  id: string;
  event_type: ProductFulfillmentEventType;
  step_sequence: number | null;
  step_status_name: string | null;
  form_data: Record<string, unknown> | null;
  release_amount: number | null;
  created_at: string;
}

/** Hasil `GET .../fulfillment`. */
export interface FulfillmentProgress {
  fulfillment: ProductFulfillment;
  steps: MasterFlowStep[];
  logs: ProductFulfillmentLog[];
  can_confirm: boolean;
  can_approve_current_step: boolean;
}

export type PurchaseCategory =
  | 'AWAITING_DEPOSIT'
  | 'ONGOING_AUCTION'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_SETTLEMENT'
  | 'IN_FULFILLMENT'
  | 'COMPLETED'
  | 'LOST'
  | 'FORFEITED'
  | 'FAILED';

/** Satu baris `GET .../purchases/mine` — halaman "Pembelian Saya" buyer. */
export interface PurchaseRow {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  mode_jual: ProductModeJual;
  category: PurchaseCategory;
  amount: number;
  currency: string;
  checkout_url: string | null;
  order_id: string | null;
  registration_id: string | null;
  settlement_id: string | null;
  fulfillment_id: string | null;
  updated_at: string;
}
