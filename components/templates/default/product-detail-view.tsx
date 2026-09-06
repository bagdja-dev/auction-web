'use client';

import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { AuctionCountdown } from '@/components/auction-countdown';
import { MarketAppBar } from '@/components/market-app-bar';
import { ProductMediaGallery } from '@/components/product-media-gallery';
import { useAuth } from '@/hooks/use-auth';
import type { ProductPublic } from '@/lib/api-client';
import { AuctionPanel } from '@/app/[market_slug]/products/[product_slug]/auction-panel';

export interface ProductDetailViewProps {
  marketSlug: string;
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  marketId: string;
  marketName: string;
  product: ProductPublic;
  registrationDeadlineMinutes: number | null;
  /** `false` = Market ini tidak pakai registrasi/deposit — buyer langsung bid. */
  requiresRegistration: boolean;
}

// `product.description` = HTML dari WYSIWYG editor (`components/rich-text-editor.tsx`,
// polish 31 Agustus 2026), sudah disanitasi SEKALI di backend saat simpan
// (`ProductsService.sanitizeDescription`) — sanitasi KEDUA di sini
// (defense-in-depth, bukan duplikasi sia-sia): melindungi data lama yang
// tersimpan sebelum sanitasi backend ada, dan berjaga-jaga kalau ada
// consumer lain yang menulis ke kolom ini tanpa lewat jalur backend yang
// sama. Whitelist tag PERSIS sama dengan backend, supaya konsisten.
const DESCRIPTION_ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'h2', 'h3', 'ul', 'ol', 'li', 'a'];

function sanitizeDescriptionHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: DESCRIPTION_ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

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
 * Template renderer default untuk halaman detail produk publik — pasangan
 * `CatalogView`, lihat catatan di sana soal resolusi template per Market.
 * Galeri media (carousel/zoom/lightbox/video/3D) diekstrak ke
 * `components/product-media-gallery.tsx` — dipakai juga di halaman status
 * Order/Settlement buyer & detail listing seller (Dashboard "Toko Saya").
 */
