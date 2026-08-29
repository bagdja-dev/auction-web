'use client';

import { useRef, useState } from 'react';

import { uploadAsset } from '@/lib/upload-asset';

interface VideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  uploadFolder?: string;
  disabled?: boolean;
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function VideoUpload({ value, onChange, uploadFolder = 'products', disabled = false }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || value || null;

  const handleFile = async (file: File | null) => {
    if (!file || disabled) return;
    setError('');

    // Validasi ukuran DULU sebelum upload — biar user tidak menunggu upload
    // besar yang bakal ditolak backend.
    if (file.size > MAX_VIDEO_BYTES) {
      setError('Ukuran video maksimal 100 MB');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    setUploading(true);
    try {
      const result = await uploadAsset(file, uploadFolder);
      onChange(result.url);
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    } catch (err) {
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      setError(err instanceof Error ? err.message : 'Gagal mengunggah video');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
          {displayUrl ? (
            <video src={displayUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <svg className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Mengunggah…' : value ? 'Ganti Video' : 'Pilih File'}
            </button>
            {(value || preview) && !uploading && (
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemove}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--brand-error)] transition hover:bg-red-50 disabled:opacity-50"
              >
                Hapus
              </button>
            )}
          </div>

          <p className="text-xs text-zinc-400">MP4, WebM, MOV — maks. 100 MB</p>
          {error && <p className="text-xs text-[var(--brand-error)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
