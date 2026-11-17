'use client';

import { Repeat } from 'lucide-react';
import MultiSelectFilter from '@/components/filters/MultiSelectFilter';
import {
  DateRangeFilter,
  FiltersShell,
  NumberRangeFilter,
  YesNoFilter,
} from '@/components/filters/FilterFields';
import type { DonationFilters, DonationKind } from './useDonationFilters';

type Props = {
  filters: DonationFilters;
  /** בלי הרשאה לראות סכומים – לא מציגים סינון לפי סכום */
  canViewAmount: boolean;
  /** בלי הרשאה לראות פרטי התקשרות – לא מציגים סינון לפי עיר/מדינה */
  canViewContact: boolean;
};

/**
 * חיפוש וסינון של רשימת התרומות.
 * למעלה: מתג הוראות קבע. רגיל: תורם, תאריך, אמצעי תשלום, מטבע. מתקדם: כל השאר.
 */
export default function DonationsFiltersPanel({ filters, canViewAmount, canViewContact }: Props) {
  const {
    filters: f,
    setFilter,
    options,
    kindCounts,
    showAdvanced,
    setShowAdvanced,
    advancedActiveCount,
    hasActiveDonationFilters,
    clearDonationFilters,
  } = filters;

  const kinds: { id: DonationKind; label: string; count: number }[] = [
    { id: 'all', label: 'כל התרומות', count: kindCounts.all },
    { id: 'recurring', label: 'הוראות קבע', count: kindCounts.recurring },
    { id: 'regular', label: 'תרומות רגילות', count: kindCounts.regular },
  ];

  return (
    <FiltersShell
      search={f.search}
      onSearch={(v) => setFilter('search', v)}
      searchPlaceholder="חפש לפי שם תורם, טלפון, סכום, קבלה, אמצעי תשלום, הערות..."
      showAdvanced={showAdvanced}
      onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
      advancedActiveCount={advancedActiveCount}
      hasActive={hasActiveDonationFilters}
      onReset={clearDonationFilters}
      top={
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => {
            const selected = f.kind === k.id;
            const recurring = k.id === 'recurring';
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setFilter('kind', k.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  selected
                    ? recurring
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : recurring
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {recurring && <Repeat className="w-3.5 h-3.5" />}
                {k.label}
                <span className={`text-[10px] font-bold ${selected ? 'text-white/80' : 'text-slate-400'}`}>{k.count}</span>
              </button>
            );
          })}
        </div>
      }
      basic={
        <>
          <MultiSelectFilter
            label="תורם"
            options={options.donor}
            selected={f.donor}
            onChange={(v) => setFilter('donor', v)}
            placeholder="כל התורמים"
          />
          <DateRangeFilter
            label="תאריך תרומה"
            from={f.dateFrom}
            to={f.dateTo}
            onFrom={(v) => setFilter('dateFrom', v)}
            onTo={(v) => setFilter('dateTo', v)}
          />
          <MultiSelectFilter
            label="אמצעי תשלום"
            options={options.method}
            selected={f.method}
            onChange={(v) => setFilter('method', v)}
            placeholder="כל אמצעי התשלום"
          />
          <MultiSelectFilter
            label="מטבע"
            options={options.currency}
            selected={f.currency}
            onChange={(v) => setFilter('currency', v)}
            placeholder="כל המטבעות"
          />
        </>
      }
      advanced={
        <>
          {canViewAmount && (
            <NumberRangeFilter
              label="סכום"
              min={f.amountMin}
              max={f.amountMax}
              onMin={(v) => setFilter('amountMin', v)}
              onMax={(v) => setFilter('amountMax', v)}
            />
          )}
          <MultiSelectFilter
            label="מקור"
            options={options.source}
            selected={f.source}
            onChange={(v) => setFilter('source', v)}
            placeholder="ידני + נדרים פלוס"
          />
          {options.category.length > 0 && (
            <MultiSelectFilter
              label="קטגוריה"
              options={options.category}
              selected={f.category}
              onChange={(v) => setFilter('category', v)}
              placeholder="כל הקטגוריות"
            />
          )}
          {canViewContact && (
            <>
              <MultiSelectFilter
                label="עיר התורם"
                options={options.city}
                selected={f.city}
                onChange={(v) => setFilter('city', v)}
                placeholder="כל הערים"
              />
              <MultiSelectFilter
                label="מדינת התורם"
                options={options.country}
                selected={f.country}
                onChange={(v) => setFilter('country', v)}
                placeholder="כל המדינות"
              />
            </>
          )}
          <DateRangeFilter
            label="נוספה למערכת"
            from={f.createdFrom}
            to={f.createdTo}
            onFrom={(v) => setFilter('createdFrom', v)}
            onTo={(v) => setFilter('createdTo', v)}
          />
          <YesNoFilter label="מספר קבלה" value={f.hasReceipt} onChange={(v) => setFilter('hasReceipt', v)} yesLabel="יש" noLabel="אין" />
          <YesNoFilter label="קובץ מצורף" value={f.hasFile} onChange={(v) => setFilter('hasFile', v)} yesLabel="יש" noLabel="אין" />
          <YesNoFilter label="הערות" value={f.hasNotes} onChange={(v) => setFilter('hasNotes', v)} yesLabel="יש" noLabel="אין" />
        </>
      }
    />
  );
}