export default function ProductDetailView({
  marketSlug,
  linkBase,
  marketId,
  marketName,
  product,
  registrationDeadlineMinutes,
  requiresRegistration,
}: ProductDetailViewProps) {
  const { user, isLoggedIn } = useAuth();
  const displayName = user?.username ?? user?.email ?? undefined;
  const searchParams = useSearchParams();
  const isOwnerView = searchParams.get('view') === 'owner';
  /**
   * Link dari Dashboard "Toko Saya" (baik seller lihat listing sendiri via
   * `?view=owner`, atau buyer via `?from=dashboard` di `pembelian-saya-content.tsx`)
   * — sebelumnya begitu masuk sini TIDAK ADA jalan balik ke Dashboard selain
   * tombol back browser, karena `MarketAppBar` di halaman ini SELALU cuma
   * kasih link "Kembali ke {marketName}" (ke katalog publik).
   */
  const cameFromDashboard = isOwnerView || searchParams.get('from') === 'dashboard';
  const isAuction = product.mode_jual === 'AUCTION';

  const actionPanelRef = useRef<HTMLDivElement>(null);
  const [mobileActionPanelSpace, setMobileActionPanelSpace] = useState<number | null>(null);

  // Panel aksi (AuctionPanel/tombol beli) "fixed" di bawah layar HANYA pada
  // mobile (md:sticky di desktop, lihat class-nya di bawah) — tingginya
  // dinamis (form registrasi vs form bid vs tombol saja), jadi padding-bottom
  // <main> harus ikut dinamis juga, bukan angka tetap, supaya konten di
  // atasnya (harga, jadwal lelang, dst.) tidak ketutup panel.
  useEffect(() => {
    const el = actionPanelRef.current;
    if (!el) return;

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
    const update = () => setMobileActionPanelSpace(isMobile() ? el.getBoundingClientRect().height : null);

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <main
      className="mx-auto max-w-5xl px-4 py-8 pb-40 sm:px-6 md:pb-8"
      style={mobileActionPanelSpace != null ? { paddingBottom: Math.max(160, mobileActionPanelSpace + 24) } : undefined}
    >
      <MarketAppBar
        linkBase={linkBase}
        isLoggedIn={isLoggedIn}
        displayName={displayName}
        left={
          cameFromDashboard ? (
            <Link
              href={`${linkBase}/toko-saya`}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-[var(--brand-primary)]"
            >
              ← Kembali ke Dashboard
            </Link>
          ) : (
            <Link
              href={linkBase || '/'}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-[var(--brand-primary)]"
            >
              ← Kembali ke {marketName}
            </Link>
          )
        }
      />

      <div className="grid items-start gap-8 md:grid-cols-2">
        {/* Kolom media (kiri di desktop): carousel + deskripsi mengalir sebagai
            satu kolom independen (md:flex md:flex-col) supaya tingginya TIDAK
            terikat ke tinggi kolom kanan (yang biasanya jauh lebih tinggi
            karena berisi form) — itu penyebab celah kosong yang dilaporkan
            sebelumnya kalau dipaksa jadi grid row/kolom bersama. Di mobile,
            "contents" membuat div ini transparan, carousel & deskripsi jadi
            grid-item lepas yang diatur lewat `order` masing-masing. */}
        <div className="contents md:flex md:flex-col md:gap-3">
          <div className="order-1 space-y-3">
            <ProductMediaGallery
              images={product.images}
              videoUrl={product.video_url}
              model3dUrl={product.model3d_url}
              alt={product.name}
            />
          </div>

          <div className="order-3 space-y-3">
            {product.description && (
              <div
                className="text-sm leading-relaxed text-zinc-700 [&_a]:text-[var(--brand-primary)] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(product.description) }}
              />
            )}
          </div>
        </div>

        {/* Kolom info+aksi (kanan di desktop): sama alasannya, mengalir
            independen dari kolom media supaya tinggi masing-masing kolom
            tidak saling memaksa — panel aksi tetap `md:sticky` mengikuti
            scroll dalam kolom ini. */}
        <div className="contents md:flex md:flex-col md:gap-4">
          <div className="order-2 flex flex-col gap-4">
            <span
              className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-medium text-white ${
                isAuction ? 'bg-[var(--palette-orange-burn)]' : 'bg-[var(--brand-success)]'
              }`}
            >
              {isAuction ? 'Lelang' : 'Beli Langsung'}
            </span>

            <h1 className="text-2xl font-semibold text-zinc-900">{product.name}</h1>

            {product.seller_shop_name && (
              <p className="text-sm text-zinc-500">Dijual oleh {product.seller_shop_name}</p>
            )}

            <p className="text-2xl font-semibold text-[var(--brand-primary)]">
              {currencyFormatter.format(product.price)}
              {isAuction && <span className="ml-1 text-sm font-normal text-zinc-500">(estimasi)</span>}
            </p>

            {isAuction && (
              <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <p>Buka lelang: {formatDateTime(product.auction_start_at)}</p>
                <p>Tutup lelang: {formatDateTime(product.auction_end_at)}</p>
                {product.min_increment != null && (
                  <p>Kelipatan tawar minimum: {currencyFormatter.format(product.min_increment)}</p>
                )}
                <div className="pt-1">
                  <AuctionCountdown
                    status={product.status}
                    auctionStartAt={product.auction_start_at}
                    auctionEndAt={product.auction_end_at}
                    registrationDeadlineMinutes={registrationDeadlineMinutes}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            ref={actionPanelRef}
            className={`order-4 fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] ${
              isAuction ? '' : 'flex items-center gap-3'
            } md:sticky md:top-6 md:z-auto md:max-h-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          >
            {isAuction ? (
              <AuctionPanel
                marketId={marketId}
                marketSlug={marketSlug}
                linkBase={linkBase}
                requiresRegistration={requiresRegistration}
                productId={product.id}
                productSlug={product.slug}
                startingPrice={product.price}
                minIncrement={product.min_increment}
                initialHighestBid={product.current_highest_bid}
                auctionStartAt={product.auction_start_at}
                auctionEndAt={product.auction_end_at}
                productStatus={product.status}
                registrationDeadlineMinutes={registrationDeadlineMinutes}
                highestBidderId={product.highest_bidder_id}
                readOnly={isOwnerView}
              />
            ) : isOwnerView ? (
              <span className="block w-full rounded-lg bg-zinc-100 px-4 py-3 text-center text-sm font-medium text-zinc-500 md:mt-2">
                Mode lihat saja — Anda pemilik produk ini
              </span>
            ) : product.status === 'published' ? (
              <Link
                href={`${linkBase}/products/${product.slug}/checkout`}
                className="block w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] md:mt-2"
              >
                Beli Sekarang
              </Link>
            ) : (
              <span className="block w-full rounded-lg bg-zinc-200 px-4 py-3 text-center text-sm font-medium text-zinc-500 md:mt-2">
                Sudah Terjual
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
