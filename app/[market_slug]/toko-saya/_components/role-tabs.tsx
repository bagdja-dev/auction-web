'use client';

interface RoleTabsProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}

/** Tab switcher generik (seller vs buyer) dipakai `lelang-content.tsx`/`beli-langsung-content.tsx`. */
export function RoleTabs<T extends string>({ tabs, active, onChange }: RoleTabsProps<T>) {
  return (
    <div className="flex gap-2 border-b border-zinc-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`border-b-2 px-1 pb-2 text-sm font-medium transition ${
            active === tab.key
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
