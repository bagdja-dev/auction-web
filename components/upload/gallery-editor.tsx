'use client';

import { useRef, useState } from 'react';

import { uploadAsset } from '@/lib/upload-asset';

interface GalleryEditorProps {
  value: string[];
  onChange: (urls: string[]) => void;
  uploadFolder?: string;
  disabled?: boolean;
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
      onChange([...value, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= value.length) return;
    const next = [...value];
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
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

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Gambar ${index + 1}`} className="h-full w-full object-cover" />

              {index === 0 && (
                <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}

              <div className="absolute inset-0 flex items-start justify-end gap-1 bg-black/0 p-1 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
                {index > 0 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => moveImage(index, 'up')}
                    aria-label="Naik"
                    className="rounded bg-white/90 p-1 text-xs text-zinc-700 shadow hover:bg-white"
                  >
                    ↑
                  </button>
                )}
                {index < value.length - 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => moveImage(index, 'down')}
                    aria-label="Turun"
                    className="rounded bg-white/90 p-1 text-xs text-zinc-700 shadow hover:bg-white"
                  >
                    ↓
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeImage(index)}
                  aria-label="Hapus gambar"
                  className="rounded bg-white/90 p-1 text-xs text-[var(--brand-error)] shadow hover:bg-white"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
