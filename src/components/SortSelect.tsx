'use client';

import { ArrowUpDown } from 'lucide-react';

export type SortOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SortOption<T>[];
  /** טקסט קצר לצד המיון, למשל "מציג 12 תורמים" */
  info?: React.ReactNode;
};

/** שורת מיון מעל טבלה – נפרדת מהסינון */
export default function SortSelect<T extends string>({ value, onChange, options, info }: Props<T>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-xs text-slate-500">{info}</div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <ArrowUpDown className="w-4 h-4 text-slate-400" />
        <span className="font-medium">מיון:</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
