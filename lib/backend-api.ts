/**
 * Server-side helper to call Auction API (NestJS, `bagdja-auction-api`) with
 * session token from httpOnly cookie. Dipakai HANYA oleh Route Handler BFF
 * proxy (`app/api/proxy/[...path]/route.ts`) — token JWT tidak pernah
 * dikirim ke browser. Pola PERSIS dari
 * `bagdja-auction-admin/src/lib/backend-api.ts`.
 */
import { getSession } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5010';

export async function backendFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; status: number; error?: string }> {
  const { token } = await getSession();

  if (!token) {
    console.error(`[backendFetch] ${path} -> no am_buyer_token cookie on request`);
    return { data: null, status: 401, error: 'Not authenticated' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  try {
    // `cache: 'no-store'` wajib — tanpa ini, Next.js App Router men-cache GET
    // fetch ke API (Data Cache) meski route handler pemanggilnya dynamic.
    // Data di sini per-market dan sering berubah, jadi tidak boleh di-cache.
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[backendFetch] ${options.method ?? 'GET'} ${path} -> ${res.status}: ${body || res.statusText}`);
      // Body error dari NestJS berbentuk JSON `{ statusCode, message, error }`
      // — ambil `message`-nya saja (bisa array kalau dari class-validator)
      // supaya yang tampil di UI kalimat manusia, bukan JSON mentah.
      let message = body || res.statusText;
      try {
        const parsed = JSON.parse(body) as { message?: string | string[] };
        if (parsed.message) {
          message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
        }
      } catch {
        // Bukan JSON (mis. error dari proxy/HTML) — pakai teks aslinya.
      }
      return { data: null, status: res.status, error: message };
    }

    if (res.status === 204) {
      return { data: null, status: res.status };
    }

    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return {
      data: null,
      status: 500,
      error: err instanceof Error ? err.message : 'Request failed',
    };
  }
}
