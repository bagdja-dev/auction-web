'use client';

import confetti from 'canvas-confetti';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import { NumberInput } from '@/components/number-input';
import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { useAuctionRealtime } from '@/hooks/use-auction-realtime';
import { useAuth } from '@/hooks/use-auth';
import { useSellerAddressPrefill } from '@/hooks/use-seller-address';
import { getMarketProductBySlug, type ProductStatus } from '@/lib/api-client';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type {
  AuctionBid,
  AuctionRegistration,
  AuctionRegistrationMeResponse,
  AuctionSettlement,
  AuctionSettlementMeResponse,
  DepositPreview,
  PlaceBidResponse,
  RegisterAuctionPayload,
  ShippingCostOption,
} from '@/lib/types';

export interface AuctionPanelProps {
  marketId: string;
  marketSlug: string;
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  productId: string;
  productSlug: string;
  startingPrice: number;
  minIncrement: number | null;
  initialHighestBid: number | null;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  productStatus: ProductStatus;
  registrationDeadlineMinutes: number | null;
  /** User id pemenang lelang (Fase 4) — dipakai deteksi "Anda menang" persisten (bukan cuma dari event realtime), lihat `BiddingSection`. */
  highestBidderId: string | null;
  /** Mode lihat-saja untuk pemilik produk (dibuka dari "Toko Saya" lewat `?view=owner`) — lihat sesi lelang tanpa bisa daftar/menawar. */
  readOnly?: boolean;
  /**
   * `false` = Market ini tidak pakai registrasi/deposit (permintaan
   * pasca-demo 2026-09-07) — skip total fetch status registrasi & form
   * registrasi, buyer langsung lihat `BiddingSection`.
   */
  requiresRegistration: boolean;
}

// Fase 3.B (execution-plan.md) — realtime WebSocket jadi mekanisme utama,
// polling di bawah cuma fallback reconciliation kalau event terlewat/socket
// putus, makanya interval dilonggarkan dari 3 detik jadi 30 detik.
const POLL_INTERVAL_MS = 30_000;

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * `registrationDeadlineMinutes` (polish 31 Agustus 2026) — SEBELUMNYA cuma
 * cek `auctionStartAt`/`auctionEndAt`, padahal backend
 * (`AuctionRegistrationsService.register()`) juga menolak lebih awal kalau
 * `Market.registration_deadline_minutes` diisi (batas menit SEBELUM
 * `auction_start_at`). Celah ini bikin form tampak masih aktif padahal
 * submit-nya pasti 400 — ditemukan & ditutup di sini, dihitung ulang persis
 * sama dengan logic backend.
 */
function isClosedForRegistration(
  productStatus: ProductStatus,
  auctionStartAt: string | null,
  auctionEndAt: string | null,
  registrationDeadlineMinutes: number | null,
): boolean {
  if (productStatus !== 'published') return true;
  if (auctionEndAt && Date.now() >= new Date(auctionEndAt).getTime()) return true;
  if (auctionStartAt && Date.now() >= new Date(auctionStartAt).getTime()) return true;
  if (auctionStartAt && registrationDeadlineMinutes != null) {
    const deadline = new Date(auctionStartAt).getTime() - registrationDeadlineMinutes * 60_000;
    if (Date.now() >= deadline) return true;
  }
  return false;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">{children}</div>;
}

function HighestBidSummary({
  highestBid,
  startingPrice,
  highestBidderUsername,
  isCurrentUserHighestBidder,
}: {
  highestBid: number | null;
  startingPrice: number;
  /** Nama peserta pemasang tawaran tertinggi — cuma terisi di `BiddingSection` (butuh `history`), kosong di pemanggil lain (`RegistrationForm`, sebelum login) yang belum fetch riwayat tawaran. */
  highestBidderUsername?: string | null;
  /** `true` = tawaran tertinggi ini punya user yang sedang login — tampilkan "(Anda)" alih-alih/di samping nama. */
  isCurrentUserHighestBidder?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-500">Tawaran tertinggi saat ini</p>
      <p className="text-xl font-semibold text-[var(--brand-primary)]">
        {highestBid != null
          ? currencyFormatter.format(highestBid)
          : `Belum ada tawaran (harga awal ${currencyFormatter.format(startingPrice)})`}
      </p>
      <div className="min-h-[1.25rem]">
         {highestBid != null && highestBidderUsername && (
        <p className="text-xs text-zinc-500">
          oleh {highestBidderUsername}
          {isCurrentUserHighestBidder && ' (Anda)'}
        </p>
      )}
      </div>
     
    </div>
  );
}

/**
 * Panel utama section AUCTION di halaman detail produk — menggantikan tombol
 * "Segera Hadir" lama. State machine berdasar status login + registrasi +
 * waktu lelang, lihat pembagian komponen di bawah (Registrasi / Menunggu
 * Bayar / Bidding). Ditaruh satu file karena semuanya cuma dipakai di sini.
 */
