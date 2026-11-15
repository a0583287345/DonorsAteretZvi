// =====================================================================
// מנוע החזרתיות של התזכורות (כמו ביומן גוגל)
//
// כל תזכורת מוגדרת ע"י:
//   - תאריך התחלה (gregorian_date) = המופע הראשון
//   - סוג תאריך: לועזי או עברי (hebrew_day/month/year)
//   - חזרה: כל repeat_interval × repeat_unit (יום/שבוע/חודש/שנה), או בלי חזרה
//   - סיום: אף פעם / עד תאריך / אחרי X פעמים
// בתאריך עברי, חזרה חודשית/שנתית מחושבת לפי הלוח העברי
// (יום הולדת ויארצייט לפי כללי ההלכה של hebcal: אדר בשנה מעוברת, ל' חשוון וכו').
// =====================================================================

import { HDate, HebrewCalendar } from '@hebcal/core';
import { addDaysISO, daysInGregorianMonth, diffDays, parseISO, toISO } from './dates';
import { addHebrewMonths, hebrewToISO } from './hebrew';

export type RepeatUnit = 'none' | 'day' | 'week' | 'month' | 'year';
export type RepeatEndType = 'never' | 'until' | 'count';
export type DateType = 'gregorian' | 'hebrew';

export interface ReminderSchedule {
  gregorian_date: string;
  date_type?: string | null;
  hebrew_day?: number | null;
  hebrew_month?: number | null;
  hebrew_year?: number | null;
  repeat_unit?: string | null;
  repeat_interval?: number | null;
  repeat_end_type?: string | null;
  repeat_until?: string | null;
  repeat_count?: number | null;
  source?: string | null;
}

export interface ReminderProgress extends ReminderSchedule {
  lead_days?: number | null;
  completed_through?: string | null;
  snoozed_until?: string | null;
}

const MAX_ITERATIONS = 5000;

function unitOf(s: ReminderSchedule): RepeatUnit {
  const u = s.repeat_unit;
  return u === 'day' || u === 'week' || u === 'month' || u === 'year' ? u : 'none';
}

function isHebrew(s: ReminderSchedule) {
  return s.date_type === 'hebrew' && !!s.hebrew_day && !!s.hebrew_month && !!s.hebrew_year;
}

/** המופע ה-i (מ-0) של התזכורת, בלי להתחשב בתנאי סיום */
function occurrenceAt(s: ReminderSchedule, i: number): string | null {
  const anchor = s.gregorian_date.slice(0, 10);
  if (i === 0) return anchor;

  const unit = unitOf(s);
  const step = Math.max(1, s.repeat_interval || 1) * i;

  if (unit === 'none') return null;
  if (unit === 'day') return addDaysISO(anchor, step);
  if (unit === 'week') return addDaysISO(anchor, step * 7);

  if (isHebrew(s)) {
    const day = s.hebrew_day!;
    const month = s.hebrew_month!;
    const year = s.hebrew_year!;

    if (unit === 'month') {
      const next = addHebrewMonths(month, year, step);
      return hebrewToISO(day, next.month, next.year);
    }

    // שנתי עברי – לפי כללי יום הולדת / יארצייט
    const original = new HDate(Math.min(day, HDate.daysInMonth(month, year)), month, year);
    const target = year + step;
    const hd =
      s.source === 'donor_yahrzeit'
        ? HebrewCalendar.getYahrzeit(target, original)
        : HebrewCalendar.getBirthdayOrAnniversary(target, original);
    return hd ? toISO(hd.greg()) : null;
  }

  // לועזי
  const base = parseISO(anchor);
  const day = base.getDate();
  if (unit === 'month') {
    const total = base.getMonth() + step;
    const y = base.getFullYear() + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    return toISO(new Date(y, m, Math.min(day, daysInGregorianMonth(y, m))));
  }
  // שנתי: 29 בפברואר → 28 בשנה רגילה
  const y = base.getFullYear() + step;
  const m = base.getMonth();
  return toISO(new Date(y, m, Math.min(day, daysInGregorianMonth(y, m))));
}

/**
 * כל המופעים, לפי הסדר, החל מהמופע הראשון שהוא ≥ fromISO (אם צוין).
 * עוצר בתנאי הסיום של התזכורת.
 */
