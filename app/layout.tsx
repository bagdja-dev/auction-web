import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Bagdja Auction Market',
    template: '%s · Bagdja Auction Market',
  },
  description: 'Renderer publik per-Market untuk Bagdja Auction Market.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        {children}
        {/* Global toast (lib/notify.ts) — dipakai realtime bidding Fase 3.B & notifikasi lain ke depan. */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
