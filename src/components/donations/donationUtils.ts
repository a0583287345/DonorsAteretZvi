// =====================================================================
// עזרים לרשימת התרומות: תרגומים, עיצוב, ייצוא
// =====================================================================

export interface DonationDocument {
  id: string;
  donor_id: string | null;
  donation_id: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  created_at: string | null;
}

export type DonationSort =
  | 'created_desc'
  | 'created_asc'
  | 'date_desc'
  | 'date_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'donor_asc'
  | 'donor_desc';

/** אפשרויות המיון. בלי הרשאה לסכומים – בלי מיון לפי סכום */
export function getDonationSortOptions(canViewAmount: boolean): { value: DonationSort; label: string }[] {
  return [
    { value: 'date_desc', label: 'תאריך תרומה: מהחדש לישן' },
    { value: 'date_asc', label: 'תאריך תרומה: מהישן לחדש' },
    { value: 'created_desc', label: 'נוספה למערכת: מהחדש לישן' },
    { value: 'created_asc', label: 'נוספה למערכת: מהישן לחדש' },
    ...(canViewAmount
      ? [
          { value: 'amount_desc' as const, label: 'סכום: מהגבוה לנמוך' },
          { value: 'amount_asc' as const, label: 'סכום: מהנמוך לגבוה' },
        ]
      : []),
    { value: 'donor_asc', label: 'שם תורם: א → ת' },
    { value: 'donor_desc', label: 'שם תורם: ת → א' },
  ];
}

export type YesNoAll = 'all' | 'yes' | 'no';

// הערכים במסד הנתונים נשארים באנגלית
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: 'כרטיס אשראי',
  bank_transfer_israel: 'העברה בנקאית ישראל',
  bank_transfer_usa: 'העברה בנקאית ארה״ב',
  bank_transfer_panama: 'העברה בנקאית פנמה',
  bank_transfer_france: 'העברה בנקאית צרפת',
  bit: 'ביט (Bit)',
  paybox: 'פייבוקס (PayBox)',
  cash: 'מזומן',
  check: 'שיק',
  paypal: 'פייפאל',
  other: 'אחר',
};

export function getPaymentMethodLabel(paymentMethod: string | null | undefined) {
  if (!paymentMethod) return '-';
  return PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;
}

export function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('he-IL');
}

export function formatNumber(value: number) {
  return value.toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAmount(
  amount: number | null | undefined,
  currency: string | null | undefined
) {
  return `${formatNumber(Number(amount || 0))} ${currency || 'ILS'}`;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

/** הורדת קובץ CSV (עם BOM כדי שאקסל יציג עברית נכון) */
export function downloadCsv(fileName: string, headers: string[], rows: unknown[][]) {
  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
