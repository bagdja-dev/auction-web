'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  marketSlug: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Sidebar navigasi Toko Saya — HANYA tampil di layar ≥md (`hidden md:flex`).
 * Di mobile, navigasi antar halaman lewat grid ikon menu di Dashboard
 * (lihat `page.tsx`), bukan sidebar ini.
 */
export function TokoSayaSidebar({ marketSlug, collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const base = `/${marketSlug}/toko-saya`;
  const items = [
    { href: base, label: 'Dashboard' },
    { href: `${base}/lelang`, label: 'Lelang' },
    { href: `${base}/beli-langsung`, label: 'Beli Langsung' },
    { href: `${base}/pengaturan`, label: 'Pengaturan Toko' },
  ];

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] md:flex ${
        collapsed ? 'md:w-16' : 'md:w-56'
      }`}
    >
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = item.href === base ? pathname === base : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`block truncate rounded-lg px-3 py-2 text-sm font-medium transition ${
                collapsed ? 'text-center' : ''
              } ${
                active
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {collapsed ? item.label.charAt(0) : item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 transition hover:bg-zinc-100"
        >
          {collapsed ? '→' : '← Ciutkan'}
        </button>
      </div>
    </aside>
  );
}
