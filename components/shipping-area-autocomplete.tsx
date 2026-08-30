'use client';

/**
 * Autocomplete cari alamat tujuan pengiriman — panggil
 * `GET /api/public/shipping/areas?q=` (no-auth, langsung ke
 * `NEXT_PUBLIC_API_URL` lewat `searchShippingAreas`, lihat `lib/api-client.ts`).
 * Adaptasi dari `bagdja-website/components/shipping-area-search.tsx`, restyle
 * ke Tailwind polos + `--brand-primary` sesuai gaya input di
 * `checkout-form.tsx` app ini.
 */
import { useEffect, useRef, useState } from 'react';

import { searchShippingAreas } from '@/lib/api-client';
import type { ShippingArea } from '@/lib/types';

export interface ShippingAreaSelection {
  providerAreaId: string;
  name: string;
}

interface ShippingAreaAutocompleteProps {
  value: ShippingAreaSelection | null;
  onChange: (area: ShippingAreaSelection | null) => void;
  placeholder?: string;
}

export function ShippingAreaAutocomplete({ value, onChange, placeholder }: ShippingAreaAutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [options, setOptions] = useState<ShippingArea[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.name]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed || trimmed === value?.name) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchShippingAreas(trimmed);
        setOptions(data);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Cari kota/kecamatan...'}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
      />
      {loading && <p className="mt-1 text-xs text-zinc-400">Mencari area…</p>}
      {open && options.length > 0 && (
        <ul className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {options.map((opt) => (
            <li key={opt.providerAreaId}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={() => {
                  onChange({ providerAreaId: opt.providerAreaId, name: opt.name });
                  setQuery(opt.name);
                  setOpen(false);
                }}
              >
                {opt.name}
                {opt.type && <span className="ml-1.5 text-xs text-zinc-400">({opt.type})</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
