'use client';

import { useState } from 'react';
import { Calendar, Flame, Plus, Sparkles, Trash2, X } from 'lucide-react';
import HebrewDateInput from '@/components/reminders/HebrewDateInput';
import { todayISO } from '@/lib/reminders/dates';
import DateInput from '@/components/DateInput';
import { formatHebrewParts, gematriya, hebrewToISO, toHebrewParts, YAHRZEIT_MONTH_OPTIONS } from '@/lib/reminders/hebrew';
import { newYahrzeitKey, validYahrzeits, type DonorFormSectionProps, type YahrzeitEntry } from './donorFormData';

const inputClass =
  'w-full p-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

/** תאריכים: יום הולדת (לועזי + עברי מחושב) ויארצייט (תאריך עברי) – יוצרים תזכורות אוטומטיות */
export default function DonorDatesSection({ formData, updateField }: DonorFormSectionProps) {
  // הזנת יום הולדת לפי לועזי או עברי – שניהם נשמרים כתאריך לועזי אחד ומסונכרנים
  const [birthdayMode, setBirthdayMode] = useState<'gregorian' | 'hebrew'>('gregorian');
  const birthdayParts = toHebrewParts(formData.birthday || todayISO(), formData.birthday_after_sunset);
  const birthdayHebrew = formData.birthday
    ? (() => {
        const p = toHebrewParts(formData.birthday, formData.birthday_after_sunset);
        return formatHebrewParts(p.day, p.month, p.year);
      })()
    : '';

  const yahrzeits = formData.yahrzeits;
  const hasYahrzeit = validYahrzeits(yahrzeits).length > 0;
  const setYahrzeit = (key: string, patch: Partial<YahrzeitEntry>) =>
    updateField('yahrzeits', yahrzeits.map((y) => (y.key === key ? { ...y, ...patch } : y)));
  const removeYahrzeit = (key: string) =>
    updateField('yahrzeits', yahrzeits.filter((y) => y.key !== key));
  const addYahrzeit = () =>
    updateField('yahrzeits', [...yahrzeits, { key: newYahrzeitKey(), day: 0, month: 0, name: '' }]);

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
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden text-xs">
              {(['gregorian', 'hebrew'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBirthdayMode(m)}
                  className={`px-3 py-1.5 font-bold ${birthdayMode === m ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m === 'gregorian' ? 'לועזי' : 'עברי'}
                </button>
              ))}
            </div>
            {formData.birthday && (
              <button
                type="button"
                onClick={() => {
                  updateField('birthday', '');
                  updateField('birthday_after_sunset', false);
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
              >
                <X className="w-3.5 h-3.5" />
                נקה
              </button>
            )}
          </div>

          {birthdayMode === 'gregorian' ? (
            <>
              <DateInput value={formData.birthday} onChange={(iso) => updateField('birthday', iso)} />
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
            </>
          ) : (
            <>
              <HebrewDateInput
                value={birthdayParts}
                onChange={(v) => {
                  // התאריך העברי קובע – הלועזי הוא היום המקביל (בשעות היום)
                  updateField('birthday', hebrewToISO(v.day, v.month, v.year));
                  updateField('birthday_after_sunset', false);
                }}
              />
              {!formData.birthday && (
                <p className="text-xs text-amber-700">בחר יום, חודש ושנה כדי לשמור תאריך לידה.</p>
              )}
            </>
          )}
        </div>

        {/* ימי יארצייט – אפשר כמה */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-slate-400" />
            ימי יארצייט (תאריך עברי)
          </label>

          {yahrzeits.length === 0 && <p className="text-xs text-slate-400">לא הוגדרו ימי יארצייט.</p>}

          {yahrzeits.map((y) => (
            <div key={y.key} className="rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={y.day || ''}
                  onChange={(e) => setYahrzeit(y.key, { day: Number(e.target.value) || 0 })}
                  className={`${inputClass} w-24 bg-white`}
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
                  value={y.month || ''}
                  onChange={(e) => setYahrzeit(y.key, { month: Number(e.target.value) || 0 })}
                  className={`${inputClass} bg-white`}
                  aria-label="חודש"
                >
                  <option value="">חודש</option>
                  {YAHRZEIT_MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeYahrzeit(y.key)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="הסר יארצייט"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={y.name}
                onChange={(e) => setYahrzeit(y.key, { name: e.target.value })}
                placeholder="לעילוי נשמת... (למשל: אביו ר' יעקב בן אברהם)"
                className={`${inputClass} bg-white`}
              />
              {(y.day > 0) !== (y.month > 0) && <p className="text-xs text-amber-700">יש לבחור גם יום וגם חודש.</p>}
            </div>
          ))}

          <button
            type="button"
            onClick={addYahrzeit}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200"
          >
            <Plus className="w-3.5 h-3.5" />
            הוסף יום יארצייט
          </button>
        </div>
      </div>

      {(formData.birthday || hasYahrzeit) && (
        <p className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
          <Sparkles className="w-3.5 h-3.5" />
          בשמירה ייווצרו/יתעדכנו תזכורות אוטומטיות
          {formData.birthday ? ': יום הולדת לועזי ועברי' : ''}
          {hasYahrzeit ? `${formData.birthday ? ' וימי יארצייט' : ': ימי יארצייט'}` : ''} (שבוע לפני המועד).
        </p>
      )}
    </section>
  );
}
