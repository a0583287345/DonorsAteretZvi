// =====================================================================
// ייבוא מאקסל – הגדרת העמודות (מקור יחיד).
// מכאן נבנים: התבנית הריקה, גיליון ההוראות, וקריאת הקובץ שהועלה.
// קוד טהור – בלי React ובלי Supabase.
// =====================================================================

import { PAYMENT_METHOD_LABELS } from '@/components/donations/donationUtils';
import { isValidZeout, normalizeEmail, normalizePhone, normalizeZeout } from './donorMatch';

export type SheetKind = 'donors' | 'donations';

export const SHEET_NAMES: Record<SheetKind, string> = { donors: 'תורמים', donations: 'תרומות' };
export const INSTRUCTIONS_SHEET = 'הוראות';

/** שדות התורם שאפשר לייבא */
export type DonorField =
  | 'first_name_he'
  | 'last_name_he'
  | 'first_name_en'
  | 'last_name_en'
  | 'zeout'
  | 'phone_1'
  | 'phone_2'
  | 'email'
  | 'country'
  | 'city'
  | 'street'
  | 'house_number'
  | 'connected_contact'
  | 'has_yissachar_zevulun'
  | 'yissachar_zevulun_name'
  | 'birthday'
  | 'notes';

export type DonationField = 'amount' | 'currency' | 'donation_date' | 'payment_method' | 'receipt_number' | 'category' | 'installments' | 'donation_notes';

export type FieldKind = 'text' | 'phone' | 'email' | 'zeout' | 'date' | 'yesno' | 'amount' | 'currency' | 'payment' | 'int';

export type ColumnDef<F extends string = string> = {
  field: F;
  /** כותרת העמודה בקובץ */
  header: string;
  kind: FieldKind;
  required?: boolean;
  /** הסבר לגיליון ההוראות */
  help: string;
  example: string;
  /** רוחב העמודה בתבנית (תווים) */
  width: number;
};

const donorIdentityHelp = 'לפחות אחד מ: שם, ת"ז, טלפון או מייל – כדי לזהות את התורם';

export const DONOR_COLUMNS: ColumnDef<DonorField>[] = [
  { field: 'first_name_he', header: 'שם פרטי', kind: 'text', help: donorIdentityHelp, example: 'משה', width: 14 },
  { field: 'last_name_he', header: 'שם משפחה', kind: 'text', help: 'שם המשפחה בעברית', example: 'כהן', width: 14 },
  { field: 'first_name_en', header: 'שם פרטי באנגלית', kind: 'text', help: 'לא חובה', example: 'Moshe', width: 16 },
  { field: 'last_name_en', header: 'שם משפחה באנגלית', kind: 'text', help: 'לא חובה', example: 'Cohen', width: 16 },
  { field: 'zeout', header: 'ת"ז', kind: 'zeout', help: '9 ספרות (אפשר בלי אפסים מובילים). הדרך הבטוחה ביותר לזהות תורם קיים', example: '012345674', width: 12 },
  { field: 'phone_1', header: 'טלפון', kind: 'phone', help: 'עם או בלי מקפים. מספר מחו"ל – עם + וקידומת המדינה', example: '050-1234567', width: 14 },
  { field: 'phone_2', header: 'טלפון נוסף', kind: 'phone', help: 'לא חובה', example: '', width: 14 },
  { field: 'email', header: 'מייל', kind: 'email', help: 'כתובת מייל תקינה', example: 'moshe@example.com', width: 24 },
  { field: 'country', header: 'מדינה', kind: 'text', help: 'למשל: ישראל, ארה"ב', example: 'ישראל', width: 10 },
  { field: 'city', header: 'עיר', kind: 'text', help: 'שם העיר', example: 'אשדוד', width: 12 },
  { field: 'street', header: 'רחוב', kind: 'text', help: 'שם הרחוב (בלי מספר)', example: 'הרצל', width: 14 },
  { field: 'house_number', header: 'מספר בית', kind: 'text', help: 'מספר בית / דירה', example: '12', width: 9 },
  { field: 'connected_contact', header: 'איש קשר', kind: 'text', help: 'מי בעמותה מכיר את התורם', example: '', width: 14 },
  { field: 'has_yissachar_zevulun', header: 'יששכר וזבולון', kind: 'yesno', help: 'כן / לא (ריק = לא)', example: 'לא', width: 12 },
  { field: 'yissachar_zevulun_name', header: 'שם האברך (יששכר וזבולון)', kind: 'text', help: 'רק אם יש יששכר וזבולון', example: '', width: 22 },
  { field: 'birthday', header: 'תאריך לידה', kind: 'date', help: 'יום/חודש/שנה – למשל 15/03/1970. יוצרת תזכורת יום הולדת אוטומטית', example: '15/03/1970', width: 12 },
  { field: 'notes', header: 'הערות', kind: 'text', help: 'טקסט חופשי', example: '', width: 24 },
];

