// =====================================================================
// הוראות קבע – חישובים (קוד טהור, תאריכים כמחרוזת YYYY-MM-DD)
//
// שני סוגים:
//   ידנית     – start_date (חיוב ראשון) + months_total (null = ללא הגבלה)
//   נדרים פלוס – next_charge_date + months_remaining (מתעדכנים בכל סנכרון)
// החיוב האחרון מחושב כאן באותה נוסחה כמו בפונקציה recurring_last_charge במסד
// (שקובעת את תאריך תזכורת החידוש – חודש לפני).
// =====================================================================

import type { Tables } from '@/types/database';

export type RecurringRow = Tables<'recurring_donations'>;
export type RecurringStatus = 'active' | 'failed' | 'ended' | 'frozen';

export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  active: 'פעילה',
  failed: 'נכשלה',
  frozen: 'מוקפאת',
  ended: 'הסתיימה',
};

export const RECURRING_STATUS_STYLES: Record<RecurringStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  frozen: 'bg-sky-50 text-sky-700 border-sky-200',
  ended: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** כמה ימים לפני הסיום הוראה נחשבת "מסתיימת בקרוב" */
export const ENDING_SOON_DAYS = 60;

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate(); // m: 1-12

/** הוספת חודשים לתאריך. יום שלא קיים בחודש היעד → היום האחרון בחודש */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  return { start: `${ym}-01`, end: `${ym}-${pad(daysInMonth(y, m))}` };
}

export const isManual = (r: RecurringRow) => !!r.start_date;

/** ללא הגבלת חודשים */
export function isUnlimited(r: RecurringRow): boolean {
  return isManual(r) ? !r.months_total : r.months_total == null && r.months_remaining == null;
}

/** תאריך החיוב האחרון (null = ללא הגבלה / לא ידוע) */
export function lastChargeDate(r: RecurringRow): string | null {
  if (r.start_date && r.months_total && r.months_total > 0) return addMonthsISO(r.start_date, r.months_total - 1);
  if (r.next_charge_date && r.months_remaining && r.months_remaining > 0) {
    return addMonthsISO(r.next_charge_date, r.months_remaining - 1);
  }
  return null;
}

/** תאריך תזכורת החידוש (חודש לפני החיוב האחרון) */
export function renewalDate(r: RecurringRow): string | null {
  const last = lastChargeDate(r);
  return last ? addMonthsISO(last, -1) : null;
}

/** כמה חיובים נשארו (כולל היום). null = ללא הגבלה */
export function remainingCharges(r: RecurringRow, today: string): number | null {
  if (r.start_date) {
    if (!r.months_total) return null;
    let passed = 0;
    while (passed < r.months_total && addMonthsISO(r.start_date, passed) < today) passed++;
    return r.months_total - passed;
  }
  return r.months_remaining ?? null;
}

/** החיוב הבא (מהיום והלאה). null = אין */
export function nextChargeDate(r: RecurringRow, today: string): string | null {
  if (r.status === 'ended') return null;
  if (r.start_date) {
    const remaining = remainingCharges(r, today);
    if (remaining === 0) return null;
    let k = 0;
    while (addMonthsISO(r.start_date, k) < today) k++;
    return addMonthsISO(r.start_date, k);
  }
  return r.next_charge_date;
}

/** יום החיוב בחודש */
export function chargeDay(r: RecurringRow): number | null {
  if (r.start_date) return Number(r.start_date.slice(8, 10));
  if (r.charge_day) return r.charge_day;
  if (r.next_charge_date) return Number(r.next_charge_date.slice(8, 10));
  return null;
}

/** האם צפוי חיוב בחודש (YYYY-MM) – לפי סטטוס פעיל, תחילה וסיום */
export function chargesInMonth(r: RecurringRow, ym: string): boolean {
  if (r.status !== 'active') return false;
  const { start, end } = monthBounds(ym);
  if (r.start_date && r.start_date > end) return false;
  const last = lastChargeDate(r);
  if (last && last < start) return false;
  if (!isUnlimited(r) && !last) return false;
  return true;
}

/** "מסתיימת בקרוב": פעילה והחיוב האחרון בתוך ENDING_SOON_DAYS ימים */
export function isEndingSoon(r: RecurringRow, today: string): boolean {
  if (r.status !== 'active') return false;
  const last = lastChargeDate(r);
  if (!last || last < today) return false;
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + ENDING_SOON_DAYS);
  return last <= `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`;
}

/** סכום לפי מטבע (לא מחברים מטבעות שונים) */
export function sumByCurrency<T>(items: T[], amount: (t: T) => number, currency: (t: T) => string | null | undefined) {
  const totals = new Map<string, number>();
  for (const it of items) {
    const c = currency(it) || 'ILS';
    totals.set(c, (totals.get(c) ?? 0) + Number(amount(it) || 0));
  }
  // שקל ראשון, אחר כך לפי סכום
  return [...totals.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => (a.currency === 'ILS' ? -1 : b.currency === 'ILS' ? 1 : b.total - a.total));
}
