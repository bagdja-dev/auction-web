import { NextResponse } from 'next/server';

/**
 * Proxy PUBLIK (sengaja TIDAK lewat `app/api/proxy/[...path]` — route itu
 * mewajibkan session buyer via `backendFetch()`/`getSession()`, sedangkan
 * halaman lelang boleh ditonton siapa saja tanpa login, cuma perlu login
 * untuk submit bid). Meneruskan ke `GET /api/public/realtime/ws-token`
 * (`bagdja-auction-api`, tanpa guard) — `x-api-key` client-credential HANYA
 * hidup di sisi server sana, tidak pernah lewat sini ke browser (Fase 3.B,
 * `execution-plan.md`).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5010';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/public/realtime/ws-token`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[ws-token proxy] ${res.status}: ${body || res.statusText}`);
      return NextResponse.json({ error: 'Realtime service unavailable' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[ws-token proxy] fetch failed:', err);
    return NextResponse.json({ error: 'Realtime service unavailable' }, { status: 502 });
  }
}
