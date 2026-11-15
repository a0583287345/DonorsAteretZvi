'use client';

import { Calendar, Flame, Sparkles } from 'lucide-react';
import { formatHebrewParts, gematriya, toHebrewParts, YAHRZEIT_MONTH_OPTIONS } from '@/lib/reminders/hebrew';
import type { DonorFormSectionProps } from './donorFormData';

const inputClass =
  'w-full p-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

/** תאריכים: יום הולדת (לועזי + עברי מחושב) ויארצייט (תאריך עברי) – יוצרים תזכורות אוטומטיות */
export default function DonorDatesSection({ formData, updateField }: DonorFormSectionProps) {
  const birthdayHebrew = formData.birthday
    ? (() => {
        const p = toHebrewParts(formData.birthday, formData.birthday_after_sunset);
        return formatHebrewParts(p.day, p.month, p.year);
      })()
    : '';

  const hasYahrzeit = formData.yahrzeit_hebrew_day > 0 && formData.yahrzeit_hebrew_month > 0;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800 border-b pb-1">תאריכים</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* יום הולדת */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            תאריך לידה
          </label>
          <input
            type="date"
            value={formData.birthday}
            onChange={(e) => updateField('birthday', e.target.value)}
            className={inputClass}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.birthday_after_sunset}
              onChange={(e) => updateField('birthday_after_sunset', e.target.checked)}
              className="accent-blue-600"
            />
            נולד/ה אחרי השקיעה
          </label>
          {birthdayHebrew && <p className="text-xs text-slate-500">תאריך עברי: {birthdayHebrew}</p>}
        </div>

        {/* יארצייט */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-slate-400" />
            יארצייט (תאריך עברי)
          </label>
          <div className="flex gap-2">
            <select
              value={formData.yahrzeit_hebrew_day || ''}
              onChange={(e) => updateField('yahrzeit_hebrew_day', Number(e.target.value) || 0)}
              className={`${inputClass} w-24`}
              aria-label="יום"
            >
              <option value="">יום</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {gematriya(d)}
                </option>
              ))}
            </select>
            <select
              value={formData.yahrzeit_hebrew_month || ''}
              onChange={(e) => updateField('yahrzeit_hebrew_month', Number(e.target.value) || 0)}
              className={inputClass}
              aria-label="חודש"
            >
              <option value="">חודש</option>
              {YAHRZEIT_MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={formData.yahrzeit_of}
            onChange={(e) => updateField('yahrzeit_of', e.target.value)}
            placeholder="לעילוי נשמת... (למשל: אביו ר' יעקב בן אברהם)"
            className={inputClass}
          />
          {(formData.yahrzeit_hebrew_day > 0) !== (formData.yahrzeit_hebrew_month > 0) && (
            <p className="text-xs text-amber-700">יש לבחור גם יום וגם חודש.</p>
          )}
        </div>
      </div>

      {(formData.birthday || hasYahrzeit) && (
        <p className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
          <Sparkles className="w-3.5 h-3.5" />
          בשמירה ייווצרו/יתעדכנו תזכורות אוטומטיות
          {formData.birthday ? ': יום הולדת לועזי ועברי' : ''}
          {hasYahrzeit ? `${formData.birthday ? ' ויארצייט' : ': יארצייט'}` : ''} (שבוע לפני המועד).
        </p>
      )}
    </section>
  );
}
