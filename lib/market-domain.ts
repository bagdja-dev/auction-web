const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5010';

export interface ResolvedMarketDomain {
  slug: string;
}

/**
 * Memastikan hostname custom masih terdaftar pada Market aktif dan sudah
 * lolos verifikasi DNS. Endpoint API sengaja menjadi sumber kebenaran yang
 * sama dengan middleware dan generator router Traefik.
 */
export async function resolveVerifiedMarketDomain(
  hostname: string,
): Promise<ResolvedMarketDomain | null> {
  try {
    const response = await fetch(
      `${API_URL}/api/public/resolve-domain?host=${encodeURIComponent(hostname.toLowerCase())}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as Partial<ResolvedMarketDomain>;
    return typeof data.slug === 'string' && data.slug ? { slug: data.slug } : null;
  } catch (error) {
    console.error(
      `[market-domain] gagal memvalidasi host=${hostname}:`,
      error,
    );
    return null;
  }
}
