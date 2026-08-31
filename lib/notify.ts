'use client';

import { toast } from 'sonner';

/**
 * Fungsi notifikasi GLOBAL — dipakai realtime bidding (Fase 3.B) sekarang,
 * dan ditujukan untuk fungsi notifikasi lain ke depan (bukan cuma auction).
 * Sengaja bentuk fungsi biasa (bukan hook/context) supaya bisa dipanggil
 * dari mana saja — komponen, event handler, bahkan luar React tree — persis
 * gaya API `sonner` sendiri (`import { toast } from 'sonner'` dipakai
 * langsung di banyak tempat tanpa hook, lihat `bagdja-auction-admin`).
 *
 * `<Toaster />`-nya di-mount SEKALI di `app/layout.tsx` (posisi top-right).
 */

type NotifyOptions = {
  description?: string;
  duration?: number;
  /** Default `true` — set `false` utk notifikasi senyap (mis. toast error validasi form). */
  sound?: boolean;
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Satu nada — dipakai `playChime()`/`playVictoryFanfare()`, envelope attack-cepat/decay-exponential biar tidak "klik" di awal/akhir. */
function playTone(ctx: AudioContext, freq: number, start: number, duration: number, peakGain: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/**
 * Chime pendek 2 nada disintesis via Web Audio API — sengaja TIDAK pakai
 * file .mp3/.wav (tidak ada aset audio di repo ini, dan menambah file
 * binary baru cuma untuk satu bunyi notifikasi sederhana berlebihan).
 * Gagal diam-diam (try/catch) kalau browser blokir AudioContext (mis. tab
 * belum pernah ada interaksi user sama sekali) — toast visual tetap tampil.
 */
function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => playTone(ctx, freq, now + i * 0.09, 0.25, 0.15));
  } catch {
    // Web Audio API tidak tersedia/diblokir — toast visual tetap jalan tanpa suara.
  }
}

/**
 * Fanfare kemenangan (permintaan tambahan 31 Agustus 2026) — SENGAJA beda
 * dari `playChime()` biasa: arpeggio 4 nada naik (C5-E5-G5-C6, akor mayor —
 * "ta-da!"), oscillator `triangle` (lebih "berisi"/cerah dari `sine` polos),
 * nada terakhir jauh lebih panjang & lebih keras sbg aksen penutup. Dipicu
 * `useAuctionRealtime` (`hooks/use-auction-realtime.ts`) HANYA utk user
 * yang benar-benar menang lelang — chime `notify.success()` di toast
 * `auction.closed` disenyapkan (`sound:false`) khusus utk pemenang supaya
 * tidak tumpang tindih dgn fanfare ini; penonton lain tetap dapat chime
 * biasa seperti event lain.
 */
export function playVictoryFanfare() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      playTone(ctx, freq, now + i * 0.12, isLast ? 0.6 : 0.18, isLast ? 0.22 : 0.16, 'triangle');
    });
  } catch {
    // Web Audio API tidak tersedia/diblokir — modal/confetti tetap tampil tanpa suara.
  }
}

function withSound(options: NotifyOptions | undefined, fn: () => void) {
  if (options?.sound !== false) playChime();
  fn();
}

export function notify(message: string, options: NotifyOptions = {}) {
  withSound(options, () => toast(message, { description: options.description, duration: options.duration }));
}

notify.success = (message: string, options: NotifyOptions = {}) => {
  withSound(options, () => toast.success(message, { description: options.description, duration: options.duration }));
};

notify.error = (message: string, options: NotifyOptions = {}) => {
  withSound(options, () => toast.error(message, { description: options.description, duration: options.duration }));
};

notify.info = (message: string, options: NotifyOptions = {}) => {
  withSound(options, () => toast.info(message, { description: options.description, duration: options.duration }));
};

notify.warning = (message: string, options: NotifyOptions = {}) => {
  withSound(options, () => toast.warning(message, { description: options.description, duration: options.duration }));
};
