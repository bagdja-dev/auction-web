'use client';

import { useEffect, useRef } from 'react';

import { notify, playVictoryFanfare } from '@/lib/notify';
import { useRealtime } from '@/components/realtime-provider';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/**
 * Subscriber event lelang untuk SATU produk — sejak restrukturisasi
 * "koneksi realtime global" (dipicu kebutuhan fitur outbid lintas halaman +
 * pondasi fitur realtime lain ke depan seperti chat), hook ini TIDAK LAGI
 * bikin koneksi Socket.IO sendiri. Koneksinya SATU untuk seluruh sesi
 * (`RealtimeProvider`, dipasang di `app/[market_slug]/layout.tsx`) — di
 * sini cuma `subscribe()` ke context itu, filter `product_id` tetap di sini
 * (server broadcast semua produk lewat channel yang sama, lihat catatan di
 * `realtime-provider.tsx`). Signature tidak berubah dari versi lama supaya
 * pemanggil (`auction-panel.tsx`) tidak perlu ikut diubah.
 */
export function useAuctionRealtime(
  productId: string,
  /**
   * ID user yang sedang login (dari `useAuth()`, `null` kalau belum
   * login/belum sempat kebaca cookie) — SATU-SATUNYA tujuan: bedakan suara
   * `auction.closed` antara pemenang (fanfare) vs penonton lain (chime
   * biasa). Bukan dipakai buat filter event (filter tetap `product_id`,
   * sama semua orang).
   */
  currentUserId: string | null,
  onBidPlaced: (data: {
    current_highest_bid: number | null;
    highest_bidder_id: string | null;
  }) => void,
  onAuctionClosed: (data: {
    status: 'sold' | 'expired';
    winner_user_id: string | null;
    final_amount: number | null;
  }) => void,
  /**
   * Dipanggil saat `auction.started` diterima — peserta yang standby di
   * halaman detail SEBELUM `auction_start_at` sebelumnya cuma mengandalkan
   * tick lokal 1 detik. Callback ini opsional (dipanggil TANPA argumen) —
   * cukup buat konsumen memicu ulang perhitungan lokalnya sendiri.
   */
  onAuctionStarted?: () => void,
) {
  const { subscribe } = useRealtime();

  // Callback bisa berubah tiap render (closure ke state terbaru) — simpan di
  // ref supaya effect subscribe/unsubscribe di bawah tidak perlu re-run
  // tiap kali callback berubah identitas.
  const onBidPlacedRef = useRef(onBidPlaced);
  const onAuctionClosedRef = useRef(onAuctionClosed);
  const onAuctionStartedRef = useRef(onAuctionStarted);
  const currentUserIdRef = useRef(currentUserId);
  onBidPlacedRef.current = onBidPlaced;
  onAuctionClosedRef.current = onAuctionClosed;
  onAuctionStartedRef.current = onAuctionStarted;
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    const unsubBidPlaced = subscribe('auction.bid_placed', (eventData) => {
      if (eventData.product_id !== productId) return;
      onBidPlacedRef.current({
        current_highest_bid: eventData.current_highest_bid as number | null,
        highest_bidder_id: eventData.highest_bidder_id as string | null,
      });
      notify.info('Ada tawaran baru', {
        description:
          eventData.current_highest_bid != null
            ? `Tawaran tertinggi sekarang ${currencyFormatter.format(eventData.current_highest_bid as number)}`
            : undefined,
      });
    });

    const unsubClosed = subscribe('auction.closed', (eventData) => {
      if (eventData.product_id !== productId) return;
      const status = eventData.status as 'sold' | 'expired';
      const winnerUserId = (eventData.winner_user_id as string | null) ?? null;
      const finalAmount = (eventData.final_amount as number | null) ?? null;
      onAuctionClosedRef.current({ status, winner_user_id: winnerUserId, final_amount: finalAmount });

      // Pemenang dapat fanfare (bukan chime biasa) — `notify.success()` di
      // bawah senyapkan chime-nya (`sound:false`) supaya tidak tumpang
      // tindih dgn fanfare.
      const isWinner = status === 'sold' && winnerUserId != null && winnerUserId === currentUserIdRef.current;
      if (isWinner) playVictoryFanfare();
      notify.success(status === 'sold' ? 'Lelang berakhir — Terjual' : 'Lelang berakhir — Tidak ada penawar', {
        sound: !isWinner,
        description: status === 'sold' && finalAmount != null ? `Harga final ${currencyFormatter.format(finalAmount)}` : undefined,
      });
    });

    const unsubStarted = subscribe('auction.started', (eventData) => {
      if (eventData.product_id !== productId) return;
      onAuctionStartedRef.current?.();
      notify.success('Lelang telah dimulai!', {
        description: 'Anda sekarang bisa mengajukan tawaran.',
      });
    });

    return () => {
      unsubBidPlaced();
      unsubClosed();
      unsubStarted();
    };
  }, [productId, subscribe]);
}
