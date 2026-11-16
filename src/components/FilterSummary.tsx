'use client';

import { Filter, X } from 'lucide-react';

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

/**
 * מיני-דשבורד שמחושב לפי הסינון הנוכחי (משותף לתורמים ולתרומות).
 * הסינון נשמר בין לשוניות וברענון – לכן כשיש סינון פעיל מציגים סימון בולט וכפתור ניקוי.
 */
export default function FilterSummary({
  filtered,
  onClear,
  children,
}: {
  /** האם יש סינון פעיל */
  filtered: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          נתונים לפי הסינון הנוכחי
        </h3>

        {filtered ? (
          <span className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            סינון פעיל – לא כל הרשומות מוצגות
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-amber-900 underline underline-offset-2 hover:text-red-600"
            >
              <X className="w-3 h-3" />
              נקה סינון
            </button>
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">(ללא סינון – כל הרשומות)</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{children}</div>
    </section>
  );
}
