'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient } from '@/lib/proxy-client';
import { UploadError, uploadAsset } from '@/lib/upload-asset';
import type {
  FulfillmentProgress as FulfillmentProgressData,
  MasterFlowFormField,
  MasterFlowStep,
} from '@/lib/types';

interface FulfillmentProgressProps {
  marketId: string;
  productId: string;
  /** Buyer lihat tombol approve/konfirmasi; seller lihat form "Tandai Step Selesai". */
  role: 'buyer' | 'seller';
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Fase 5 "Fulfillment & Escrow Release" — komponen bersama, dipakai dari
 * halaman status Order (DIRECT_SELL, `role="buyer"`), halaman status
 * Settlement (AUCTION, `role="buyer"`), dan halaman "Pesanan" Toko Saya
 * (`role="seller"`). Backend `GET .../fulfillment` sudah menghitung
 * `can_confirm`/`can_approve_current_step` — komponen ini cuma render
 * apa adanya, tidak menghitung ulang logic eligibility.
 */
export function FulfillmentProgress({ marketId, productId, role }: FulfillmentProgressProps) {
  const [data, setData] = useState<FulfillmentProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  /** Salin nilai step-selesai (mis. nomor resi) ke clipboard — feedback "Disalin" sebentar, bukan alert. */
  async function handleCopy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
    } catch {
      // Clipboard API bisa gagal (izin browser dll) — diam, bukan bagian kritis halaman ini.
    }
  }

  const load = useCallback(async () => {
    try {
      const result = await apiClient<FulfillmentProgressData>(
        `/api/markets/${marketId}/products/${productId}/fulfillment`,
      );
      setData(result);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Gagal memuat progress fulfillment.');
    } finally {
      setLoading(false);
    }
  }, [marketId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-400">Memuat progress fulfillment…</p>;
  }
  if (loadError || !data) {
    return <p className="text-sm text-[var(--brand-error)]">{loadError ?? 'Gagal memuat progress fulfillment.'}</p>;
  }

  const { fulfillment, steps, logs, can_confirm, can_approve_current_step } = data;
  const pendingApproval = !!fulfillment.current_step_guaranty_ends_at;
  const nextStep = steps.find((s) => s.sequence === fulfillment.current_step_sequence + 1);
  const sellerCanComplete =
    role === 'seller' && fulfillment.status === 'IN_PROGRESS' && !pendingApproval && !!nextStep;

  async function runAction(path: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      await apiClient(`/api/markets/${marketId}/products/${productId}/fulfillment${path}`, { method: 'POST' });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Gagal memproses aksi.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpload(fieldKey: string, file: File) {
    setUploadingKey(fieldKey);
    setActionError(null);
    try {
      const result = await uploadAsset(file, 'fulfillment');
      setFormValues((prev) => ({ ...prev, [fieldKey]: result.url }));
    } catch (err) {
      setActionError(err instanceof UploadError ? err.message : 'Gagal mengunggah file.');
    } finally {
      setUploadingKey(null);
    }
  }

  async function handleCompleteStep() {
    if (!nextStep) return;
    const schema = nextStep.form_schema ?? [];
    const missing = schema.filter((f) => f.required && !formValues[f.key]?.trim());
    if (missing.length > 0) {
      setActionError(`Field wajib belum diisi: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await apiClient(`/api/markets/${marketId}/products/${productId}/fulfillment/steps/complete`, {
        method: 'POST',
        body: JSON.stringify({ form_data: formValues }),
      });
      setFormValues({});
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Gagal menandai step selesai.');
    } finally {
      setActionLoading(false);
    }
  }

  function renderField(field: MasterFlowFormField) {
    const value = formValues[field.key] ?? '';
    if (field.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
        />
      );
    }
    if (field.type === 'image_url') {
      return (
        <div className="space-y-1">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(field.key, file);
            }}
            className="block w-full text-xs text-zinc-600"
          />
          {uploadingKey === field.key && <p className="text-xs text-zinc-400">Mengunggah…</p>}
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={field.label} className="h-16 w-16 rounded-lg border border-zinc-200 object-cover" />
          )}
        </div>
      );
    }
    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
      />
    );
  }

  /**
   * Nilai yang diisi seller saat menandai step ini selesai (`log.form_data`,
   * key = `MasterFlowFormField.key`) — SEBELUMNYA `logs` dari API sama sekali
   * tidak dipakai, jadi step yang sudah "Selesai" tidak pernah menampilkan
   * isian seller (nomor resi, foto bukti kirim, dst), cuma label statis dari
   * definisi step. `image_url` dirender sebagai thumbnail, tipe lain teks.
   */
  function renderStepValues(step: MasterFlowStep) {
    const log = logs.find((l) => l.event_type === 'STEP_COMPLETED' && l.step_sequence === step.sequence);
    const formData = log?.form_data;
    const schema = step.form_schema ?? [];
    if (!formData || schema.length === 0) return null;

    const entries = schema.filter((field) => formData[field.key] != null && formData[field.key] !== '');
    if (entries.length === 0) return null;

    return (
      <div className="mt-2 space-y-1 border-t border-green-200 pt-2">
        {entries.map((field) => {
          const value = formData[field.key];
          const copyKey = `${step.id}:${field.key}`;
          return (
            <div key={field.key} className="text-xs text-zinc-600">
              <span className="font-medium text-zinc-700">{field.label}:</span>{' '}
              {field.type === 'image_url' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(value)} alt={field.label} className="mt-1 h-16 w-16 rounded-lg border border-zinc-200 object-cover" />
              ) : (
                <span className="inline-flex items-center gap-1">
                  {String(value)}
                  <button
                    type="button"
                    onClick={() => handleCopy(copyKey, String(value))}
                    title="Salin"
                    className="rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    {copiedKey === copyKey ? (
                      <span className="text-[10px] font-medium text-green-600">Disalin</span>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                        <rect x="9" y="9" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Progress Fulfillment</h3>

      {steps.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Market ini tidak menetapkan tahapan fulfillment — buyer bisa langsung konfirmasi terima barang.
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step) => {
            const isDone = fulfillment.current_step_sequence >= step.sequence;
            const isCurrent = fulfillment.current_step_sequence + 1 === step.sequence;
            const label = isDone
              ? 'Selesai'
              : isCurrent && pendingApproval
                ? 'Menunggu persetujuan'
                : isCurrent
                  ? 'Berjalan'
                  : 'Belum mulai';
            return (
              <li
                key={step.id}
                className={`rounded-lg border p-3 text-sm ${
                  isDone
                    ? 'border-green-200 bg-green-50'
                    : isCurrent
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-800">
                    {step.sequence}. {step.status_name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">{label}</span>
                </div>
                {step.description && <p className="mt-1 text-xs text-zinc-500">{step.description}</p>}
                {step.release_percentage != null && (
                  <p className="mt-1 text-xs text-zinc-500">Rilis dana: {step.release_percentage}%</p>
                )}
                {isCurrent && pendingApproval && fulfillment.current_step_guaranty_ends_at && (
                  <p className="mt-1 text-xs text-amber-700">
                    Auto-release {formatDateTime(fulfillment.current_step_guaranty_ends_at)} kalau tidak disetujui.
                  </p>
                )}
                {isDone && renderStepValues(step)}
              </li>
            );
          })}
        </ol>
      )}

      {fulfillment.status === 'COMPLETED' && (
        <p className="text-sm font-medium text-green-700">
          Fulfillment selesai — dana sudah dirilis penuh ({currencyFormatter.format(fulfillment.total_released)}).
        </p>
      )}

      {fulfillment.status === 'IN_PROGRESS' && fulfillment.final_guaranty_ends_at && (
        <p className="text-xs text-zinc-500">
          Batas konfirmasi: {formatDateTime(fulfillment.final_guaranty_ends_at)} (otomatis rilis kalau tidak dikonfirmasi).
        </p>
      )}

      {actionError && <p className="text-sm text-[var(--brand-error)]">{actionError}</p>}

      {role === 'buyer' && can_approve_current_step && (
        <button
          type="button"
          onClick={() => runAction('/steps/approve')}
          disabled={actionLoading}
          className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {actionLoading ? 'Memproses…' : 'Setujui Pelepasan Dana'}
        </button>
      )}

      {role === 'buyer' && can_confirm && (
        <button
          type="button"
          onClick={() => runAction('/confirm')}
          disabled={actionLoading}
          className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {actionLoading ? 'Memproses…' : 'Konfirmasi Terima Barang'}
        </button>
      )}

      {sellerCanComplete && nextStep && (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium text-zinc-800">Tandai &ldquo;{nextStep.status_name}&rdquo; Selesai</p>
          {(nextStep.form_schema ?? []).map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="block text-xs font-medium text-zinc-600">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              {renderField(field)}
            </div>
          ))}
          <button
            type="button"
            onClick={handleCompleteStep}
            disabled={actionLoading}
            className="w-full rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {actionLoading ? 'Memproses…' : 'Tandai Selesai'}
          </button>
        </div>
      )}
    </div>
  );
}
