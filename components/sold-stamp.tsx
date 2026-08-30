/**
 * Stempel "TERJUAL"/"DIMENANGKAN" yang menutupi tengah gambar kartu produk --
 * gaya "rubber stamp" (cincin lingkaran merah + pita diagonal solid) supaya
 * teksnya SELALU terbaca jelas di atas foto produk apa pun (pita pakai fill
 * merah solid, bukan cuma translusen, jadi tidak nyaru dengan gambar di
 * belakangnya). Berfungsi juga sebagai media promosi: untuk AUCTION,
 * `subtext` (harga pemenang) jadi bukti nyata bahwa lelang di platform ini
 * kompetitif; untuk DIRECT_SELL, cukup "Terjual" tanpa harga. Dipakai sama
 * persis di kedua template (`default` & `grand`) lewat `getCatalogStatusLabel()`.
 */
export function SoldStamp({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="relative flex h-20 w-20 -rotate-12 items-center justify-center sm:h-24 sm:w-24">
        {/* Cincin luar — border tipis, transparan (foto tetap kelihatan di dalamnya). */}
        <div className="absolute inset-0 rounded-full border-[3px] border-red-600" />

        {/* Pita diagonal — fill SOLID supaya teks kontras di atas foto apa pun. */}
        <div className="w-[90%] border-y-2 border-red-800 bg-red-600 px-1 py-1 text-center shadow-md">
          <span className="block text-[9px] font-extrabold uppercase leading-none tracking-wider text-white sm:text-[11px]">
            {text}
          </span>
          {subtext && (
            <span className="mt-0.5 block text-[9px] font-extrabold leading-none text-white sm:text-[11px]">
              {subtext}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
