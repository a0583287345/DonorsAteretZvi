'use client';

import type { PermissionAccess } from '@/lib/permissions';
import { LockedText } from '@/components/Protect';
import { formatNumber } from './donationUtils';

type Props = {
  filteredCount: number;
  totalCount: number;
  donorCount: number;
  /** סכום לכל מטבע בנפרד – לא מחברים מטבעות שונים */
  totalsByCurrency: Record<string, number>;
  amountAccess: PermissionAccess;
};

function Card({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-[10px] text-slate-400 mt-1">{note}</div>
    </div>
  );
}

/** כרטיסי סיכום מעל טבלת התרומות */
export default function DonationsSummary({
  filteredCount,
  totalCount,
  donorCount,
  totalsByCurrency,
  amountAccess,
}: Props) {
  // ILS קודם, אחריו שאר המטבעות לפי סדר אלפביתי
  const currencies = Object.keys(totalsByCurrency).sort((a, b) =>
    a === 'ILS' ? -1 : b === 'ILS' ? 1 : a.localeCompare(b)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        label="מספר תרומות"
        value={<span className="text-slate-800">{filteredCount}</span>}
        note={`מתוך ${totalCount} תרומות`}
      />

      <Card
        label="מספר תורמים"
        value={<span className="text-slate-800">{donorCount}</span>}
        note="תורמים ייחודיים לפי הסינון הנוכחי"
      />

      {amountAccess === 'locked' && (
        <Card label='סה"כ' value={<LockedText />} note="לפי הסינון הנוכחי" />
      )}

      {amountAccess === 'allowed' &&
        currencies.map((currency) => (
          <Card
            key={currency}
            label={`סה"כ ${currency}`}
            value={<span className="text-emerald-600">{formatNumber(totalsByCurrency[currency])}</span>}
            note="לפי הסינון הנוכחי"
          />
        ))}
    </div>
  );
}
