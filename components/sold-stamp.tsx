/**
 * Stempel lingkaran "TERJUAL"/"DIMENANGKAN" yang menutupi tengah gambar
 * kartu produk -- sengaja mencolok (merah, border ganda, dimiringkan)
 * karena berfungsi juga sebagai media promosi: untuk AUCTION, `subtext`
 * (harga pemenang) jadi bukti nyata bahwa lelang di platform ini kompetitif;
 * untuk DIRECT_SELL, cukup "Terjual" tanpa harga. Dipakai sama persis di
 * kedua template (`default` & `grand`) lewat `getCatalogStatusLabel()`.
 */
export function SoldStamp({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/10">
      <div className="flex h-16 w-16 -rotate-12 flex-col items-center justify-center gap-0.5 rounded-full border-[3px] border-double border-red-600 bg-white/90 text-center shadow-lg sm:h-20 sm:w-20">
        <span className="text-[9px] font-extrabold uppercase leading-none tracking-widest text-red-600 sm:text-[11px]">
          {text}
        </span>
        {subtext && (
          <span className="text-[10px] font-extrabold leading-none text-red-600 sm:text-xs">{subtext}</span>
        )}
      </div>
    </div>
  );
}
