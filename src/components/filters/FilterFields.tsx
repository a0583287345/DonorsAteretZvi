'use client';

import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import DateInput from '@/components/DateInput';
import type { YesNoAll } from '@/lib/filters';

const labelClass = 'block text-[11px] text-slate-500 mb-1';
const inputClass =
  'w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const activeBorder = (active: boolean) => (active ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200');
// ל-DateInput יש מסגרת משלו – מוסיפים רק טבעת סימון כשהשדה פעיל
const dateActive = (active: boolean) => (active ? 'rounded-xl ring-2 ring-amber-300' : '');

/** בחירה בין שלוש אפשרויות: הכל / כן / לא */
export function YesNoFilter({
  label,
  value,
  onChange,
  yesLabel = 'כן',
  noLabel = 'לא',
  allLabel = 'הכל',
}: {
  label: string;
  value: YesNoAll;
  onChange: (v: YesNoAll) => void;
  yesLabel?: string;
  noLabel?: string;
  allLabel?: string;
}) {
  const options: { v: YesNoAll; text: string }[] = [
    { v: 'all', text: allLabel },
    { v: 'yes', text: yesLabel },
    { v: 'no', text: noLabel },
  ];
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <div className={`flex bg-white border rounded-xl p-0.5 ${activeBorder(value !== 'all')}`}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition ${
              value === o.v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** טווח תאריכים מ–עד */
export function DateRangeFilter({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        <DateInput value={from} onChange={onFrom} aria-label={`${label} – מתאריך`} className={dateActive(!!from)} />
        <DateInput value={to} onChange={onTo} aria-label={`${label} – עד תאריך`} className={dateActive(!!to)} />
      </div>
    </div>
  );
}

/** טווח מספרים מ–עד */
export function NumberRangeFilter({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="מ-"
          className={`${inputClass} ${activeBorder(min !== '')}`}
        />
        <input
          type="number"
          inputMode="decimal"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="עד"
          className={`${inputClass} ${activeBorder(max !== '')}`}
        />
      </div>
    </div>
  );
}

/** חיפוש טקסט חופשי בשדה אחד (למשל הערות) */
export function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${activeBorder(value.trim() !== '')}`}
      />
    </div>
  );
}

/**
 * מסגרת משותפת לסינון: חיפוש חופשי, כפתור "סינון מתקדם" (עם מספר הסינונים הפעילים בו),
 * ניקוי, שורת הסינון הרגיל ואזור הסינון המתקדם.
 */
export function FiltersShell({
  search,
  onSearch,
  searchPlaceholder,
  showAdvanced,
  onToggleAdvanced,
  advancedActiveCount,
  hasActive,
  onReset,
  top,
  basic,
  advanced,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  advancedActiveCount: number;
  hasActive: boolean;
  onReset: () => void;
  /** שורה מעל הסינון הרגיל (למשל מתג "הוראות קבע") */
  top?: React.ReactNode;
  basic: React.ReactNode;
  advanced: React.ReactNode;
}) {
  return (
    <div
      className={`bg-slate-50 p-3 md:p-4 rounded-2xl border space-y-3 ${
        hasActive ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full pr-9 pl-4 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${activeBorder(
              search.trim() !== ''
            )}`}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 whitespace-nowrap ${
              advancedActiveCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            סינון מתקדם
            {advancedActiveCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {advancedActiveCount}
              </span>
            )}
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {top}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">{basic}</div>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-3 border-t border-slate-200">
          {advanced}
        </div>
      )}
    </div>
  );
}