/** בגיליון התרומות – רק השדות שמזהים את התורם (שאר פרטי התורם בגיליון "תורמים") */
export const DONATION_DONOR_FIELDS: DonorField[] = ['first_name_he', 'last_name_he', 'zeout', 'phone_1', 'email'];

export const DONATION_COLUMNS: ColumnDef<DonationField>[] = [
  { field: 'amount', header: 'סכום', kind: 'amount', required: true, help: 'חובה. מספר בלבד (בלי סימן מטבע). זיכוי = מספר שלילי', example: '180', width: 10 },
  { field: 'currency', header: 'מטבע', kind: 'currency', help: 'ILS / USD / EUR / GBP (או ₪, $, שקל, דולר). ריק = ILS', example: 'ILS', width: 8 },
  { field: 'donation_date', header: 'תאריך תרומה', kind: 'date', required: true, help: 'חובה. יום/חודש/שנה – למשל 01/09/2026', example: '01/09/2026', width: 12 },
  { field: 'payment_method', header: 'אמצעי תשלום', kind: 'payment', help: 'אחד מהרשימה למטה. ריק = אחר', example: 'כרטיס אשראי', width: 18 },
  { field: 'receipt_number', header: 'מספר קבלה', kind: 'text', help: 'לא חובה', example: '', width: 12 },
  { field: 'category', header: 'קטגוריה', kind: 'text', help: 'למשל: בניין, כללי', example: '', width: 12 },
  { field: 'installments', header: 'מספר תשלומים', kind: 'int', help: 'רק בעסקה בתשלומים – הסכום הוא הסכום המלא', example: '', width: 12 },
  { field: 'donation_notes', header: 'הערות לתרומה', kind: 'text', help: 'טקסט חופשי', example: '', width: 24 },
];

/** עמודות גיליון התרומות: פרטי זיהוי של התורם ואחריהם פרטי התרומה */
export const DONATION_SHEET_COLUMNS: ColumnDef[] = [
  ...DONOR_COLUMNS.filter((c) => DONATION_DONOR_FIELDS.includes(c.field)),
  ...DONATION_COLUMNS,
];

// ---------------------------------------------------------------------
// המרת ערכים מהקובץ
// ---------------------------------------------------------------------

export type ParsedValue = string | number | boolean | null;
export type ParseOutcome = { value: ParsedValue; error?: string; warning?: string };

const CURRENCY_ALIASES: Record<string, string> = {
  ILS: 'ILS', NIS: 'ILS', '₪': 'ILS', 'ש"ח': 'ILS', שח: 'ILS', שקל: 'ILS', שקלים: 'ILS',
  USD: 'USD', $: 'USD', דולר: 'USD', דולרים: 'USD',
  EUR: 'EUR', '€': 'EUR', יורו: 'EUR',
  GBP: 'GBP', '£': 'GBP', 'ליש"ט': 'GBP', פאונד: 'GBP',
};

/** תוויות אמצעי התשלום + כינויים נפוצים → הערך במסד */
const PAYMENT_ALIASES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => [label, value])),
  ...Object.fromEntries(Object.keys(PAYMENT_METHOD_LABELS).map((v) => [v, v])),
  אשראי: 'credit_card', 'כרטיס': 'credit_card',
  העברה: 'bank_transfer_israel', 'העברה בנקאית': 'bank_transfer_israel',
  ביט: 'bit', bit: 'bit', פייבוקס: 'paybox', paybox: 'paybox',
  "צ'ק": 'check', צק: 'check', 'שק': 'check', 'צ׳ק': 'check',
  פייפאל: 'paypal', paypal: 'paypal', מזומן: 'cash',
};

