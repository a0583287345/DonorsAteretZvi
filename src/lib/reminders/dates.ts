// =====================================================================
// עבודה עם תאריכים כמחרוזת 'YYYY-MM-DD' (בלי שעות ובלי בעיות אזור זמן)
// =====================================================================

/** מחרוזת 'YYYY-MM-DD' → Date מקומי בחצות */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' לפי השעון המקומי */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** מספר הימים מ-a עד b (חיובי אם b אחרי a) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function daysInGregorianMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** תאריך לועזי בעברית, למשל "15.11.2026" */
export function formatGregorian(iso: string | null | undefined): string {
  if (!iso) return '-';
  return parseISO(iso).toLocaleDateString('he-IL');
}

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function weekdayName(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()];
}
