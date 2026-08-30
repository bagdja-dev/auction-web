'use client';

import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Nilai mentah — string digit polos (mis. "1000000"), bukan yang sudah diformat. */
  value: string;
  /** Dipanggil dengan string digit polos (tanpa pemisah ribuan). */
  onChange: (raw: string) => void;
}

const BASE_CLASS =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]';

/**
 * Input angka dengan mask pemisah ribuan ala Indonesia (mis. "1.000.000")
 * saat mengetik. `type="number"` bawaan browser tidak bisa menampilkan mask
 * (karakter non-digit ditolak), jadi ini pakai `type="text"` + `inputMode`
 * numerik, dengan state yang tetap disimpan sebagai digit polos di caller.
 * Pola sama persis dengan `bagdja-auction-admin/src/components/number-input.tsx`,
 * cuma restyle ke Tailwind polos (app ini tidak pakai shadcn/ui).
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const display = value ? Number(value).toLocaleString('id-ID') : '';

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      onChange(raw);
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        className={className ?? BASE_CLASS}
        {...props}
      />
    );
  },
);

NumberInput.displayName = 'NumberInput';
