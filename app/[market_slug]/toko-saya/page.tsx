import DashboardContent from './_components/dashboard-content';

export const metadata = { title: 'Toko Saya' };

/** PROTECTED oleh middleware.ts — shell (topbar/sidebar/gate registrasi) ada di layout.tsx. */
export default function TokoSayaDashboardPage() {
  return <DashboardContent />;
}
