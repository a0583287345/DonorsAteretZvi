'use client';

import {
  daysInHebrewMonth,
  formatHebrewParts,
  gematriya,
  hebrewMonthsOfYear,
  hebrewToISO,
  isHebrewLeapYear,
} from '@/lib/reminders/hebrew';
import { formatGregorian } from '@/lib/reminders/dates';

export type HebrewValue = { day: number; month: number; year: number };

type Props = {
  value: HebrewValue;
  onChange: (value: HebrewValue) => void;
  /** בלי שנה (למשל יארצייט) */
  withoutYear?: boolean;
  disabled?: boolean;
};

const selectClass =
  'px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100';

/** בחירת תאריך עברי: יום, חודש ושנה (שנה עם הצגה בגימטריה) */
export default function HebrewDateInput({ value, onChange, withoutYear, disabled }: Props) {
  const { day, month, year } = value;
  const months = hebrewMonthsOfYear(year);
  const maxDay = daysInHebrewMonth(month === 13 && !isHebrewLeapYear(year) ? 12 : month, year);

  const set = (next: Partial<HebrewValue>) => {
    const merged = { ...value, ...next };
    // אדר ב' קיים רק בשנה מעוברת
    if (merged.month === 13 && !isHebrewLeapYear(merged.year)) merged.month = 12;
    merged.day = Math.min(merged.day, 30);
    onChange(merged);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <select
          value={day}
          onChange={(e) => set({ day: Number(e.target.value) })}
          disabled={disabled}
          className={selectClass}
          aria-label="יום"
        >
          {Array.from({ length: withoutYear ? 30 : maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {gematriya(d)}
            </option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => set({ month: Number(e.target.value) })}
          disabled={disabled}
          className={selectClass}
          aria-label="חודש"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {!withoutYear && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={5600}
              max={6000}
              value={year}
              onChange={(e) => set({ year: Number(e.target.value) || year })}
              disabled={disabled}
              className={`${selectClass} w-24`}
              aria-label="שנה"
              dir="ltr"
            />
            <span className="text-sm text-slate-500">{gematriya(year % 1000)}</span>
          </div>
        )}
      </div>

      {!withoutYear && (
        <p className="text-xs text-slate-500">
          {formatHebrewParts(Math.min(day, maxDay), month, year)} ={' '}
          <span dir="ltr">{formatGregorian(hebrewToISO(day, month, year))}</span>
        </p>
      )}
    </div>
  );
}
