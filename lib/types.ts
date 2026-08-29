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
  mode_jual: ProductModeJual;
  status: ProductStatus;
  price: number;
  min_increment: number | null;
  auction_start_at: string | null;
  auction_end_at: string | null;
  stock: number;
  re_listed_from_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  slug: string;
  name: string;
  description?: string;
  images?: string[];
  mode_jual: ProductModeJual;
  price: number;
  min_increment?: number;
  auction_start_at?: string;
  auction_end_at?: string;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface UpdateSellerPayload {
  shop_name?: string;
}

export interface WalletBalance {
  id: string;
  currency_code: string;
  balance: number;
  held_balance: number;
  is_active: boolean;
}
