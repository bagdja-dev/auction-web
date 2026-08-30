/**
 * Stempel lingkaran "TERJUAL" yang menutupi tengah gambar kartu produk --
 * sengaja mencolok (merah, border ganda, dimiringkan) karena berfungsi juga
 * sebagai media promosi ("banyak barang berhasil terjual di platform ini"),
 * bukan cuma info status netral seperti badge lain. Dipakai sama persis di
 * kedua template (`default` & `grand`) lewat `getCatalogStatusLabel()`.
 */
export function SoldStamp({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/10">
      <div className="flex h-16 w-16 -rotate-12 items-center justify-center rounded-full border-[3px] border-double border-red-600 bg-white/90 shadow-lg sm:h-20 sm:w-20">
        <span className="text-center text-[11px] font-extrabold uppercase leading-tight tracking-widest text-red-600 sm:text-sm">
          {text}
        </span>
      </div>
    </div>
  );
}
