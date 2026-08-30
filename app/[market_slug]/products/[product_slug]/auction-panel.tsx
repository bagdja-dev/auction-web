'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import { NumberInput } from '@/components/number-input';
import { ShippingAreaAutocomplete, type ShippingAreaSelection } from '@/components/shipping-area-autocomplete';
import { useAuth } from '@/hooks/use-auth';
import { getMarketProductBySlug, type ProductStatus } from '@/lib/api-client';
import { ApiError, apiClient } from '@/lib/proxy-client';
import type {
  AuctionBid,
  AuctionRegistration,
  AuctionRegistrationMeResponse,
  DepositPreview,
  PlaceBidResponse,
  RegisterAuctionPayload,
} from '@/lib/types';

export interface AuctionPanelProps {
  marketId: string;
  marketSlug: string;
  productId: string;
  productSlug: string;
  startingPrice: number;
  minIncrement: number | null;
  initialHighestBid: number | null;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  productStatus: ProductStatus;
  /** Mode lihat-saja untuk pemilik produk (dibuka dari "Toko Saya" lewat `?view=owner`) — lihat sesi lelang tanpa bisa daftar/menawar. */
  readOnly?: boolean;
}

const POLL_INTERVAL_MS = 3000;

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

function isClosedForRegistration(
  productStatus: ProductStatus,
  auctionStartAt: string | null,
  auctionEndAt: string | null,
): boolean {
  if (productStatus !== 'published') return true;
  if (auctionEndAt && Date.now() >= new Date(auctionEndAt).getTime()) return true;
  if (auctionStartAt && Date.now() >= new Date(auctionStartAt).getTime()) return true;
  return false;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">{children}</div>;
}

function HighestBidSummary({
  highestBid,
  startingPrice,
}: {
  highestBid: number | null;
  startingPrice: number;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-500">Tawaran tertinggi saat ini</p>
      <p className="text-xl font-semibold text-[var(--brand-primary)]">
        {highestBid != null
          ? currencyFormatter.format(highestBid)
          : `Belum ada tawaran (harga awal ${currencyFormatter.format(startingPrice)})`}
      </p>
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
  productId,
  productSlug,
  startingPrice,
  minIncrement,
  initialHighestBid,
  auctionStartAt,
  auctionEndAt,
  productStatus,
  readOnly = false,
}: AuctionPanelProps) {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const loginHref = `/auth/login?next=${encodeURIComponent(`/${marketSlug}/products/${productSlug}`)}`;

  const [registration, setRegistration] = useState<AuctionRegistration | null>(null);
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Cek status registrasi SEKALI begitu diketahui user login — tidak nge-fetch
  // sama sekali kalau belum login (cek `useAuth()` dari cookie, tanpa API call)
  // ATAU kalau `readOnly` (pemilik produk, tidak relevan cek registrasi buyer).
  useEffect(() => {
    if (readOnly || authLoading || !isLoggedIn) return;
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

  if (!registration) {
    return (
      <PanelShell>
        <RegistrationForm
          marketId={marketId}
          productId={productId}
          productStatus={productStatus}
          auctionStartAt={auctionStartAt}
          auctionEndAt={auctionEndAt}
          highestBid={initialHighestBid}
          startingPrice={startingPrice}
        />
      </PanelShell>
    );
  }

  if (registration.status === 'PENDING_PAYMENT') {
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
  highestBid,
  startingPrice,
}: {
  marketId: string;
  productId: string;
  productStatus: ProductStatus;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  highestBid: number | null;
  startingPrice: number;
}) {
  const closed = isClosedForRegistration(productStatus, auctionStartAt, auctionEndAt);
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
        setError('Registrasi berhasil tetapi URL pembayaran tidak tersedia. Silakan hubungi dukungan.');
        setSubmitting(false);
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
  readOnly = false,
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
  readOnly?: boolean;
}) {
  const [highestBid, setHighestBid] = useState<number | null>(initialHighestBid);
  const [productStatus, setProductStatus] = useState<ProductStatus>(initialProductStatus);
  const [nowMs, setNowMs] = useState(() => Date.now());

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
        <HighestBidSummary highestBid={highestBid} startingPrice={startingPrice} />
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
    </div>
  );
}
