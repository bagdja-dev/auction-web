'use client';

import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { notify } from '@/lib/notify';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Product, PurchaseRow, SellersMeResponse } from '@/lib/types';
import { useRealtime } from './realtime-provider';

interface AuctionNotificationWatcherProps {
  marketId: string;
}

const WATCHLIST_REFRESH_MS = 60_000;

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/**
 * Fase 7 (`execution-plan.md`) — notifikasi lelang GLOBAL (lintas halaman,
 * lihat `realtime-provider.tsx`), untuk KEDUA sisi: buyer (peserta) dan
 * seller (penjual) — sebelumnya cuma buyer (outbid) yang dicover, dan
 * pesannya generik tanpa nama barang. Gantikan `auction-outbid-watcher.tsx`
 * (dihapus, superseded).
 *
 * Dua watchlist independen, sama-sama di-refresh berkala:
 * - `myBidsRef` (buyer) — dari `purchases.mine` kategori `ONGOING_AUCTION`,
 *   nama produk sudah ikut di situ.
 * - `myListingsRef` (seller) — dari `products/mine` (SKIP total kalau user
 *   belum daftar toko di Market ini, dicek dulu via `sellers/me`, pola sama
 *   `dashboard-content.tsx`), difilter `mode_jual='AUCTION' && status='published'`.
 *
 * Event yang di-global-kan: `auction.bid_placed` — seller SELALU dinotif
 * setiap ada bid baru di listingnya; buyer (peserta) JUGA SELALU dinotif
 * tiap ada bid baru di lelang yang diikuti ("Ada tawaran baru"), disamakan
 * dengan perilaku halaman detail produk (`use-auction-realtime.ts`) yang
 * menampilkan itu ke SIAPA SAJA yang sedang buka halaman itu — sebelumnya
 * versi global ini cuma nge-notif kalau ter-outbid, jadi peserta yang lagi
 * di halaman lain kehilangan update bid biasa (revisi 4 September 2026).
 * Kalau event yang sama BERSAMAAN bikin buyer ter-outbid, toast warning
 * yang lebih tegas dipakai SEBAGAI GANTI toast info biasa (satu event =
 * satu toast, bukan dobel). `auction.closed` juga di-global-kan (kedua
 * sisi, kalau produknya ada di watchlist masing-masing). `auction.started` SENGAJA
 * TIDAK di-global-kan — nilainya cuma relevan selagi user benar-benar ada
 * di halaman detail produk itu (sudah dihandle `use-auction-realtime.ts`).
 */
export function AuctionNotificationWatcher({ marketId }: AuctionNotificationWatcherProps) {
  const { user, isLoggedIn } = useAuth();
  const { subscribe } = useRealtime();

  const myBidsRef = useRef<Map<string, string>>(new Map());
  const myListingsRef = useRef<Map<string, string>>(new Map());
  const lastHighestBidderRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    async function loadMyBids() {
      try {
        const rows = await apiClient<PurchaseRow[]>(`/api/markets/${marketId}/purchases/mine`);
        if (cancelled) return;
        myBidsRef.current = new Map(
          rows.filter((r) => r.category === 'ONGOING_AUCTION').map((r) => [r.product_id, r.product_name]),
        );
      } catch (err) {
        if (err instanceof ApiError) {
          console.error('[AuctionNotificationWatcher] gagal muat lelang yang diikuti:', err.message);
        }
      }
    }

    void loadMyBids();
    const interval = setInterval(loadMyBids, WATCHLIST_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [marketId, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    async function loadMyListings() {
      try {
        const me = await apiClient<SellersMeResponse>(`/api/markets/${marketId}/sellers/me`);
        if (cancelled) return;
        if (!me.registered) {
          myListingsRef.current = new Map();
          return;
        }
        const products = await apiClient<Product[]>(`/api/markets/${marketId}/products/mine`);
        if (cancelled) return;
        myListingsRef.current = new Map(
          products
            .filter((p) => p.mode_jual === 'AUCTION' && p.status === 'published')
            .map((p) => [p.id, p.name]),
        );
      } catch (err) {
        if (err instanceof ApiError) {
          console.error('[AuctionNotificationWatcher] gagal muat listing lelang saya:', err.message);
        }
      }
    }

    void loadMyListings();
    const interval = setInterval(loadMyListings, WATCHLIST_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [marketId, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    const unsubBidPlaced = subscribe('auction.bid_placed', (eventData) => {
      const productId = eventData.product_id as string;
      const newHighestBidder = (eventData.highest_bidder_id as string | null) ?? null;
      const currentHighestBid = (eventData.current_highest_bid as number | null) ?? null;
      const previousHighestBidder = lastHighestBidderRef.current.get(productId) ?? null;
      lastHighestBidderRef.current.set(productId, newHighestBidder);

      const listingName = myListingsRef.current.get(productId);
      if (listingName) {
        notify.info(`Ada tawaran baru untuk "${listingName}"`, {
          description: currentHighestBid != null ? `Tawaran tertinggi sekarang ${currencyFormatter.format(currentHighestBid)}` : undefined,
        });
      }

      // Peserta ("Lelang yang Diikuti") — SELALU dapat notifikasi tiap ada
      // bid baru di lelang yang mereka ikuti (samakan dengan perilaku di
      // halaman detail produk, `use-auction-realtime.ts`, yang menampilkan
      // "Ada tawaran baru" ke SEMUA orang yang sedang buka halaman itu,
      // tanpa terkecuali "hanya yang ter-outbid" — sebelumnya versi global
      // ini cuma nge-notif kalau ter-outbid, jadi peserta yang lagi di
      // halaman lain kehilangan update biasa). Kalau event ini SEKALIGUS
      // bikin dia ter-outbid, tampilkan versi warning yang lebih tegas
      // (gantikan info biasa, bukan dobel toast untuk event yang sama).
      const bidName = myBidsRef.current.get(productId);
      if (bidName) {
        const gotOutbid = previousHighestBidder === user.userId && newHighestBidder !== user.userId;
        if (gotOutbid) {
          notify.warning(`Anda ter-outbid di lelang "${bidName}"!`, {
            description: 'Ada peserta lain yang mengajukan tawaran lebih tinggi.',
          });
        } else {
          notify.info(`Ada tawaran baru di lelang "${bidName}"`, {
            description: currentHighestBid != null ? `Tawaran tertinggi sekarang ${currencyFormatter.format(currentHighestBid)}` : undefined,
          });
        }
      }
    });

    const unsubClosed = subscribe('auction.closed', (eventData) => {
      const productId = eventData.product_id as string;
      const status = eventData.status as 'sold' | 'expired';
      const winnerUserId = (eventData.winner_user_id as string | null) ?? null;

      const listingName = myListingsRef.current.get(productId);
      if (listingName) {
        notify.success(
          status === 'sold' ? `Lelang "${listingName}" berakhir — Terjual` : `Lelang "${listingName}" berakhir — Tidak ada penawar`,
        );
      }

      const bidName = myBidsRef.current.get(productId);
      if (bidName) {
        const isWinner = status === 'sold' && winnerUserId === user.userId;
        notify(isWinner ? `Selamat! Anda memenangkan lelang "${bidName}"` : `Lelang "${bidName}" berakhir — Anda tidak menang`);
      }
    });

    return () => {
      unsubBidPlaced();
      unsubClosed();
    };
  }, [isLoggedIn, user, subscribe]);

  return null;
}
