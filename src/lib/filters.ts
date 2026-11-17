// =====================================================================
// סינון רב-בחירה – לוגיקה משותפת לתורמים ולתרומות (קוד טהור)
// ערך נבחר יכול להיות:
//   ערך מדויק מהרשימה        – "אשדוד"
//   "מכיל" (טקסט חופשי)      – "~054"   (מתחיל ב-~)
//   "ללא ערך"                – EMPTY_TOKEN
// =====================================================================

export const EMPTY_TOKEN = '__empty__';
export const CONTAINS_PREFIX = '~';

export type FilterOption = { value: string; label: string; count: number };
export type YesNoAll = 'all' | 'yes' | 'no';

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const digits = (v: string) => v.replace(/\D/g, '');

export const isContainsToken = (token: string) => token.startsWith(CONTAINS_PREFIX);

/** תווית לתצוגה של ערך שנבחר */
export function tokenLabel(token: string, options: FilterOption[]): string {
  if (token === EMPTY_TOKEN) return '(ללא)';
  if (isContainsToken(token)) return `מכיל: ${token.slice(1)}`;
  return options.find((o) => o.value === token)?.label ?? token;
}

/**
 * האם הרשומה עוברת את הסינון.
 * `values` – כל הערכים של הרשומה בשדה הזה (למשל טלפון 1 וטלפון 2).
 * בלי בחירה – הכל עובר. כמה בחירות – מספיק שאחת מתאימה ("או").
 */
export function matchesTokens(selected: string[], values: (string | null | undefined)[]): boolean {
  if (selected.length === 0) return true;
  const present = values.map((v) => (v ?? '').trim()).filter(Boolean);

  return selected.some((token) => {
    if (token === EMPTY_TOKEN) return present.length === 0;
    if (isContainsToken(token)) {
      const q = norm(token.slice(1));
      if (!q) return true;
      // טלפון / ת"ז: משווים רק ספרות, כך ש-"0541234" מוצא גם "054-1234"
      const qDigits = /^[\d\s\-+()]+$/.test(q) ? digits(q) : '';
      return present.some((v) => norm(v).includes(q) || (qDigits !== '' && digits(v).includes(qDigits)));
    }
    return present.includes(token);
  });
}

/**
 * רשימת האפשרויות לשדה, עם מספר הרשומות לכל ערך.
 * `valuesOf` מחזיר את ערכי הרשומה (אחד או יותר). ערך ריק נספר תחת "(ללא)".
 */
export function buildOptions<T>(
  records: T[],
  valuesOf: (record: T) => (string | null | undefined)[],
  labelOf: (value: string) => string = (v) => v
): FilterOption[] {
  const counts = new Map<string, number>();
  let empty = 0;
  for (const record of records) {
    const values = Array.from(new Set(valuesOf(record).map((v) => (v ?? '').trim()).filter(Boolean)));
    if (values.length === 0) empty += 1;
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const options = Array.from(counts, ([value, count]) => ({ value, label: labelOf(value), count })).sort((a, b) =>
    a.label.localeCompare(b.label, 'he')
  );
  if (empty > 0) options.push({ value: EMPTY_TOKEN, label: '(ללא)', count: empty });
  return options;
}

export const matchesYesNo = (filter: YesNoAll | string, value: boolean) =>
  filter === 'all' || filter === '' || (filter === 'yes') === value;

/** טווח תאריכים ('YYYY-MM-DD'). ריק = בלי גבול. רשומה בלי תאריך לא עוברת טווח פעיל */
export function inDateRange(date: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = date?.slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** טווח מספרים (מחרוזות מהטופס). ריק / לא מספר = בלי גבול */
export function inNumberRange(value: number, min: string, max: string): boolean {
  const lo = min.trim() === '' ? NaN : Number(min);
  const hi = max.trim() === '' ? NaN : Number(max);
  if (Number.isFinite(lo) && value < lo) return false;
  if (Number.isFinite(hi) && value > hi) return false;
  return true;
}
