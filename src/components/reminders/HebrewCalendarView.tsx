'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { HDate, HebrewCalendar, flags } from '@hebcal/core';
import type { Donor, Reminder } from '@/types/donor';
import { parseISO, toISO } from '@/lib/reminders/dates';
import { addHebrewMonths, gematriya, hebrewMonthName } from '@/lib/reminders/hebrew';
import { occurrencesBetween, reminderState } from '@/lib/reminders/recurrence';
import { STATUS_STYLES } from './reminderUi';

type Props = {
  reminders: Reminder[];
  donorMap: Map<string, Donor>;
  today: string;
  onOpen: (reminder: Reminder) => void;
};

type DayItem = { reminder: Reminder; done: boolean; snoozed: boolean };

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
const GREG_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HOLIDAY_MASK = flags.CHAG | flags.MINOR_HOLIDAY | flags.MAJOR_FAST | flags.MINOR_FAST | flags.ROSH_CHODESH | flags.MODERN_HOLIDAY;

/** לוח שנה לפי חודש עברי, עם תאריכים לועזיים, חגים ותזכורות */
export default function HebrewCalendarView({ reminders, donorMap, today, onOpen }: Props) {
  const todayHd = new HDate(parseISO(today));
  const [cursor, setCursor] = useState({ month: todayHd.getMonth(), year: todayHd.getFullYear() });

  const days = useMemo(() => {
    const count = HDate.daysInMonth(cursor.month, cursor.year);
    return Array.from({ length: count }, (_, i) => {
      const hd = new HDate(i + 1, cursor.month, cursor.year);
      const iso = toISO(hd.greg());
      const holidays = (HebrewCalendar.getHolidaysOnDate(hd, true) || [])
        .filter((ev) => ev.getFlags() & HOLIDAY_MASK)
        .map((ev) => ev.render('he-x-NoNikud'));
      return { hd, iso, holidays };
    });
  }, [cursor]);

  const firstISO = days[0].iso;
  const lastISO = days[days.length - 1].iso;

  // תזכורות לפי יום בחודש המוצג
  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (iso: string, item: DayItem) => {
      if (iso < firstISO || iso > lastISO) return;
      const list = map.get(iso) ?? [];
      list.push(item);
      map.set(iso, list);
    };

    for (const r of reminders) {
      const doneThrough = r.completed_through?.slice(0, 10) ?? '';
      const snoozed = r.snoozed_until?.slice(0, 10);
      // המופע הממתין – אם נדחה, מוצג בתאריך הדחייה במקום בתאריך המקורי
      const pending = snoozed ? reminderState(r, today).occurrence : null;
      for (const occ of occurrencesBetween(r, firstISO, lastISO)) {
        if (occ === pending) continue;
        const done = !!doneThrough && occ <= doneThrough;
        push(occ, { reminder: r, done, snoozed: false });
      }
      if (snoozed) push(snoozed, { reminder: r, done: false, snoozed: true });
    }
    return map;
  }, [reminders, firstISO, lastISO, today]);

  const offset = parseISO(firstISO).getDay(); // ראשון = 0
  const gFirst = parseISO(firstISO);
  const gLast = parseISO(lastISO);
  const gregRange =
    gFirst.getMonth() === gLast.getMonth()
      ? `${GREG_MONTHS[gFirst.getMonth()]} ${gFirst.getFullYear()}`
      : `${GREG_MONTHS[gFirst.getMonth()]}${gFirst.getFullYear() !== gLast.getFullYear() ? ` ${gFirst.getFullYear()}` : ''} – ${GREG_MONTHS[gLast.getMonth()]} ${gLast.getFullYear()}`;

  const move = (n: number) => setCursor((c) => addHebrewMonths(c.month, c.year, n));

  const donorName = (r: Reminder) => {
    const d = r.donor_id ? donorMap.get(r.donor_id) : null;
    return d ? `${d.first_name_he || ''} ${d.last_name_he || ''}`.trim() : '';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* כותרת וניווט */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-100 bg-slate-50">
        <button onClick={() => move(-1)} className="p-2 rounded-lg hover:bg-white text-slate-600" title="חודש קודם">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-800">
            {hebrewMonthName(cursor.month, cursor.year)} {gematriya(cursor.year % 1000)}
          </div>
          <div className="text-xs text-slate-500">{gregRange}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor({ month: todayHd.getMonth(), year: todayHd.getFullYear() })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-purple-700 hover:bg-white"
          >
            <CalendarDays className="w-4 h-4" />
            היום
          </button>
          <button onClick={() => move(1)} className="p-2 rounded-lg hover:bg-white text-slate-600" title="חודש הבא">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ימי השבוע */}
      <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 border-b border-slate-100">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* הימים */}
      <div className="grid grid-cols-7">
        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} className="min-h-24 border-b border-l border-slate-100 bg-slate-50/40" />
        ))}

        {days.map(({ hd, iso, holidays }) => {
          const g = hd.greg();
          const isToday = iso === today;
          const isShabbat = g.getDay() === 6;
          const items = itemsByDay.get(iso) ?? [];
          return (
            <div
              key={iso}
              className={`min-h-24 border-b border-l border-slate-100 p-1.5 flex flex-col gap-1 ${
                isShabbat ? 'bg-blue-50/40' : ''
              } ${isToday ? 'ring-2 ring-inset ring-purple-400' : ''}`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-sm font-bold ${isToday ? 'text-purple-700' : 'text-slate-800'}`}>
                  {gematriya(hd.getDate())}
                </span>
                <span className="text-[10px] text-slate-400" dir="ltr">
                  {g.getDate()}/{g.getMonth() + 1}
                </span>
              </div>

              {holidays.map((h) => (
                <div key={h} className="text-[10px] leading-tight text-sky-700 font-medium truncate" title={h}>
                  {h}
                </div>
              ))}

              {items.map(({ reminder, done, snoozed }, idx) => (
                <button
                  key={`${reminder.id}-${idx}`}
                  onClick={() => onOpen(reminder)}
                  title={`${reminder.title}${donorName(reminder) ? ` – ${donorName(reminder)}` : ''}`}
                  className={`text-right text-[11px] leading-tight px-1.5 py-1 rounded-md border truncate transition ${
                    done
                      ? 'bg-slate-50 text-slate-400 line-through border-slate-100'
                      : snoozed
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : iso < today
                          ? `${STATUS_STYLES.overdue.badge} hover:brightness-95`
                          : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  {reminder.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
