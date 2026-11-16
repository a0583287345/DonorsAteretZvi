'use client';

import type { PermissionAccess } from '@/lib/permissions';
import { LockedText } from '@/components/Protect';
import FilterSummary, { SummaryCard } from '@/components/FilterSummary';
import { formatNumber } from './donationUtils';

type Props = {
  filteredCount: number;
  totalCount: number;
  donorCount: number;
  /** סכום לכל מטבע בנפרד – לא מחברים מטבעות שונים */
  totalsByCurrency: Record<string, number>;
  amountAccess: PermissionAccess;
  /** האם יש סינון פעיל */
  filtered: boolean;
};

/** כרטיסי סיכום מעל טבלת התרומות – לפי הסינון הנוכחי */
export default function DonationsSummary({
  filteredCount,
  totalCount,
  donorCount,
  totalsByCurrency,
  amountAccess,
  filtered,
}: Props) {
  // ILS קודם, אחריו שאר המטבעות לפי סדר אלפביתי
  const currencies = Object.keys(totalsByCurrency).sort((a, b) =>
    a === 'ILS' ? -1 : b === 'ILS' ? 1 : a.localeCompare(b)
  );

  return (
    <FilterSummary filtered={filtered}>
      <SummaryCard
        label="מספר תרומות"
        value={<span className="text-slate-800">{filteredCount}</span>}
        note={`מתוך ${totalCount} תרומות`}
      />

      <SummaryCard
        label="מספר תורמים"
        value={<span className="text-slate-800">{donorCount}</span>}
        note="תורמים ייחודיים"
      />

      {amountAccess === 'locked' && <SummaryCard label='סה"כ' value={<LockedText />} />}

      {amountAccess === 'allowed' &&
        currencies.map((currency) => (
          <SummaryCard
            key={currency}
            label={`סה"כ ${currency}`}
            value={<span className="text-emerald-600">{formatNumber(totalsByCurrency[currency])}</span>}
          />
        ))}
    </FilterSummary>
  );
}
