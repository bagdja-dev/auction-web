'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import type { Seller, SellersMeResponse } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { TokoSayaSidebar } from './sidebar';
import { TokoSayaProvider } from './toko-saya-context';

const COLLAPSE_STORAGE_KEY = 'am_toko_saya_sidebar_collapsed';

interface TokoSayaShellProps {
  marketId: string;
  marketSlug: string;
  marketName: string;
  children: React.ReactNode;
}

/**
 * Shell responsive untuk seluruh halaman "Toko Saya":
 * - Topbar sticky (kembali ke katalog + avatar) di semua ukuran layar.
 * - Gate registrasi seller — kalau user belum terdaftar, SEMUA route
 *   `/toko-saya/*` menampilkan form daftar ini saja (children diabaikan).
 * - ≥md: sidebar navigasi tetap di kiri (collapsible, tersimpan di
 *   localStorage) + children di kanan.
 * - <md: tanpa sidebar — navigasi antar halaman lewat grid ikon menu di
 *   Dashboard (lihat page.tsx), children dirender penuh di bawah topbar.
 */
export function TokoSayaShell({ marketId, marketSlug, marketName, children }: TokoSayaShellProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shopName, setShopName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadSellerStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient<SellersMeResponse>(`/api/markets/${marketId}/sellers/me`);
      setSeller(res.seller);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat status seller.');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    void loadSellerStatus();
  }, [loadSellerStatus]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
    } catch {
      // localStorage bisa dibatasi (private mode dll) — biarkan default expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setRegisterError(null);
    try {
      const created = await apiClient<Seller>(`/api/markets/${marketId}/sellers/register`, {
        method: 'POST',
        body: JSON.stringify(shopName ? { shop_name: shopName } : {}),
      });
      setSeller(created);
    } catch (err) {
      setRegisterError(err instanceof ApiError ? err.message : 'Gagal mendaftar sebagai seller.');
    } finally {
      setRegistering(false);
    }
  }

  const displayName = user?.username ?? user?.email ?? 'Seller';
  const initials = displayName.charAt(0).toUpperCase();

  const topbar = (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <Link href={`/${marketSlug}`} className="flex items-center gap-2 text-sm text-zinc-600 hover:text-[var(--brand-primary)]">
        <span aria-hidden>←</span>
        Kembali ke Market
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white"
          aria-label="Menu akun"
        >
          {initials}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              <p className="truncate border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">{displayName}</p>
              <a href="/auth/logout" className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                Keluar
              </a>
            </div>
          </>
        )}
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        {topbar}
        <p className="p-6 text-sm text-zinc-500">Memuat…</p>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-zinc-50">
        {topbar}
        <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-lg font-semibold text-[var(--brand-primary)]">Daftar sebagai Seller</h1>
            <p className="mb-4 text-sm text-zinc-500">
              Kamu belum terdaftar sebagai seller di <strong>{marketName}</strong>. Daftar dulu untuk
              mulai menjual produk.
            </p>
            {loadError && <p className="mb-3 text-sm text-[var(--brand-error)]">{loadError}</p>}
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Nama Toko (opsional)</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Toko Saya"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              {registerError && <p className="text-sm text-[var(--brand-error)]">{registerError}</p>}
              <button
                type="submit"
                disabled={registering}
                className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
              >
                {registering ? 'Mendaftar…' : 'Daftar sebagai Seller'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <TokoSayaProvider
      value={{ marketId, marketSlug, marketName, seller, refreshSeller: loadSellerStatus }}
    >
      <div className="min-h-screen bg-zinc-50">
        {topbar}
        <div className="flex">
          <TokoSayaSidebar marketSlug={marketSlug} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </TokoSayaProvider>
  );
}
