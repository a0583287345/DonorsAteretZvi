'use client';

import FilterSummary, { SummaryCard } from '@/components/FilterSummary';
import type { DonorFilters } from './useDonorFilters';

/** כרטיסי סיכום מעל טבלת התורמים – לפי הסינון הנוכחי */
export default function DonorsSummary({ filters, totalCount }: { filters: DonorFilters; totalCount: number }) {
  const {
    filteredDonors,
    filteredDonorsWithDonations,
    filteredRecurringCount,
    filteredYissacharZevulunCount,
    hasActiveFilters,
    resetFilters,
  } = filters;

  return (
    <FilterSummary filtered={hasActiveFilters} onClear={resetFilters}>
      <SummaryCard
        label="מספר תורמים"
        value={<span className="text-blue-700">{filteredDonors.length}</span>}
        note={`מתוך ${totalCount} תורמים`}
      />
      <SummaryCard
        label="תרמו לפחות פעם אחת"
        value={<span className="text-slate-800">{filteredDonorsWithDonations}</span>}
      />
      <SummaryCard
        label="עם הוראת קבע"
        value={<span className="text-emerald-600">{filteredRecurringCount}</span>}
      />
      <SummaryCard
        label="יששכר וזבולון"
        value={<span className="text-amber-600">{filteredYissacharZevulunCount}</span>}
      />
    </FilterSummary>
  );
}
