'use client';

import { Filter } from 'lucide-react';

/** כרטיס נתון אחד בסיכום */
export function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-xl font-bold mt-0.5 leading-tight">{value}</div>
      {note && <div className="text-[10px] text-slate-400 mt-0.5">{note}</div>}
    </div>
  );
}

/** מיני-דשבורד שמחושב לפי הסינון הנוכחי (משותף לתורמים ולתרומות) */
export default function FilterSummary({
  filtered,
  children,
}: {
  /** האם יש סינון פעיל – משנה את הכותרת */
  filtered: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        נתונים לפי הסינון הנוכחי
        <span className="font-normal text-slate-400">
          {filtered ? '(מסונן)' : '(ללא סינון – כל הרשומות)'}
        </span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{children}</div>
    </section>
  );
}
