/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-hosted (bukan Vercel) — output standalone untuk image Docker yang ramping.
  output: 'standalone',
  // Renderer publik: gambar produk seller bisa dari Supabase Storage (legacy)
  // atau bagdja-storage-service/Cloudflare R2 (plan/storage-services/overview.md §9).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
};

module.exports = nextConfig;
