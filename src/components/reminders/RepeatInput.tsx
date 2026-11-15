'use client';

import type { RepeatEndType, RepeatUnit } from '@/lib/reminders/recurrence';
import DateInput from '@/components/DateInput';

export type RepeatValue = {
  unit: RepeatUnit;
  interval: number;
  endType: RepeatEndType;
  until: string;
  count: number;
};

type Props = {
  value: RepeatValue;
  onChange: (value: RepeatValue) => void;
  /** בתאריך עברי – חודש/שנה מחושבים לפי הלוח העברי */
  hebrew: boolean;
  disabled?: boolean;
};

const UNIT_LABELS: Record<Exclude<RepeatUnit, 'none'>, string> = {
  day: 'ימים',
  week: 'שבועות',
  month: 'חודשים',
  year: 'שנים',
};

const inputClass =
  'px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100';

/** הגדרת חזרתיות כמו ביומן גוגל: כל X ימים/שבועות/חודשים/שנים, וסיום */
export default function RepeatInput({ value, onChange, hebrew, disabled }: Props) {
  const set = (next: Partial<RepeatValue>) => onChange({ ...value, ...next });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <select
          value={value.unit === 'none' ? 'none' : 'repeat'}
          onChange={(e) => set({ unit: e.target.value === 'none' ? 'none' : 'year' })}
          disabled={disabled}
          className={inputClass}
        >
          <option value="none">ללא חזרה (פעם אחת)</option>
          <option value="repeat">חוזרת</option>
        </select>

        {value.unit !== 'none' && (
          <>
            <span>כל</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={value.interval}
              onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
              disabled={disabled}
              className={`${inputClass} w-20`}
              dir="ltr"
            />
            <select
              value={value.unit}
              onChange={(e) => set({ unit: e.target.value as RepeatUnit })}
              disabled={disabled}
              className={inputClass}
            >
              {(Object.keys(UNIT_LABELS) as (keyof typeof UNIT_LABELS)[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
            {hebrew && (value.unit === 'month' || value.unit === 'year') && (
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                לפי הלוח העברי
              </span>
            )}
          </>
        )}
      </div>

      {value.unit !== 'none' && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span className="font-medium">מסתיים:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={value.endType === 'never'}
              onChange={() => set({ endType: 'never' })}
              disabled={disabled}
              className="accent-purple-600"
            />
            אף פעם
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={value.endType === 'until'}
              onChange={() => set({ endType: 'until' })}
              disabled={disabled}
              className="accent-purple-600"
            />
            בתאריך
            <DateInput
              value={value.until}
              onChange={(iso) => set({ endType: 'until', until: iso })}
              disabled={disabled || value.endType !== 'until'}
              className="max-w-[11rem]"
            />
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={value.endType === 'count'}
              onChange={() => set({ endType: 'count' })}
              disabled={disabled}
              className="accent-purple-600"
            />
            אחרי
            <input
              type="number"
              min={1}
              max={1000}
              value={value.count}
              onChange={(e) => set({ endType: 'count', count: Math.max(1, Number(e.target.value) || 1) })}
              disabled={disabled || value.endType !== 'count'}
              className={`${inputClass} w-20`}
              dir="ltr"
            />
            פעמים
          </label>
        </div>
      )}
    </div>
  );
}
