/**
 * Client Public API (no-auth) untuk web renderer — lihat
 * `bagdja-auction-api` modul public. Pola `fetchPublic` (fetch server-side
 * dengan `next: { revalidate }`) sama seperti `bagdja-website/lib/api-client.ts`.
 */

import type { ShippingArea } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5010';

export type ProductModeJual = 'AUCTION' | 'DIRECT_SELL';
export type ProductStatus = 'draft' | 'published' | 'sold' | 'expired';

export interface Market {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  template_id: string | null;
  is_active: boolean;
}

export interface ProductPublic {
  id: string;
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
  created_at: string;
  seller_shop_name: string | null;
  weight_grams?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

async function fetchPublic<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Bagdja Auction API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export function getMarketBySlug(slug: string): Promise<Market | null> {
  return fetchPublic<Market>(`/api/public/markets/${encodeURIComponent(slug)}`);
}

export interface ProductsQuery {
  page?: number;
  size?: number;
  mode_jual?: ProductModeJual;
}

const EMPTY_PRODUCTS: PaginatedResult<ProductPublic> = { items: [], page: 1, size: 20, total: 0 };

export async function getMarketProducts(
  slug: string,
  opts: ProductsQuery = {},
): Promise<PaginatedResult<ProductPublic>> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.size) params.set('size', String(opts.size));
  if (opts.mode_jual) params.set('mode_jual', opts.mode_jual);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const result = await fetchPublic<PaginatedResult<ProductPublic>>(
    `/api/public/markets/${encodeURIComponent(slug)}/products${qs}`,
  );
  return result ?? EMPTY_PRODUCTS;
}

export function getMarketProductBySlug(
  slug: string,
  productSlug: string,
): Promise<ProductPublic | null> {
  return fetchPublic<ProductPublic>(
    `/api/public/markets/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}`,
  );
}

/**
 * Cari area tujuan pengiriman (no-auth) — dipanggil langsung dari browser
 * (bukan lewat BFF proxy, karena publik & `NEXT_PUBLIC_API_URL` sudah
 * di-inline ke bundle client). Dipakai `ShippingAreaAutocomplete`.
 */
export async function searchShippingAreas(query: string): Promise<ShippingArea[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await fetch(`${API_URL}/api/public/shipping/areas?q=${encodeURIComponent(trimmed)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data : [];
}
