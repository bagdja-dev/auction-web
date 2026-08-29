/**
 * Helper client-side untuk upload aset (gambar/video/model 3D) lewat route
 * BFF `app/api/uploads/asset/route.ts` (bukan `apiClient`/`app/api/proxy`
 * biasa — itu JSON-only, di sini kirim `FormData`). Pola sama dengan
 * `bagdja-website-admin/app/lib/upload-asset.ts`, tanpa `website_id`
 * (Auction Market tidak punya konsep itu).
 */
export interface UploadAssetResult {
  url: string;
  path: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadAsset(file: File, folder = 'products'): Promise<UploadAssetResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch('/api/uploads/asset', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      message = await res.text().catch(() => message);
    }
    throw new UploadError(message, res.status);
  }

  return res.json() as Promise<UploadAssetResult>;
}
