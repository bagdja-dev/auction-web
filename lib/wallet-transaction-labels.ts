/**
 * Label Bahasa Indonesia per `WalletTransactionType` (payment-service) —
 * di-port dari `bagdja-website/lib/wallet-transaction-labels.ts` (pola yang
 * sudah dipakai produk Bagdja lain), ditambah `ESCROW_REFUND`/`TOPUP_REWARD`
 * yang belum ada di sana tapi relevan di sini (refund deposit lelang kalah,
 * `AuctionRegistrationsService.refundLosers()`).
 */
const WALLET_TX_TYPE_LABELS: Record<string, string> = {
  TOPUP_CREDIT: 'Topup Saldo',
  TOPUP_REWARD: 'Bonus Topup',
  SALE_PROCEEDS: 'Hasil Penjualan',
  ESCROW_CREDIT: 'Dana Escrow Masuk',
  ESCROW_RELEASE_CREDIT: 'Dana Pesanan Dicairkan',
  ESCROW_REFUND: 'Refund Dana Escrow',
  TRANSFER_IN: 'Transfer Masuk',
  SUBSCRIPTION_REVENUE: 'Pendapatan Subscription',
  LICENSE_REVENUE: 'Pendapatan Lisensi',
  PAYMENT_DEBIT: 'Pembayaran',
  TRANSACTION_FEE: 'Biaya Transaksi',
  PLATFORM_FEE: 'Biaya Platform',
  ESCROW_HOLD: 'Dana Ditahan (Escrow)',
  ESCROW_RELEASE: 'Pelepasan Dana Escrow',
  ESCROW_FEE: 'Biaya Escrow',
  TRANSFER_OUT: 'Penarikan Dana',
  SUBSCRIPTION_CHARGE: 'Biaya Subscription',
  LICENSE_CHARGE: 'Biaya Lisensi',
  ADMIN_FEE: 'Biaya Admin',
};

export function formatWalletTransactionType(type: string): string {
  return WALLET_TX_TYPE_LABELS[type] ?? type;
}
