'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

type EventHandler = (data: Record<string, unknown>) => void;

interface RealtimeContextValue {
  connected: boolean;
  /**
   * Daftarkan handler untuk satu `eventName` (mis. `auction.bid_placed`) —
   * balikannya fungsi unsubscribe, panggil di cleanup `useEffect` pemanggil.
   * Filter tambahan (mis. `product_id` tertentu) jadi tanggung jawab
   * consumer — server broadcast SEMUA event dari SEMUA produk/Market di
   * bawah app ini lewat satu koneksi yang sama (lihat catatan connect()).
   */
  subscribe: (eventName: string, handler: EventHandler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/** Dipakai fitur apa pun yang butuh event realtime (bidding sekarang, chat/dll ke depan) — WAJIB dirender di dalam `RealtimeProvider`. */
export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return ctx;
}

/**
 * SATU koneksi Socket.IO ke `bagdja-event-service` untuk SELURUH sesi
 * browsing di Market ini — dipasang di `app/[market_slug]/layout.tsx`
 * (layout persisten, TIDAK remount saat pindah halaman di dalam Market yang
 * sama, cuma remount kalau `market_slug` berubah). Sebelumnya tiap
 * komponen yang butuh realtime (mis. `auction-panel.tsx` di halaman detail
 * produk) bikin koneksi sendiri lewat `useAuctionRealtime` — begitu
 * navigasi keluar halaman itu, koneksinya ditutup, jadi notifikasi (mis.
 * "Anda ter-outbid") berhenti mengalir walau user masih login & masih ikut
 * lelang lain. Provider ini jadi PONDASI bersama: `useAuctionRealtime`
 * sekarang cuma `subscribe()` filtered ke context ini (bukan bikin socket
 * baru), dan fitur realtime lain ke depan (mis. chat) tinggal `subscribe()`
 * juga — tidak perlu koneksi baru lagi per fitur.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [connected, setConnected] = useState(false);

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
        // Best-effort — fitur yang bergantung ke realtime (mis. polling
        // fallback bidding) tetap jalan tanpa koneksi ini.
        console.error('[RealtimeProvider] gagal ambil ws-token:', err);
        return;
      }
      if (cancelled) return;

      const eventServiceUrl = process.env.NEXT_PUBLIC_EVENT_API || 'http://localhost:4085';
      // WAJIB `/events` (namespace socket.io `EventsGateway` di
      // bagdja-event-service) — lihat catatan panjang di riwayat
      // `use-auction-realtime.ts` versi lama soal bug ini (connect ke root
      // TANPA `/events` tampak "connected" tapi TIDAK PERNAH dapat event).
      const socket = io(`${eventServiceUrl}/events`, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('connect', () => !cancelled && setConnected(true));
      socket.on('disconnect', () => !cancelled && setConnected(false));

      // Server kirim SATU jenis message (`'event'`) untuk semua eventName —
      // Channel `auction-market.*` memuat SEMUA bid dari SEMUA produk/Market
      // (client auto-join semua channel di klaim `channels[]` JWT saat
      // connect, bukan channel per-produk), jadi setiap listener yang
      // subscribe ke satu `eventName` di sini menerima event dari SEMUA
      // produk/Market — filter product_id/dll jadi tanggung jawab consumer.
      socket.on('event', (event) => {
        const eventName = event?.data?.eventName;
        const eventData = event?.data?.data;
        if (!eventName || !eventData) return;
        const handlers = listenersRef.current.get(eventName);
        handlers?.forEach((handler) => handler(eventData));
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const subscribe = useCallback((eventName: string, handler: EventHandler) => {
    let handlers = listenersRef.current.get(eventName);
    if (!handlers) {
      handlers = new Set();
      listenersRef.current.set(eventName, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers?.delete(handler);
    };
  }, []);

  return <RealtimeContext.Provider value={{ connected, subscribe }}>{children}</RealtimeContext.Provider>;
}
