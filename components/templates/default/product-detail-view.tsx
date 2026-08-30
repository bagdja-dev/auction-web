'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';

import { ModelViewerElement } from '@/components/upload/model-viewer-element';
import type { ProductPublic } from '@/lib/api-client';
import { AuctionPanel } from '@/app/[market_slug]/products/[product_slug]/auction-panel';

export interface ProductDetailViewProps {
  marketSlug: string;
  marketId: string;
  product: ProductPublic;
}

const SWIPE_THRESHOLD_PX = 40;
const ZOOM_SCALE = 2.2;

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

function ArrowIcon({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" strokeLinecap="round" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" strokeLinecap="round" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" strokeLinecap="round" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
    </svg>
  );
}

interface Slide {
  type: 'image' | 'video' | 'model';
  url: string;
}

/**
 * Template renderer default untuk halaman detail produk publik — pasangan
 * `CatalogView`, lihat catatan di sana soal resolusi template per Market.
 */
export default function ProductDetailView({ marketSlug, marketId, product }: ProductDetailViewProps) {
  const isAuction = product.mode_jual === 'AUCTION';
  const imageUrls = product.images && product.images.length > 0 ? product.images : [];
  const slides: Slide[] = [
    ...imageUrls.map((url) => ({ type: 'image' as const, url })),
    ...(product.video_url ? [{ type: 'video' as const, url: product.video_url }] : []),
    ...(product.model3d_url ? [{ type: 'model' as const, url: product.model3d_url }] : []),
  ];

  const [index, setIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = slides.length;
  const current = slides[index] ?? null;
  const goTo = (next: number) => {
    if (!count) return;
    setIndex(((next % count) + count) % count);
  };
  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isLightboxOpen, index]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/${marketSlug}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-[var(--brand-primary)]"
      >
        ← Kembali ke katalog
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          {slides.length > 0 ? (
            <div className={`grid gap-3 ${count > 1 ? 'sm:grid-cols-[80px_1fr]' : ''}`}>
              {count > 1 && (
                <div className="order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:flex-col sm:overflow-visible">
                  {slides.map((slide, i) => (
                    <button
                      key={`${slide.type}-${slide.url}-${i}`}
                      type="button"
                      onClick={() => goTo(i)}
                      className="relative shrink-0 overflow-hidden rounded-lg border-2 transition-opacity"
                      style={{
                        borderColor: i === index ? 'var(--brand-primary)' : '#e4e4e7',
                        opacity: i === index ? 1 : 0.7,
                      }}
                    >
                      {slide.type === 'video' ? (
                        <>
                          <video src={slide.url} className="h-16 w-16 object-cover sm:h-20 sm:w-20" muted loop autoPlay playsInline />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5.5v13l10-6.5L8 5.5Z" />
                            </svg>
                          </span>
                        </>
                      ) : slide.type === 'model' ? (
                        <>
                          <ModelViewerElement
                            src={slide.url}
                            className="pointer-events-none h-16 w-16 sm:h-20 sm:w-20"
                            cameraControls={false}
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
                              <path d="M12 3v18" />
                              <path d="M4 7.5l8 4.5 8-4.5" />
                            </svg>
                          </span>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slide.url} alt="" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`relative order-1 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:order-2 ${current?.type === 'image' ? 'cursor-zoom-in' : ''}`}
                onTouchStart={current?.type === 'model' ? undefined : handleTouchStart}
                onTouchEnd={current?.type === 'model' ? undefined : handleTouchEnd}
                onMouseEnter={() => current?.type === 'image' && setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={current?.type === 'image' ? handleMouseMove : undefined}
                onClick={() => current?.type === 'image' && setIsLightboxOpen(true)}
              >
                {current?.type === 'video' && (
                  <video
                    key={current.url}
                    src={current.url}
                    className="aspect-square w-full object-cover"
                    controls
                    autoPlay
                    loop
                    playsInline
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {current?.type === 'model' && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ModelViewerElement
                      key={current.url}
                      src={current.url}
                      className="aspect-square w-full"
                      cameraControls
                      autoRotate
                    />
                  </div>
                )}
                {current?.type === 'image' && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.url} alt={product.name} className="aspect-square w-full object-cover" />
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${isZooming ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        backgroundImage: `url(${current.url})`,
                        backgroundSize: `${ZOOM_SCALE * 100}%`,
                        backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                      }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLightboxOpen(true);
                  }}
                  aria-label={current?.type === 'image' ? 'Perbesar gambar' : 'Fullscreen'}
                  className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:scale-105"
                >
                  {current?.type === 'image' ? <SearchIcon /> : <FullscreenIcon />}
                </button>

                {count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                      }}
                      aria-label="Slide sebelumnya"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:scale-105"
                    >
                      <ArrowIcon direction="left" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                      }}
                      aria-label="Slide berikutnya"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:scale-105"
                    >
                      <ArrowIcon direction="right" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-100 text-sm text-zinc-400">
              Tidak ada gambar
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
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
            </div>
          )}

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{product.description}</p>
          )}

          {isAuction ? (
            <AuctionPanel
              marketId={marketId}
              marketSlug={marketSlug}
              productId={product.id}
              productSlug={product.slug}
              startingPrice={product.price}
              minIncrement={product.min_increment}
              initialHighestBid={product.current_highest_bid}
              auctionStartAt={product.auction_start_at}
              auctionEndAt={product.auction_end_at}
              productStatus={product.status}
            />
          ) : product.status === 'published' ? (
            <Link
              href={`/${marketSlug}/products/${product.slug}/checkout`}
              className="mt-2 block w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
            >
              Beli Sekarang
            </Link>
          ) : (
            <span className="mt-2 block w-full rounded-lg bg-zinc-200 px-4 py-3 text-center text-sm font-medium text-zinc-500">
              Sudah Terjual
            </span>
          )}
        </div>
      </div>

      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setIsLightboxOpen(false)}>
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Tutup preview"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="relative flex h-full max-h-full w-full max-w-4xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={current?.type === 'model' ? undefined : handleTouchStart}
            onTouchEnd={current?.type === 'model' ? undefined : handleTouchEnd}
          >
            {current?.type === 'video' && (
              <video
                key={current.url}
                src={current.url}
                className="max-h-[85vh] max-w-full rounded-lg object-contain"
                controls
                autoPlay
                loop
                playsInline
              />
            )}
            {current?.type === 'model' && (
              <div onClick={(e) => e.stopPropagation()}>
                <ModelViewerElement
                  key={current.url}
                  src={current.url}
                  className="h-[70vh] w-full max-w-full rounded-lg"
                  cameraControls
                  autoRotate
                  ar
                />
              </div>
            )}
            {current?.type === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={product.name} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
            )}

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Slide sebelumnya"
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:-left-14"
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Slide berikutnya"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:-right-14"
                >
                  <ArrowIcon direction="right" />
                </button>
                <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/70">
                  {index + 1} / {count}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
