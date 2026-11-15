// =====================================================================
// תאריכים עבריים (מבוסס @hebcal/core)
// מספור חודשים לפי hebcal: ניסן=1 ... אלול=6, תשרי=7 ... שבט=11, אדר/אדר א'=12, אדר ב'=13
// =====================================================================

import { HDate, gematriya } from '@hebcal/core';
import { parseISO, toISO } from './dates';

export const HEBREW_MONTH_NAMES: Record<number, string> = {
  1: 'ניסן',
  2: 'אייר',
  3: 'סיון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
  7: 'תשרי',
  8: 'חשוון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר',
  13: 'אדר ב׳',
};

/** סדר החודשים בשנה העברית (מתשרי) */
export const HEBREW_MONTH_ORDER = [7, 8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6];

export type HebrewParts = { day: number; month: number; year: number };

export function hebrewMonthName(month: number, year?: number): string {
  if (month === 12 && year !== undefined && HDate.isLeapYear(year)) return 'אדר א׳';
  return HEBREW_MONTH_NAMES[month] ?? '';
}

/** תאריך לועזי → יום/חודש/שנה עבריים. afterSunset: אחרי השקיעה זה כבר היום העברי הבא */
export function toHebrewParts(iso: string, afterSunset = false): HebrewParts {
  let hd = new HDate(parseISO(iso));
  if (afterSunset) hd = hd.next();
  return { day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() };
}

/** יום/חודש/שנה עבריים → תאריך לועזי. יום שלא קיים בחודש (ל' בחודש חסר) → היום האחרון */
export function hebrewToISO(day: number, month: number, year: number): string {
  const m = month === 13 && !HDate.isLeapYear(year) ? 12 : month;
  const d = Math.min(day, HDate.daysInMonth(m, year));
  return toISO(new HDate(d, m, year).greg());
}

/** "י״ד אדר תשפ״ז" */
export function formatHebrewParts(day: number, month: number, year?: number): string {
  const dayStr = gematriya(day);
  const monthStr = hebrewMonthName(month, year);
  return year ? `${dayStr} ${monthStr} ${gematriya(year % 1000)}` : `${dayStr} ${monthStr}`;
}

/** תאריך לועזי → "י״ד אדר תשפ״ז" */
export function formatHebrewDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '';
  const p = toHebrewParts(iso);
  return formatHebrewParts(p.day, p.month, withYear ? p.year : undefined);
}

export function currentHebrewYear(): number {
  return new HDate().getFullYear();
}

export function isHebrewLeapYear(year: number): boolean {
  return HDate.isLeapYear(year);
}

export function daysInHebrewMonth(month: number, year: number): number {
  return HDate.daysInMonth(month, year);
}

/** חודשים לבחירה בשנה מסוימת, לפי הסדר מתשרי (אדר א'/ב' רק בשנה מעוברת) */
export function hebrewMonthsOfYear(year: number): { value: number; label: string }[] {
  const leap = HDate.isLeapYear(year);
  return HEBREW_MONTH_ORDER.filter((m) => leap || m !== 13).map((m) => ({
    value: m,
    label: hebrewMonthName(m, year),
  }));
}

/** חודשים ליארצייט (בלי שנה): אדר רגיל = 12, אדר ב' = 13 */
export const YAHRZEIT_MONTH_OPTIONS = HEBREW_MONTH_ORDER.map((m) => ({
  value: m,
  label: m === 12 ? 'אדר / אדר א׳' : HEBREW_MONTH_NAMES[m],
}));

/** הוספת n חודשים עבריים לחודש/שנה נתונים (n יכול להיות שלילי) */
export function addHebrewMonths(month: number, year: number, n: number): { month: number; year: number } {
  let y = year;
  let idx = monthIndexInYear(month, y);
  idx += n;
  while (idx >= monthsInYear(y)) {
    idx -= monthsInYear(y);
    y += 1;
  }
  while (idx < 0) {
    y -= 1;
    idx += monthsInYear(y);
  }
  return { month: monthAtIndex(idx, y), year: y };
}

function monthsInYear(year: number) {
  return HDate.isLeapYear(year) ? 13 : 12;
}

function monthsOfYear(year: number) {
  return HEBREW_MONTH_ORDER.filter((m) => HDate.isLeapYear(year) || m !== 13);
}

function monthIndexInYear(month: number, year: number) {
  const list = monthsOfYear(year);
  const idx = list.indexOf(month === 13 && !HDate.isLeapYear(year) ? 12 : month);
  return idx < 0 ? 0 : idx;
}

function monthAtIndex(idx: number, year: number) {
  return monthsOfYear(year)[idx];
}

export { gematriya };