const YES = ['כן', 'v', '✓', '✔', 'yes', 'y', 'true', '1', 'x'];
const NO = ['לא', 'no', 'n', 'false', '0'];

const pad = (n: number) => String(n).padStart(2, '0');

/** תאריך מהקובץ (Date של אקסל, מספר סידורי או טקסט DD/MM/YYYY) → YYYY-MM-DD */
export function parseExcelDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  }
  if (typeof raw === 'number' && raw > 0 && raw < 100000) {
    // מספר סידורי של אקסל (ימים מ-30/12/1899)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(raw ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const il = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (il) {
    d = Number(il[1]);
    m = Number(il[2]);
    y = Number(il[3].length === 2 ? (Number(il[3]) > 50 ? `19${il[3]}` : `20${il[3]}`) : il[3]);
  } else return null;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** ערך של תא לפי סוג העמודה. ריק → null (בלי שגיאה, אלא אם חובה) */
export function parseCell(col: ColumnDef, raw: unknown): ParseOutcome {
  const text = raw instanceof Date ? '' : String(raw ?? '').trim();
  const empty = !(raw instanceof Date) && (raw === null || raw === undefined || text === '');
  if (empty) return { value: null, error: col.required ? `חסר ${col.header}` : undefined };

  switch (col.kind) {
    case 'text':
      return { value: text.slice(0, 1000) };
    case 'phone': {
      const p = text.startsWith('+') && !text.startsWith('+972') ? text.replace(/[^\d+]/g, '') : normalizePhone(text);
      return p ? { value: p } : { value: null, warning: `${col.header} לא תקין ("${text}") – לא ייובא` };
    }
    case 'email': {
      const e = normalizeEmail(text);
      return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
        ? { value: e }
        : { value: null, warning: `${col.header} לא תקין ("${text}") – לא ייובא` };
    }
    case 'zeout': {
      const z = normalizeZeout(text);
      if (!z) return { value: null, warning: `ת"ז לא תקינה ("${text}") – לא תיובא` };
      return isValidZeout(z) ? { value: z } : { value: z, warning: `ת"ז ${z} – ספרת ביקורת שגויה, כדאי לבדוק` };
    }
    case 'date': {
      const d = parseExcelDate(raw);
      if (d) return { value: d };
      const msg = `${col.header} לא תקין ("${text}") – צריך יום/חודש/שנה`;
      return col.required ? { value: null, error: msg } : { value: null, warning: `${msg}, לא ייובא` };
    }
    case 'yesno': {
      const t = text.toLowerCase();
      if (YES.includes(t)) return { value: true };
      if (NO.includes(t)) return { value: false };
      return { value: null, warning: `${col.header}: "${text}" – צריך כן / לא` };
    }
    case 'amount': {
      const n = typeof raw === 'number' ? raw : Number(text.replace(/[,₪$€£\s]/g, ''));
      if (!Number.isFinite(n) || n === 0) return { value: null, error: `${col.header} לא תקין ("${text}")` };
      return { value: Math.round(n * 100) / 100 };
    }
    case 'currency': {
      const c = CURRENCY_ALIASES[text.toUpperCase()] ?? CURRENCY_ALIASES[text];
      return c ? { value: c } : { value: 'ILS', warning: `מטבע לא מוכר ("${text}") – נשמר כ-ILS` };
    }
    case 'payment': {
      const p = PAYMENT_ALIASES[text] ?? PAYMENT_ALIASES[text.toLowerCase()];
      return p ? { value: p } : { value: 'other', warning: `אמצעי תשלום לא מוכר ("${text}") – נשמר כ"אחר"` };
    }
    case 'int': {
      const n = Number(text);
      return Number.isInteger(n) && n > 0 ? { value: n } : { value: null, warning: `${col.header} לא תקין ("${text}") – לא ייובא` };
    }
  }
}

/** כותרת → הגדרת עמודה (סובלני לרווחים, גרשיים וסימני * של חובה) */
export function matchHeader<C extends ColumnDef>(columns: C[], header: unknown): C | undefined {
  const norm = (s: string) => s.replace(/[*\s"'׳״]/g, '').toLowerCase();
  const h = norm(String(header ?? ''));
  if (!h) return undefined;
  return columns.find((c) => norm(c.header) === h);
}

export const PAYMENT_OPTIONS_TEXT = Object.values(PAYMENT_METHOD_LABELS).join(' / ');
