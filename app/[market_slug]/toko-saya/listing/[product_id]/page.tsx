import ListingDetailContent from './listing-detail-content';

export const metadata = { title: 'Detail Produk · Toko Saya' };

interface ListingDetailPageProps {
  params: { product_id: string };
}

export default function ListingDetailPage({ params }: ListingDetailPageProps) {
  return <ListingDetailContent productId={params.product_id} />;
}
