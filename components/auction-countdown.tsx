'use client';

import { useEffect, useState } from 'react';

/**
 * Countdown 3 fase lelang (polish 31 Agustus 2026, dipakai katalog +
 * detail): (1) pendaftaran ditutup, (2) lelang dimulai, (3) lelang
 * berakhir. Cuma SATU dari (1)+(2) atau (3) yang tampil sekaligus, sesuai
 * fase berjalan — (1) & (2) bisa BARENGAN (pendaftaran selalu ditutup <=
 * saat lelang mulai, `registration_deadline_minutes` dihitung MUNDUR dari
 * `auction_start_at`, lihat `AuctionRegistrationsService.register()`
 * backend — logic dihitung ulang persis sama di sini, BUKAN field baru dari
 * API, `market.registration_deadline_minutes` sudah ada di `Market` type).
 *
 * Satu `setInterval` tunggal (bukan 3 hook terpisah) — cukup buat 3 hitungan
 * sekaligus dari satu `nowMs`, hemat timer kalau dipasang di banyak kartu
 * katalog sekaligus.
 */

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}h ${hours}j`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}d`;
  return `${seconds}d`;
}

export interface AuctionCountdownProps {
  status: 'draft' | 'published' | 'sold' | 'expired';
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  /** `Market.registration_deadline_minutes` — null = pendaftaran buka sampai `auctionStartAt`. */
  registrationDeadlineMinutes: number | null;
  /** Katalog (kartu kecil) vs detail (lebih lega) — cuma beda ukuran teks. */
  compact?: boolean;
}

export function AuctionCountdown({
  status,
  auctionStartAt,
  auctionEndAt,
  registrationDeadlineMinutes,
  compact = false,
}: AuctionCountdownProps) {
  // Mulai `null` (SSR-safe) — `Date.now()` server vs client beda, isi baru
  // setelah mount supaya tidak mismatch hydration.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (status !== 'published' || nowMs == null || !auctionStartAt) return null;

  const startMs = new Date(auctionStartAt).getTime();
  const endMs = auctionEndAt ? new Date(auctionEndAt).getTime() : null;
  const regMs = registrationDeadlineMinutes != null ? startMs - registrationDeadlineMinutes * 60_000 : startMs;

  const lines: { label: string; value: string }[] = [];
  if (regMs > nowMs) {
    lines.push({ label: 'Pendaftaran ditutup', value: formatDuration(regMs - nowMs) });
  }
  if (startMs > nowMs) {
    lines.push({ label: 'Lelang dimulai', value: formatDuration(startMs - nowMs) });
  } else if (endMs && endMs > nowMs) {
    lines.push({ label: 'Lelang berakhir', value: formatDuration(endMs - nowMs) });
  }

  if (lines.length === 0) return null;

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {lines.map((l) => (
        <p key={l.label} className={compact ? 'text-[11px] text-zinc-500' : 'text-xs text-zinc-600'}>
          {l.label}: <span className="font-semibold text-[var(--brand-primary)]">{l.value}</span>
        </p>
      ))}
    </div>
  );
}
