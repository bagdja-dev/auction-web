'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { notify, playVictoryFanfare } from '@/lib/notify';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/**
 * Subscriber WebSocket Fase 3.B (`execution-plan.md`) — pola PERSIS
 * `core/bagdja-console/src/components/NotificationDropdown.tsx`, cuma beda
 * kriteria filter (`product_id`, bukan `userId`) dan sumber token (endpoint
 * publik `/api/realtime/ws-token`, bukan JWT buyer — halaman lelang boleh
 * ditonton tanpa login).
 *
 * Channel `auction-market.*` memuat SEMUA bid dari SEMUA produk/Market di
 * bawah app ini (client auto-join semua channel di klaim `channels[]` JWT
 * saat connect, bukan channel per-produk) — makanya filter `product_id`
 * WAJIB dilakukan di sini, server tidak memfilter per-produk.
 */
export function useAuctionRealtime(
  productId: string,
  /**
   * ID user yang sedang login (dari `useAuth()`, `null` kalau belum
   * login/belum sempat kebaca cookie) — polish 31 Agustus 2026, dipakai
   * SATU-SATUNYA tujuan: bedakan suara `auction.closed` antara pemenang
   * (fanfare) vs penonton lain (chime biasa). Bukan dipakai buat filter
   * event (filter tetap `product_id`, sama semua orang).
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
   * Dipanggil saat `auction.started` diterima (polish 31 Agustus 2026) —
   * peserta yang standby di halaman detail SEBELUM `auction_start_at`
   * sebelumnya cuma mengandalkan tick lokal 1 detik (`setInterval` di
   * `BiddingSection`) buat pindah ke mode bid, yang bisa telat kalau tab
   * browser di-throttle background. Callback ini opsional (dipanggil TANPA
   * argumen) — cukup buat konsumen memicu ulang perhitungan `hasStarted`
   * miliknya sendiri (mis. `setNowMs(Date.now())`), bukan bawa data baru.
   */
  onAuctionStarted?: () => void,
) {
  const socketRef = useRef<Socket | null>(null);
  // Callback bisa berubah tiap render (closure ke state terbaru) — simpan di
  // ref supaya effect connect/disconnect di bawah tidak perlu re-run tiap
  // kali callback berubah identitas.
  const onBidPlacedRef = useRef(onBidPlaced);
  const onAuctionClosedRef = useRef(onAuctionClosed);
  const onAuctionStartedRef = useRef(onAuctionStarted);
  const currentUserIdRef = useRef(currentUserId);
  onBidPlacedRef.current = onBidPlaced;
  onAuctionClosedRef.current = onAuctionClosed;
  onAuctionStartedRef.current = onAuctionStarted;
  currentUserIdRef.current = currentUserId;

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      let token: string;
      try {
        const res = await fetch('/api/realtime/ws-token');
        if (!res.ok) throw new Error(`ws-token ${res.status}`);
        const data = (await res.json()) as { access_token: string };
        token = data.access_token;
      } catch (err) {
        // Best-effort — polling fallback di BiddingSection tetap jalan
        // kalau realtime gagal connect (mis. Event Hub down).
        console.error('[useAuctionRealtime] gagal ambil ws-token:', err);
        return;
      }
      if (cancelled) return;

      const eventServiceUrl = process.env.NEXT_PUBLIC_EVENT_API || 'http://localhost:4085';
      // WAJIB `/events` (namespace socket.io `EventsGateway` di
      // bagdja-event-service, lihat `@WebSocketGateway({ namespace: 'events' })`)
      // — connect ke root TANPA ini masuk namespace default `/` yang tidak
      // punya handler apa pun terdaftar: socket tampak "connected" (tidak
      // error), tapi `handleConnection()` (auth+join channel) di sisi
      // server TIDAK PERNAH jalan, jadi tidak pernah dapat event apa pun.
      // Diverifikasi manual 31 Agustus 2026 — konek ke root: tidak pernah
      // dapat 'authenticated'; konek ke `/events`: dapat 'authenticated'
      // + channels terisi benar. Bug yang sama kemungkinan juga ada di
      // `core/bagdja-console/src/components/NotificationDropdown.tsx`
      // (pola sumbernya, sama-sama tanpa `/events`) — di luar scope
      // perbaikan ini, belum dikonfirmasi/disentuh.
      const socket = io(`${eventServiceUrl}/events`, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('event', (event) => {
        const eventName = event?.data?.eventName;
        const eventData = event?.data?.data;
        if (!eventData || eventData.product_id !== productId) return;

        if (eventName === 'auction.bid_placed') {
          onBidPlacedRef.current({
            current_highest_bid: eventData.current_highest_bid,
            highest_bidder_id: eventData.highest_bidder_id,
          });
          notify.info('Ada tawaran baru', {
            description:
              eventData.current_highest_bid != null
                ? `Tawaran tertinggi sekarang ${currencyFormatter.format(eventData.current_highest_bid)}`
                : undefined,
          });
        } else if (eventName === 'auction.closed') {
          onAuctionClosedRef.current({
            status: eventData.status,
            winner_user_id: eventData.winner_user_id ?? null,
            final_amount: eventData.final_amount ?? null,
          });
          // Pemenang dapat fanfare (bukan chime biasa) — dicek di sini
          // (bukan cuma di BiddingSection) supaya `notify.success()` di
          // bawah bisa senyapkan chime-nya (`sound:false`), mencegah dua
          // suara tumpang tindih (chime + fanfare) tepat di momen yang sama.
          const isWinner =
            eventData.status === 'sold' &&
            eventData.winner_user_id != null &&
            eventData.winner_user_id === currentUserIdRef.current;
          if (isWinner) playVictoryFanfare();
          notify.success(eventData.status === 'sold' ? 'Lelang berakhir — Terjual' : 'Lelang berakhir — Tidak ada penawar', {
            sound: !isWinner,
            description:
              eventData.status === 'sold' && eventData.final_amount != null
                ? `Harga final ${currencyFormatter.format(eventData.final_amount)}`
                : undefined,
          });
        } else if (eventName === 'auction.started') {
          onAuctionStartedRef.current?.();
          notify.success('Lelang telah dimulai!', {
            description: 'Anda sekarang bisa mengajukan tawaran.',
          });
        }
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [productId]);
}