export function* occurrences(s: ReminderSchedule, fromISO?: string): Generator<string> {
  const unit = unitOf(s);
  const endType = s.repeat_end_type as RepeatEndType | null;
  const maxCount = endType === 'count' ? Math.max(1, s.repeat_count || 1) : Infinity;
  const until = endType === 'until' && s.repeat_until ? s.repeat_until.slice(0, 10) : null;

  let i = 0;
  // קפיצה מהירה ליום/שבוע כשמבקשים טווח רחוק
  if (fromISO && (unit === 'day' || unit === 'week')) {
    const stepDays = Math.max(1, s.repeat_interval || 1) * (unit === 'week' ? 7 : 1);
    const gap = diffDays(s.gregorian_date.slice(0, 10), fromISO);
    if (gap > 0) i = Math.floor(gap / stepDays);
  }

  let guard = 0;
  while (i < maxCount && guard++ < MAX_ITERATIONS) {
    const date = occurrenceAt(s, i);
    if (!date) return;
    if (until && date > until) return;
    if (!fromISO || date >= fromISO) yield date;
    if (unit === 'none') return;
    i += 1;
  }
}

/** כל המופעים בטווח [fromISO, toISO] כולל */
export function occurrencesBetween(s: ReminderSchedule, fromISO: string, toISO_: string): string[] {
  const result: string[] = [];
  for (const date of occurrences(s, fromISO)) {
    if (date > toISO_) break;
    result.push(date);
  }
  return result;
}

/** עד n מופעים החל מ-fromISO */
export function nextOccurrences(s: ReminderSchedule, fromISO: string, n: number): string[] {
  const result: string[] = [];
  for (const date of occurrences(s, fromISO)) {
    if (result.length >= n) break;
    result.push(date);
  }
  return result;
}

/** המופע הראשון שהוא ≥ fromISO, או null אם אין */
export function nextOccurrence(s: ReminderSchedule, fromISO: string): string | null {
  const it = occurrences(s, fromISO).next();
  return it.done ? null : it.value;
}

/** המופע האחרון שהוא < beforeISO, או null */
export function previousOccurrence(s: ReminderSchedule, beforeISO: string): string | null {
  let prev: string | null = null;
  for (const date of occurrences(s)) {
    if (date >= beforeISO) break;
    prev = date;
  }
  return prev;
}

// ---------------------------------------------------------------------
// מצב התזכורת ביחס להיום
// ---------------------------------------------------------------------

export type ReminderStatus = 'overdue' | 'today' | 'soon' | 'scheduled' | 'done';

export interface ReminderState {
  status: ReminderStatus;
  /** המופע הממתין (לפני דחייה), או null אם הכל בוצע */
  occurrence: string | null;
  /** התאריך בפועל (אחרי דחייה) */
  effectiveDate: string | null;
  /** כמה ימים עד התאריך בפועל (שלילי = באיחור) */
  daysUntil: number | null;
  snoozed: boolean;
}

export function reminderState(r: ReminderProgress, today: string): ReminderState {
  const from = r.completed_through ? addDaysISO(r.completed_through.slice(0, 10), 1) : undefined;
  const occurrence = from ? nextOccurrence(r, from) : nextOccurrence(r, '0000-01-01');

  if (!occurrence) {
    return { status: 'done', occurrence: null, effectiveDate: null, daysUntil: null, snoozed: false };
  }

  const snoozed = !!r.snoozed_until;
  const effectiveDate = r.snoozed_until ? r.snoozed_until.slice(0, 10) : occurrence;
  const daysUntil = diffDays(today, effectiveDate);
  const lead = Math.max(0, r.lead_days || 0);

  let status: ReminderStatus;
  if (daysUntil < 0) status = 'overdue';
  else if (daysUntil === 0) status = 'today';
  else if (daysUntil <= lead) status = 'soon';
  else status = 'scheduled';

  return { status, occurrence, effectiveDate, daysUntil, snoozed };
}

/** תיאור החזרתיות בעברית, למשל "כל שנה (לפי הלוח העברי)" */
export function describeRepeat(s: ReminderSchedule): string {
  const unit = unitOf(s);
  if (unit === 'none') return 'ללא חזרה';
  const n = Math.max(1, s.repeat_interval || 1);
  const names: Record<Exclude<RepeatUnit, 'none'>, [string, string]> = {
    day: ['כל יום', `כל ${n} ימים`],
    week: ['כל שבוע', `כל ${n} שבועות`],
    month: ['כל חודש', `כל ${n} חודשים`],
    year: ['כל שנה', `כל ${n} שנים`],
  };
  let text = n === 1 ? names[unit][0] : names[unit][1];
  if (isHebrew(s) && (unit === 'month' || unit === 'year')) text += ' (לפי הלוח העברי)';
  if (s.repeat_end_type === 'until' && s.repeat_until) {
    text += `, עד ${parseISO(s.repeat_until).toLocaleDateString('he-IL')}`;
  } else if (s.repeat_end_type === 'count' && s.repeat_count) {
    text += `, ${s.repeat_count} פעמים`;
  }
  return text;
}
