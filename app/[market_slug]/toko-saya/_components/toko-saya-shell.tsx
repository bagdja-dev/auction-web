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
  /** Base path untuk link internal — `''` di subdomain/custom domain, `/{slug}` di path-based (local dev). Lihat `lib/tenant-link-base.ts`. */
  linkBase: string;
  marketName: string;
  children: React.ReactNode;
}

/**
 * Shell responsive untuk seluruh halaman "Toko Saya":
 * - Topbar sticky (kembali ke katalog + avatar) di semua ukuran layar.
 * - Dashboard/sidebar/navigasi SELALU bisa diakses meski user belum daftar
 *   toko (polish 31 Agustus 2026 — SEBELUMNYA ada gate full-page yang
 *   blokir `children` total sampai user daftar; sekarang `seller` (nullable)
 *   diteruskan apa adanya lewat context, tombol "Buat Toko" ada di dalam
 *   `DashboardContent`, bukan menghalangi akses ke shell-nya).
 * - ≥md: sidebar navigasi tetap di kiri (collapsible, tersimpan di
 *   localStorage) + children di kanan.
 * - <md: tanpa sidebar — navigasi antar halaman lewat grid ikon menu di
 *   Dashboard (lihat page.tsx), children dirender penuh di bawah topbar.
 */
export function TokoSayaShell({ marketId, linkBase, marketName, children }: TokoSayaShellProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  /** Dipakai `DashboardContent` (tombol "Buat Toko") — bukan lagi form inline di shell ini. */
  const registerSeller = useCallback(async (shopName?: string) => {
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
  }, [marketId]);

  const displayName = user?.username ?? user?.email ?? 'Seller';
  const initials = displayName.charAt(0).toUpperCase();

  const topbar = (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <Link href={linkBase || '/'} className="flex items-center gap-2 text-sm text-zinc-600 hover:text-[var(--brand-primary)]">
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

  return (
    <TokoSayaProvider
      value={{ marketId, linkBase, marketName, seller, refreshSeller: loadSellerStatus, registerSeller, registering, registerError }}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
        {topbar}
        <div className="flex flex-1 overflow-hidden">
          <TokoSayaSidebar linkBase={linkBase} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:py-8">
            {loadError && (
              <p className="mb-4 rounded-lg border border-[var(--brand-error)] bg-red-50 px-3 py-2 text-sm text-[var(--brand-error)]">
                {loadError}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </TokoSayaProvider>
  );
}