export function AuctionPanel({
  marketId,
  marketSlug,
  linkBase,
  productId,
  productSlug,
  startingPrice,
  minIncrement,
  initialHighestBid,
  auctionStartAt,
  auctionEndAt,
  productStatus,
  registrationDeadlineMinutes,
  highestBidderId,
  readOnly = false,
  requiresRegistration,
}: AuctionPanelProps) {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const loginHref = `/auth/login?next=${encodeURIComponent(`${linkBase}/products/${productSlug}`)}`;

  const [registration, setRegistration] = useState<AuctionRegistration | null>(null);
  // Market requiresRegistration=false — tidak ada apapun untuk dicek, anggap
  // "sudah dicek" dari awal supaya langsung lompat ke BiddingSection.
  const [registrationChecked, setRegistrationChecked] = useState(!requiresRegistration);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Cek status registrasi SEKALI begitu diketahui user login — tidak nge-fetch
  // sama sekali kalau belum login (cek `useAuth()` dari cookie, tanpa API call),
  // kalau `readOnly` (pemilik produk, tidak relevan cek registrasi buyer),
  // ATAU kalau Market ini requiresRegistration=false (tidak ada yang perlu dicek).
  useEffect(() => {
    if (readOnly || authLoading || !isLoggedIn || !requiresRegistration) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient<AuctionRegistrationMeResponse>(
          `/api/markets/${marketId}/products/${productId}/registrations/me`,
        );
        if (cancelled) return;
        setRegistration(data.registration);
      } catch (err) {
        if (cancelled) return;
        setRegistrationError(err instanceof ApiError ? err.message : 'Gagal memuat status registrasi.');
      } finally {
        if (!cancelled) setRegistrationChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readOnly, authLoading, isLoggedIn, marketId, productId]);

  if (readOnly) {
    return (
      <PanelShell>
        <BiddingSection
          marketId={marketId}
          marketSlug={marketSlug}
          productId={productId}
          productSlug={productSlug}
          startingPrice={startingPrice}
          minIncrement={minIncrement}
          initialHighestBid={initialHighestBid}
          auctionStartAt={auctionStartAt}
          auctionEndAt={auctionEndAt}
          initialProductStatus={productStatus}
          highestBidderId={highestBidderId}
          requiresRegistration={requiresRegistration}
          registration={registration}
          readOnly
        />
      </PanelShell>
    );
  }

  if (authLoading) {
    return (
      <PanelShell>
        <p className="text-sm text-zinc-400">Memuat…</p>
      </PanelShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <PanelShell>
        <HighestBidSummary highestBid={initialHighestBid} startingPrice={startingPrice} />
        <Link
          href={loginHref}
          className="block w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          Masuk untuk Ikut Lelang
        </Link>
      </PanelShell>
    );
  }

  if (!registrationChecked) {
    return (
      <PanelShell>
        <p className="text-sm text-zinc-400">Memuat status registrasi…</p>
      </PanelShell>
    );
  }

  if (registrationError && !registration) {
    return (
      <PanelShell>
        <p className="text-sm text-[var(--brand-error)]">{registrationError}</p>
      </PanelShell>
    );
  }

  if (requiresRegistration && !registration) {
    return (
      <PanelShell>
        <RegistrationForm
          marketId={marketId}
          productId={productId}
          productStatus={productStatus}
          auctionStartAt={auctionStartAt}
          auctionEndAt={auctionEndAt}
          registrationDeadlineMinutes={registrationDeadlineMinutes}
          highestBid={initialHighestBid}
          startingPrice={startingPrice}
          onRegistered={setRegistration}
        />
      </PanelShell>
    );
  }

  if (registration?.status === 'PENDING_PAYMENT') {
    return (
      <PanelShell>
        <PendingPaymentSection marketId={marketId} registration={registration} onUpdate={setRegistration} />
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <BiddingSection
        marketId={marketId}
        marketSlug={marketSlug}
        productId={productId}
        productSlug={productSlug}
        startingPrice={startingPrice}
        minIncrement={minIncrement}
        initialHighestBid={initialHighestBid}
        auctionStartAt={auctionStartAt}
        auctionEndAt={auctionEndAt}
        initialProductStatus={productStatus}
        highestBidderId={highestBidderId}
        requiresRegistration={requiresRegistration}
        registration={registration}
      />
    </PanelShell>
  );
}

/** Belum registrasi — tampilkan estimasi deposit + form pendaftaran (kalau masih dibuka). */
function RegistrationForm({
  marketId,
  productId,
  productStatus,
  auctionStartAt,
  auctionEndAt,
  registrationDeadlineMinutes,
  highestBid,
  startingPrice,
  onRegistered,
}: {
  marketId: string;
  productId: string;
  productStatus: ProductStatus;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  registrationDeadlineMinutes: number | null;
  highestBid: number | null;
  startingPrice: number;
  /** Dipanggil begitu registrasi berhasil TANPA `checkout_url` (tier deposit
   * 0% — backend langsung `HELD`, tidak ada yang perlu dibayar, lihat
   * `auction-registrations.service.ts`) — update state Market panel supaya
   * langsung pindah ke `BiddingSection`, TANPA redirect ke pembayaran. */
  onRegistered: (registration: AuctionRegistration) => void;
}) {
  const closed = isClosedForRegistration(productStatus, auctionStartAt, auctionEndAt, registrationDeadlineMinutes);
  // Dicek dari WAKTU (bukan cuma `productStatus`) supaya pesan tetap benar
  // walau scheduler penutup lelang belum sempat ubah status ke sold/expired
  // (mis. Redis/BullMQ belum jalan) — tanpa ini, lelang yang sudah lewat
  // auction_end_at tapi statusnya masih 'published' salah tampil "sudah
  // dimulai" padahal seharusnya "sudah berakhir".
  const hasEnded = productStatus !== 'published' || (!!auctionEndAt && Date.now() >= new Date(auctionEndAt).getTime());
  const alreadyStarted = !!auctionStartAt && Date.now() >= new Date(auctionStartAt).getTime();

  const [deposit, setDeposit] = useState<DepositPreview | null>(null);
  const [depositLoading, setDepositLoading] = useState(true);
  const [depositError, setDepositError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [destinationArea, setDestinationArea] = useState<ShippingAreaSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill alamat dari alamat toko buyer sendiri (kalau dia JUGA terdaftar
  // sebagai seller di Market ini dan sudah isi alamat tokonya) — permintaan
  // 2026-09-07. Guard "masih kosong" supaya tidak menimpa ketikan user kalau
  // fetch ini kebetulan resolve setelah user mulai isi form sendiri.
  const sellerAddress = useSellerAddressPrefill(marketId);
  useEffect(() => {
    if (sellerAddress.address) {
      setAddress((prev) => prev || sellerAddress.address!);
    }
    if (sellerAddress.shippingArea) {
      setDestinationArea((prev) => prev ?? sellerAddress.shippingArea);
    }
  }, [sellerAddress]);

  useEffect(() => {
    if (closed) {
      setDepositLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient<DepositPreview>(
          `/api/markets/${marketId}/products/${productId}/deposit-preview`,
        );
        if (!cancelled) setDeposit(data);
      } catch (err) {
        if (!cancelled) {
          setDepositError(err instanceof ApiError ? err.message : 'Gagal memuat estimasi deposit.');
        }
      } finally {
        if (!cancelled) setDepositLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketId, productId, closed]);

  if (closed) {
    return (
      <div>
        <HighestBidSummary highestBid={highestBid} startingPrice={startingPrice} />
        <p className="mt-3 text-sm font-medium text-zinc-600">
          {hasEnded
            ? 'Lelang sudah berakhir.'
            : alreadyStarted
              ? 'Pendaftaran sudah ditutup — lelang sudah dimulai.'
              : 'Pendaftaran lelang sudah ditutup.'}
        </p>
      </div>
    );
  }

  const canSubmit =
    recipientName.trim() !== '' &&
    phone.trim() !== '' &&
    address.trim() !== '' &&
    destinationArea !== null &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!destinationArea) {
      setError('Pilih alamat tujuan terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: RegisterAuctionPayload = {
        recipient_name: recipientName,
        phone,
        address,
        destination_area_id: destinationArea.providerAreaId,
        destination_area_name: destinationArea.name,
      };

      const registration = await apiClient<AuctionRegistration>(
        `/api/markets/${marketId}/products/${productId}/register`,
        { method: 'POST', body: JSON.stringify(payload) },
      );

      if (!registration.checkout_url) {
        // Tier deposit 0% — backend sudah HELD langsung tanpa escrow (lihat
        // `auction-registrations.service.ts`), tidak ada yang perlu dibayar.
        // Bukan error — langsung tampilkan panel bidding, pola sama
        // `handleTebusSekarang` untuk edge case `total_amount<=0`.
        onRegistered(registration);
        return;
      }

      window.location.href = registration.checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mendaftar lelang.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <HighestBidSummary highestBid={highestBid} startingPrice={startingPrice} />

      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
        <p className="text-zinc-500">Deposit untuk ikut lelang</p>
        {depositLoading ? (
          <p className="text-zinc-400">Menghitung deposit…</p>
        ) : depositError ? (
          <p className="text-[var(--brand-error)]">{depositError}</p>
        ) : deposit ? (
          <p className="text-base font-semibold text-zinc-900">{currencyFormatter.format(deposit.deposit_amount)}</p>
        ) : (
          <p className="text-zinc-400">-</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Penerima</label>
          <input
            type="text"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Nomor Telepon</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat</label>
          <textarea
            required
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Tujuan</label>
          <ShippingAreaAutocomplete value={destinationArea} onChange={setDestinationArea} />
        </div>

        {error && <p className="text-sm text-[var(--brand-error)]">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {submitting ? 'Memproses…' : 'Daftar & Bayar Deposit'}
        </button>
      </form>
    </div>
  );
}

/** Sudah registrasi tapi deposit belum lunas — buyer sedang di luar halaman bayar, cek manual (tanpa auto-polling). */
function PendingPaymentSection({
  marketId,
  registration,
  onUpdate,
}: {
  marketId: string;
  registration: AuctionRegistration;
  onUpdate: (registration: AuctionRegistration) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckStatus() {
    setChecking(true);
    setError(null);
    try {
      const data = await apiClient<AuctionRegistration>(`/api/markets/${marketId}/registrations/${registration.id}`);
      onUpdate(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat status pendaftaran.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">Deposit belum dibayar</p>
        <p className="mt-1 text-sm text-amber-700">
          Nominal deposit: {currencyFormatter.format(registration.deposit_amount)}. Selesaikan pembayaran untuk bisa
          ikut menawar.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--brand-error)]">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        {registration.checkout_url && (
          <a
            href={registration.checkout_url}
            className="flex-1 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
          >
            Lanjutkan Pembayaran
          </a>
        )}
        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={checking}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-white disabled:opacity-50"
        >
          {checking ? 'Memeriksa…' : 'Cek Status'}
        </button>
      </div>
    </div>
  );
}

/** Deposit sudah HELD — interface bidding: highest bid (polling 3 detik), form tawar, riwayat tawaran. */
function BiddingSection({
  marketId,
  marketSlug,
  productId,
  productSlug,
  startingPrice,
  minIncrement,
  initialHighestBid,
  auctionStartAt,
  auctionEndAt,
  initialProductStatus,
  highestBidderId,
  readOnly = false,
  requiresRegistration,
  registration,
}: {
  marketId: string;
  marketSlug: string;
  productId: string;
  productSlug: string;
  startingPrice: number;
  minIncrement: number | null;
  initialHighestBid: number | null;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  initialProductStatus: ProductStatus;
  highestBidderId: string | null;
  readOnly?: boolean;
  /** `false` = tidak ada baris registrasi sama sekali — "Tebus Sekarang" perlu form alamat sendiri sebelum bisa submit. */
  requiresRegistration: boolean;
  /** Registrasi buyer (kalau `requiresRegistration=true`) — dipakai ambil `destination_area_id` untuk hitung ongkir saat pelunasan, alamat sudah final sejak registrasi jadi tidak perlu form alamat lagi di sini. */
  registration: AuctionRegistration | null;
}) {
  const { user } = useAuth();
  const [highestBid, setHighestBid] = useState<number | null>(initialHighestBid);
  const [productStatus, setProductStatus] = useState<ProductStatus>(initialProductStatus);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Modal pengumuman pemenang (permintaan tambahan 31 Agustus 2026) — cuma
  // dipicu dari event realtime `auction.closed` status `sold` (bukan
  // `expired`, tidak ada pemenang buat diumumkan), BUKAN dari transisi
  // `hasEnded` lokal (waktu lewat belum tentu berarti sudah ada keputusan
  // pemenang server-side — itu baru pasti begitu `auction.closed` diterima).
  const [winnerModal, setWinnerModal] = useState<{ winnerUserId: string | null; finalAmount: number | null } | null>(
    null,
  );

  const minNextBid = highestBid != null ? highestBid + (minIncrement ?? 1) : startingPrice;

  // Pre-isi nominal tawaran dengan minimum saat ini (bukan cuma placeholder) —
  // buyer bisa langsung tekan "Ajukan Tawaran" tanpa mengetik apa-apa.
  const [bidAmount, setBidAmount] = useState(() => String(minNextBid));
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);

  const [history, setHistory] = useState<AuctionBid[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const hasStarted = !auctionStartAt || nowMs >= new Date(auctionStartAt).getTime();
  const hasEnded = productStatus !== 'published' || (!!auctionEndAt && nowMs >= new Date(auctionEndAt).getTime());

  // Baris riwayat yang cocok dengan tawaran tertinggi saat ini — dicocokkan
  // lewat nominal (bukan urutan array/`highestBidderId` prop yang bisa basi
  // kalau realtime belum sempat update prop itu) karena tiap bid WAJIB lebih
  // tinggi dari sebelumnya (`min_increment`), jadi nominal selalu unik per
  // produk. Satu sumber untuk nama DAN cek "apakah ini saya" (permintaan
  // 2026-09-07), supaya konsisten.
  const highestBidEntry = history?.find((b) => b.amount === highestBid);

  // Tick tiap detik supaya "belum mulai/sudah berakhir" ikut ke-update tanpa reload.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function refreshHistory() {
    try {
      const data = await apiClient<AuctionBid[]>(`/api/markets/${marketId}/products/${productId}/bids`);
      setHistory(data);
    } catch {
      // Riwayat bukan kritikal — biarkan list lama tampil kalau gagal refresh.
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, productId]);

  useEffect(() => {
    if (!showHistory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHistory(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showHistory]);

  const isWinner = winnerModal != null && user != null && winnerModal.winnerUserId === user.userId;

  // Confetti (canvas-confetti, level-page — canvas full-viewport fixed
  // position, tidak terikat posisi komponen ini) — cuma utk user yang
  // benar-benar menang, bukan semua penonton (permintaan tambahan 31
  // Agustus 2026: animasi merayakan kemenangan, bukan efek umum tiap lelang
  // ditutup).
  useEffect(() => {
    if (!isWinner) return;
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    const timer = setTimeout(() => {
      confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, angle: 60, startVelocity: 55 });
    }, 300);
    return () => clearTimeout(timer);
  }, [isWinner]);

  // Fase 4 — "Anda menang" PERSISTEN, dihitung dari `highestBidderId` (prop,
  // sumber server) + `productStatus` LOKAL (state, sudah di-update
  // polling/realtime) — BUKAN dari `winnerModal` (itu murni celebrasi
  // realtime, cuma terisi kalau user sedang di halaman TEPAT saat lelang
  // ditutup). Ini yang membuat buyer yang balik lagi ke halaman produk
  // nanti (tanpa sempat menerima event) tetap lihat CTA pelunasan.
  const isWinnerPersistent =
    !readOnly && productStatus === 'sold' && user != null && highestBidderId === user.userId;

  const [settlement, setSettlement] = useState<AuctionSettlement | null>(null);
  const [settlementChecked, setSettlementChecked] = useState(false);
  const [settlementActionLoading, setSettlementActionLoading] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // requiresRegistration=false — tidak ada baris registrasi untuk diambil
  // alamatnya, jadi "Tebus Sekarang" perlu form alamat sendiri dulu (mirror
  // field yang sama dengan `RegistrationForm`/`checkout-form.tsx`).
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [settlementRecipientName, setSettlementRecipientName] = useState('');
  const [settlementPhone, setSettlementPhone] = useState('');
  const [settlementAddress, setSettlementAddress] = useState('');
  const [settlementDestinationArea, setSettlementDestinationArea] = useState<ShippingAreaSelection | null>(null);

  // Kurir & ongkir WAJIB dipilih saat pelunasan di KEDUA mode
  // requiresRegistration — dulu tidak pernah ditagih sama sekali (celah
  // lama, baru diperbaiki 2026-09-07). Mode requiresRegistration=true tidak
  // perlu form alamat (sudah final sejak registrasi), cuma perlu ini.
  const [settlementCostOptions, setSettlementCostOptions] = useState<ShippingCostOption[] | null>(null);
  const [settlementCostLoading, setSettlementCostLoading] = useState(false);
  const [settlementCostError, setSettlementCostError] = useState<string | null>(null);
  const [settlementCourier, setSettlementCourier] = useState<ShippingCostOption | null>(null);

  // Prefill alamat dari alamat toko buyer sendiri — pola sama `RegistrationForm`.
  const sellerAddress = useSellerAddressPrefill(marketId);
  useEffect(() => {
    if (sellerAddress.address) {
      setSettlementAddress((prev) => prev || sellerAddress.address!);
    }
    if (sellerAddress.shippingArea) {
      setSettlementDestinationArea((prev) => prev ?? sellerAddress.shippingArea);
    }
  }, [sellerAddress]);

  useEffect(() => {
    if (!isWinnerPersistent) return;
    let cancelled = false;
    apiClient<AuctionSettlementMeResponse>(`/api/markets/${marketId}/products/${productId}/settlement/me`)
      .then((data) => {
        if (!cancelled) setSettlement(data.settlement);
      })
      .catch(() => {
        // Non-kritikal — buyer masih bisa klik "Tebus Sekarang" langsung, itu akan gagal jelas kalau memang ada masalah.
      })
      .finally(() => {
        if (!cancelled) setSettlementChecked(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWinnerPersistent, marketId, productId]);

  // Area tujuan buat hitung ongkir — requiresRegistration=true ambil dari
  // registrasi (alamat sudah final sejak itu, tidak bisa diganti di sini),
  // requiresRegistration=false dari form alamat lokal yang masih diisi buyer.
  const settlementDestinationAreaId = requiresRegistration
    ? (registration?.destination_area_id ?? null)
    : settlementDestinationArea?.providerAreaId ?? null;

  // Hitung ongkir real-time begitu area tujuan diketahui — pola sama `checkout-form.tsx`.
  useEffect(() => {
    if (!isWinnerPersistent || settlement?.checkout_url || settlement?.status === 'HELD') return;
    if (!settlementDestinationAreaId) {
      setSettlementCostOptions(null);
      setSettlementCourier(null);
      setSettlementCostError(null);
      return;
    }
    let cancelled = false;
    setSettlementCostLoading(true);
    setSettlementCostError(null);
    setSettlementCourier(null);
    (async () => {
      try {
        const options = await apiClient<ShippingCostOption[]>(
          `/api/markets/${marketId}/products/${productId}/shipping/cost`,
          { method: 'POST', body: JSON.stringify({ destination_area_id: settlementDestinationAreaId }) },
        );
        if (cancelled) return;
        setSettlementCostOptions(Array.isArray(options) ? options : []);
      } catch (err) {
        if (cancelled) return;
        setSettlementCostOptions(null);
        setSettlementCostError(err instanceof ApiError ? err.message : 'Gagal menghitung ongkir untuk tujuan ini.');
      } finally {
        if (!cancelled) setSettlementCostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isWinnerPersistent, settlement, settlementDestinationAreaId, marketId, productId]);

  /**
   * Dipakai baik tombol di modal celebrasi (`winnerModal`) maupun panel
   * persisten di bawah — satu sumber logic. `requiresRegistration=false`
   * (tidak ada baris registrasi untuk diambil alamatnya) — sertakan alamat
   * dari form lokal (`showAddressForm`) di body request. `courier_code`
   * WAJIB di KEDUA mode (server hitung ulang ongkir, JANGAN percaya nominal
   * `cost` dari client — lihat `AuctionSettlementService.createOrGet()`).
   */
  async function handleTebusSekarang() {
    if (!settlementCourier) return;
    setSettlementActionLoading(true);
    setSettlementError(null);
    try {
      const data = await apiClient<AuctionSettlement>(
        `/api/markets/${marketId}/products/${productId}/settlement`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(requiresRegistration
              ? {}
              : {
                  recipient_name: settlementRecipientName,
                  phone: settlementPhone,
                  address: settlementAddress,
                  destination_area_id: settlementDestinationArea?.providerAreaId,
                  destination_area_name: settlementDestinationArea?.name,
                }),
            courier_code: settlementCourier.courierCode,
            courier_service_name: settlementCourier.serviceName,
          }),
        },
      );
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      // Edge case total_amount<=0 — sudah HELD langsung tanpa escrow.
      setSettlement(data);
    } catch (err) {
      setSettlementError(err instanceof ApiError ? err.message : 'Gagal memproses pelunasan.');
    } finally {
      setSettlementActionLoading(false);
    }
  }

  /** Radio-list opsi kurir — pola sama `checkout-form.tsx`, dipakai di kedua mode requiresRegistration. */
  function SettlementCourierPicker() {
    if (!settlementDestinationAreaId) {
      return <p className="text-xs text-zinc-400">Menunggu alamat tujuan untuk hitung ongkir…</p>;
    }
    if (settlementCostLoading) {
      return <p className="text-xs text-zinc-400">Menghitung ongkir…</p>;
    }
    if (settlementCostError) {
      return <p className="text-xs text-[var(--brand-error)]">{settlementCostError}</p>;
    }
    if (!settlementCostOptions || settlementCostOptions.length === 0) {
      return <p className="text-xs text-zinc-400">Tidak ada kurir tersedia untuk tujuan ini.</p>;
    }
    return (
      <div className="space-y-2">
        {settlementCostOptions.map((opt) => {
          const active =
            settlementCourier?.courierCode === opt.courierCode && settlementCourier?.serviceName === opt.serviceName;
          return (
            <label
              key={`${opt.courierCode}-${opt.serviceName}`}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                active ? 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]' : 'border-zinc-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="settlement_courier_option"
                  checked={active}
                  onChange={() => setSettlementCourier(opt)}
                />
                <span>
                  <span className="font-semibold uppercase">{opt.courierCode}</span> {opt.serviceName}
                  {(opt.etdMinDays || opt.etdMaxDays) && (
                    <span className="ml-2 text-xs text-zinc-400">
                      Estimasi {opt.etdMinDays ?? '?'}-{opt.etdMaxDays ?? '?'} hari
                    </span>
                  )}
                </span>
              </span>
              <span className="font-semibold">{currencyFormatter.format(opt.cost)}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // Polling harga tertinggi + status produk (fetch publik, tanpa proxy) — STOP begitu lelang berakhir.
  useEffect(() => {
    if (hasEnded) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const data = await getMarketProductBySlug(marketSlug, productSlug);
      if (cancelled || !data) return;
      setHighestBid(data.current_highest_bid);
      setProductStatus(data.status);
      refreshHistory();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketSlug, productSlug, hasEnded]);

  // Realtime via bagdja-event-service (Fase 3.B) — mekanisme UTAMA update
  // harga tertinggi, polling di atas cuma fallback. Update state LANGSUNG
  // dari payload event (tanpa fetch ulang) supaya terasa instan.
  useAuctionRealtime(
    productId,
    user?.userId ?? null,
    (data) => {
      setHighestBid(data.current_highest_bid);
      refreshHistory();
    },
    (data) => {
      setProductStatus(data.status);
      refreshHistory();
      if (data.status === 'sold') {
        setWinnerModal({ winnerUserId: data.winner_user_id, finalAmount: data.final_amount });
      }
    },
    // auction.started (polish 31 Agustus 2026) — paksa recompute `hasStarted`
    // SEKARANG (bukan nunggu tick 1 detik berikutnya, yang bisa telat kalau
    // tab browser di-throttle background) supaya peserta yang standby
    // langsung lihat form bid aktif begitu waktu mulai lewat.
    () => setNowMs(Date.now()),
  );

  // Tawaran tertinggi bisa naik lewat polling (bukan aksi user ini, mis. bidder
  // lain lebih cepat) — kalau nominal yang lagi diketik kosong atau lebih
  // kecil dari minimum baru, langsung sesuaikan ke minimum baru itu supaya
  // buyer tinggal tekan "Ajukan Tawaran" dan tidak submit tawaran yang pasti
  // ditolak backend.
  useEffect(() => {
    setBidAmount((current) => {
      const currentAmount = Number(current);
      if (current === '' || Number.isNaN(currentAmount) || currentAmount < minNextBid) {
        return String(minNextBid);
      }
      return current;
    });
  }, [minNextBid]);

  async function handleSubmitBid(e: FormEvent) {
    e.preventDefault();
    const amount = Number(bidAmount);
    if (!amount) return;
    setSubmitting(true);
    setBidError(null);
    try {
      const res = await apiClient<PlaceBidResponse>(`/api/markets/${marketId}/products/${productId}/bids`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      setHighestBid(res.product.current_highest_bid);
      setProductStatus(res.product.status);
      setBidAmount('');
      refreshHistory();
    } catch (err) {
      setBidError(err instanceof ApiError ? err.message : 'Gagal mengirim tawaran.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-3">
          <p className="text-sm font-medium text-zinc-700">Mode lihat saja — Anda pemilik produk ini.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">Deposit terverifikasi — Anda bisa ikut menawar.</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <HighestBidSummary
          highestBid={highestBid}
          startingPrice={startingPrice}
          highestBidderUsername={highestBidEntry?.bidder_username}
          isCurrentUserHighestBidder={user != null && highestBidEntry?.bidder_user_id === user.userId}
        />
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          Riwayat Tawaran
        </button>
      </div>

      {!hasStarted && (
        <p className="text-sm text-amber-700">Lelang belum dimulai — dibuka pada {formatDateTime(auctionStartAt)}.</p>
      )}

      {hasEnded ? (
        isWinnerPersistent ? (
          // Panel PERSISTEN (Fase 4) — beda dari modal `winnerModal` yang
          // cuma muncul sekali saat event realtime diterima. Ini yang
          // membuat buyer yang balik lagi ke halaman ini nanti (browser
          // ditutup, reload, dst.) tetap lihat CTA pelunasan.
          <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Selamat, Anda memenangkan lelang ini!</p>
            {highestBid != null && (
              <p className="text-xl font-bold text-[var(--brand-primary)]">{currencyFormatter.format(highestBid)}</p>
            )}
            {!settlementChecked ? (
              <p className="text-sm text-zinc-500">Memeriksa status pelunasan…</p>
            ) : settlement?.status === 'HELD' ? (
              <p className="text-sm font-medium text-green-700">Pelunasan berhasil — terima kasih!</p>
            ) : settlement?.checkout_url ? (
              <a
                href={settlement.checkout_url}
                className="block w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
              >
                Lanjutkan Pembayaran
              </a>
            ) : !requiresRegistration && !showAddressForm ? (
              // Tidak ada baris registrasi (Market requiresRegistration=false)
              // — belum ada alamat kirim tersimpan sama sekali, kumpulkan dulu
              // lewat form ini sebelum submit pelunasan.
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
              >
                Isi Alamat & Tebus Sekarang
              </button>
            ) : !requiresRegistration && showAddressForm ? (
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Penerima</label>
                  <input
                    type="text"
                    required
                    value={settlementRecipientName}
                    onChange={(e) => setSettlementRecipientName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Nomor Telepon</label>
                  <input
                    type="tel"
                    required
                    value={settlementPhone}
                    onChange={(e) => setSettlementPhone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat</label>
                  <textarea
                    required
                    rows={3}
                    value={settlementAddress}
                    onChange={(e) => setSettlementAddress(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Alamat Tujuan</label>
                  <ShippingAreaAutocomplete value={settlementDestinationArea} onChange={setSettlementDestinationArea} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Kurir Pengiriman</label>
                  <SettlementCourierPicker />
                </div>
                <button
                  type="button"
                  onClick={handleTebusSekarang}
                  disabled={
                    settlementActionLoading ||
                    !settlementRecipientName.trim() ||
                    !settlementPhone.trim() ||
                    !settlementAddress.trim() ||
                    !settlementDestinationArea ||
                    !settlementCourier
                  }
                  className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                >
                  {settlementActionLoading ? 'Memproses…' : 'Tebus Sekarang'}
                </button>
              </div>
            ) : (
              // requiresRegistration=true — alamat sudah final sejak
              // registrasi, cuma perlu pilih kurir sebelum submit.
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Kurir Pengiriman</label>
                  <SettlementCourierPicker />
                </div>
                <button
                  type="button"
                  onClick={handleTebusSekarang}
                  disabled={settlementActionLoading || !settlementCourier}
                  className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
                >
                  {settlementActionLoading ? 'Memproses…' : 'Tebus Sekarang'}
                </button>
              </div>
            )}
            {settlementError && <p className="text-sm text-[var(--brand-error)]">{settlementError}</p>}
          </div>
        ) : (
          <p className="text-sm font-medium text-zinc-700">
            {/* Dicek dari `highestBid` (bukan `productStatus`) supaya tetap
                benar meski scheduler penutup lelang belum sempat ubah status
                ke sold/expired (mis. Redis/BullMQ belum jalan) — harga
                pemenang harus langsung tampil begitu waktu lelang berakhir,
                tidak menunggu job async. */}
            {highestBid != null
              ? `Lelang telah berakhir — dimenangkan dengan tawaran ${currencyFormatter.format(highestBid)}.`
              : 'Lelang telah berakhir tanpa penawar.'}
          </p>
        )
      ) : readOnly ? null : (
        <form onSubmit={handleSubmitBid} className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">
            Nominal Tawaran (minimum {currencyFormatter.format(minNextBid)})
          </label>
          <NumberInput
            value={bidAmount}
            onChange={setBidAmount}
            disabled={!hasStarted || submitting}
            placeholder={String(minNextBid)}
          />
          {bidError && <p className="text-sm text-[var(--brand-error)]">{bidError}</p>}
          <button
            type="submit"
            disabled={!hasStarted || submitting || !bidAmount}
            className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {submitting ? 'Mengirim…' : 'Ajukan Tawaran'}
          </button>
        </form>
      )}

      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="max-h-[80vh] w-full overflow-hidden rounded-t-2xl bg-white sm:max-w-sm sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-700">Riwayat Tawaran</p>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                aria-label="Tutup"
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="max-h-[calc(80vh-57px)] overflow-y-auto p-4">
              {historyLoading ? (
                <p className="text-xs text-zinc-400">Memuat…</p>
              ) : history && history.length > 0 ? (
                <ul className="space-y-1 text-sm text-zinc-600">
                  {history.map((bid) => (
                    <li key={bid.id} className="flex items-center justify-between border-b border-zinc-100 py-1.5 last:border-0">
                      <span className="text-zinc-500">
                        {bid.bidder_username ?? 'Peserta'} — {formatDateTime(bid.created_at)}
                      </span>
                      <span className="font-medium text-zinc-900">{currencyFormatter.format(bid.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400">Belum ada tawaran.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {winnerModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-xl">
            <div className="space-y-3 p-6">
              <div className="text-5xl">{isWinner ? '🎉' : '🔨'}</div>
              <h2 className="text-lg font-bold text-zinc-900">
                {isWinner ? 'Selamat, Anda Menang!' : 'Lelang Telah Berakhir'}
              </h2>
              <p className="text-sm text-zinc-600">
                {isWinner
                  ? 'Anda memenangkan lelang ini dengan tawaran tertinggi.'
                  : `Pemenang: ${history?.find((b) => b.bidder_user_id === winnerModal.winnerUserId)?.bidder_username ?? 'Peserta lain'}`}
              </p>
              {winnerModal.finalAmount != null && (
                <p className="text-2xl font-bold text-[var(--brand-primary)]">
                  {currencyFormatter.format(winnerModal.finalAmount)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-200 p-4">
              {isWinner && (
                <button
                  type="button"
                  onClick={() => {
                    // Kurir WAJIB dipilih dulu di KEDUA mode (tidak bisa
                    // langsung submit dari modal ini) — tutup modal saja,
                    // pilih kurir (+ isi alamat kalau requiresRegistration=false)
                    // lewat panel persisten di bawah (satu tempat, tidak dobel
                    // form/picker di modal ini).
                    setWinnerModal(null);
                    if (!requiresRegistration) {
                      setShowAddressForm(true);
                    }
                  }}
                  className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
                >
                  Pilih Kurir &amp; Tebus Sekarang
                </button>
              )}
              <button
                type="button"
                onClick={() => setWinnerModal(null)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
