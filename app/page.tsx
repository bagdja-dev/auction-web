/**
 * Landing platform host (`market.bagdja.com` apex / localhost tanpa slug).
 * Renderer ini murni multi-tenant per-Market (lihat middleware.ts) — halaman
 * ini cuma placeholder informatif, bukan marketing page produk.
 */
export default function IndexPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="inline-block rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-700">
        Fase 1 · Katalog Publik
      </span>
      <h1 className="text-4xl font-semibold tracking-tight text-[var(--brand-primary)] sm:text-5xl">
        Bagdja Auction Market
      </h1>
      <p className="mx-auto max-w-lg text-zinc-600">
        Renderer publik per-Market. Kunjungi Market lewat subdomainnya
        (mis. <code className="font-mono">{'{market-slug}'}.market.bagdja.com</code>)
        untuk melihat katalog dan mendaftar sebagai seller.
      </p>
    </main>
  );
}
