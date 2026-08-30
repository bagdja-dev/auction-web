'use client';

import { useRef, useState } from 'react';

import { uploadAsset } from '@/lib/upload-asset';

interface GalleryEditorProps {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadFolder?: string;
  disabled?: boolean;
}

function ArrowIcon({ direction = 'left' }: { direction?: 'left' | 'right' | 'up' | 'down' }) {
  const rotate =
    direction === 'left' ? 180 : direction === 'right' ? 0 : direction === 'up' ? 90 : 270;

  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * Editor galeri gambar produk — versi sederhana (array URL string polos),
 * SESUAI kontrak `images: string[]` backend Auction Market. Ini BUKAN
 * `GalleryImage[]` (object {url,alt,caption}) seperti di Website Builder —
 * skema itu tidak dipakai di sini, jangan diperluas jadi object tanpa
 * perubahan kontrak backend eksplisit.
 */
export function GalleryEditor({
  value,
  onChange,
  uploadFolder = 'products',
  disabled = false,
}: GalleryEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentImage = value[selectedIndex] ?? value[0] ?? null;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setError('');
    setUploading(true);

    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadAsset(file, uploadFolder);
        added.push(result.url);
      }
      const next = [...value, ...added];
      onChange(next);
      setSelectedIndex(Math.max(0, next.length - added.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= value.length) return;
    const next = [...value];
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
    setSelectedIndex(swap);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 py-4 text-sm font-medium text-zinc-500 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {uploading ? 'Mengunggah…' : 'Tambah Gambar'}
      </button>

      <p className="text-xs text-zinc-400">JPEG/PNG/WebP/GIF — maks. 5 MB per gambar.</p>
      {error && <p className="text-xs text-[var(--brand-error)]">{error}</p>}

      {value.length > 0 && currentImage ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentImage} alt={`Preview gambar ${selectedIndex + 1}`} className="h-full w-full object-cover" />
              {selectedIndex === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
              {value.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedIndex((prev) => (prev === 0 ? value.length - 1 : prev - 1))}
                    aria-label="Gambar sebelumnya"
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55"
                  >
                    <ArrowIcon direction="left" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIndex((prev) => (prev + 1) % value.length)}
                    aria-label="Gambar berikutnya"
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55"
                  >
                    <ArrowIcon direction="right" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-white p-2">
              <span className="text-xs font-medium text-zinc-500">
                {selectedIndex + 1} / {value.length}
              </span>
              <div className="flex items-center gap-1">
                {selectedIndex > 0 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => moveImage(selectedIndex, 'up')}
                    aria-label="Pindahkan ke atas"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    <ArrowIcon direction="up" />
                  </button>
                )}
                {selectedIndex < value.length - 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => moveImage(selectedIndex, 'down')}
                    aria-label="Pindahkan ke bawah"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    <ArrowIcon direction="down" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeImage(selectedIndex)}
                  aria-label="Hapus gambar yang dipilih"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {value.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="group relative overflow-hidden rounded-lg border transition"
                style={{
                  borderColor: index === selectedIndex ? 'var(--brand-primary)' : '#e4e4e7',
                  boxShadow: index === selectedIndex ? '0 0 0 2px rgba(15,118,110,0.12)' : 'none',
                }}
              >
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Thumbnails ${index + 1}`} className="h-full w-full object-cover" />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      Cover
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
          Belum ada gambar produk.
        </div>
      )}
    </div>
  );
}
