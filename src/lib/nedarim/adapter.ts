// =====================================================================
// נדרים פלוס – המקום היחיד שמכיר את שמות השדות וה-API שלהם.
//
// ⚠️ נכתב לפי התיעוד שמתפרסם ברשת (לא התיעוד הרשמי שמאחורי הכניסה למערכת).
//    כשתהיה גישה לתיעוד הרשמי – לבדוק כאן: כתובת, שמות פעולות, שמות שדות,
//    קודי מטבע ופורמט תאריך. שאר המערכת לא תלויה בפרטים האלה.
//
// API:      POST https://matara.pro/nedarimplus/Reports/Manage3.aspx
//           Action=GetHistoryJson (עסקאות, עימוד לפי LastId) / GetKevaNew (הוראות קבע)
//           MosadId=<מספר מוסד>, ApiPassword=<סיסמת API>
// Callback: נדרים שולחים POST לכל עסקה חדשה (JSON או טופס) – אותם שדות כמו בהיסטוריה.
// =====================================================================

import type { IncomingDonor } from '@/lib/import/donorMatch';
import { normalizeEmail, normalizePhone, normalizeZeout, splitFullName } from '@/lib/import/donorMatch';

export const NEDARIM_SOURCE = 'nedarim';
const API_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
/** כמה עסקאות לבקש בכל קריאה */
export const HISTORY_PAGE_SIZE = 500;

export type RawRecord = Record<string, unknown>;

/** תרומה בפורמט שלנו (לפני שיוך לתורם) */
export type ParsedDonation = {
  externalId: string;
  amount: number;
  currency: string;
  /** YYYY-MM-DD */
  date: string | null;
  installments: number | null;
  category: string | null;
  paymentMethod: string;
  notes: string | null;
  /** מספר הוראת הקבע אם החיוב שייך להוראת קבע */
  recurringExternalId: string | null;
  receiptNumber: string | null;
};

export type ParsedTransaction = { donor: IncomingDonor; donation: ParsedDonation };

export type ParsedRecurring = {
  externalId: string;
  donor: IncomingDonor;
  amount: number;
  currency: string;
  chargeDay: number | null;
  monthsTotal: number | null;
  monthsRemaining: number | null;
  nextChargeDate: string | null;
  status: 'active' | 'failed' | 'ended' | 'frozen';
  paymentMethod: string;
  notes: string | null;
};

// ---------------------------------------------------------------------
// קריאת שדות – סובלני לשמות שונים ולאותיות גדולות/קטנות
// ---------------------------------------------------------------------

function pick(raw: RawRecord, names: string[]): string | null {
  const lower = new Map(Object.keys(raw).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const key = lower.get(n.toLowerCase());
    if (key === undefined) continue;
    const v = raw[key];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== '' && s.toLowerCase() !== 'null') return s;
  }
  return null;
}

function toNumber(s: string | null): number | null {
  if (s === null) return null;
  const n = Number(s.replace(/[,₪$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** קוד מטבע של נדרים → ISO. 1 = שקל, 2 = דולר */
export function parseCurrency(s: string | null): string {
  const v = (s ?? '').trim().toUpperCase();
  if (v === '2' || v === 'USD' || v === '$') return 'USD';
  if (v === 'EUR' || v === '3') return 'EUR';
  return 'ILS';
}

/** תאריך מנדרים ("dd/MM/yyyy HH:mm:ss" או ISO) → YYYY-MM-DD */
export function parseDate(s: string | null): string | null {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const il = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (il) {
    const year = il[3].length === 2 ? `20${il[3]}` : il[3];
    return `${year}-${il[2].padStart(2, '0')}-${il[1].padStart(2, '0')}`;
  }
  return null;
}

function parseDonor(raw: RawRecord): IncomingDonor {
  const fullName = pick(raw, ['ClientName', 'Name', 'FullName']);
  const first = pick(raw, ['FirstName', 'PrivateName']);
  const last = pick(raw, ['LastName', 'FamilyName']);
  const split = first || last ? { first, last } : splitFullName(fullName);
  return {
    full_name: fullName ?? ([first, last].filter(Boolean).join(' ') || null),
    first_name: split.first,
    last_name: split.last,
    zeout: normalizeZeout(pick(raw, ['Zeout', 'Zehut', 'TZ', 'ID_Number'])),
    phone: normalizePhone(pick(raw, ['Phone', 'Tel', 'Mobile', 'Phone1'])),
    email: normalizeEmail(pick(raw, ['Mail', 'Email', 'EMail'])),
    // נדרים שולחים כתובת בשדה אחד – שומרים אותה ב"רחוב"
    street: pick(raw, ['Adresse', 'Address', 'Street']),
    city: pick(raw, ['City', 'Ir']),
    house_number: null,
    country: null,
  };
}

/** עסקה (מהיסטוריה או מ-Callback). מחזיר null אם אין מספר עסקה או סכום */
export function parseTransaction(raw: RawRecord): ParsedTransaction | null {
  const externalId = pick(raw, ['TransactionId', 'TransactionID', 'Id', 'ID']);
  const amount = toNumber(pick(raw, ['Amount', 'Sum', 'Total']));
  if (!externalId || amount === null) return null;

  const type = pick(raw, ['TransactionType', 'Type']);
  const kevaId = pick(raw, ['KevaId', 'KevaID']);
  const installments = toNumber(pick(raw, ['Tashloumim', 'Payments']));
  const lastNum = pick(raw, ['LastNum', 'Last4']);
  const confirmation = pick(raw, ['Confirmation']);

  const notesParts = [
    pick(raw, ['Comments', 'Comment', 'Notes']),
    type ? `סוג עסקה: ${type}` : null,
    lastNum ? `כרטיס: ****${lastNum}` : null,
    confirmation ? `אישור: ${confirmation}` : null,
  ].filter(Boolean);

  return {
    donor: parseDonor(raw),
    donation: {
      externalId,
      amount,
      currency: parseCurrency(pick(raw, ['Currency'])),
      date: parseDate(pick(raw, ['TransactionTime', 'TransactionDate', 'Date', 'Time'])),
      installments: installments && installments > 1 ? Math.round(installments) : null,
      category: pick(raw, ['Groupe', 'Group', 'Category']),
      // קוד אמצעי תשלום כמו בשאר המערכת (PAYMENT_METHOD_LABELS). המקור מסומן ב-external_source
      paymentMethod: /בנק|bank|מס"ב|masav/i.test(type ?? '') ? 'bank_transfer_israel' : 'credit_card',
      notes: notesParts.length ? `נדרים פלוס – ${notesParts.join(' | ')}` : 'נדרים פלוס',
      recurringExternalId: kevaId,
      receiptNumber: pick(raw, ['ReceiptDocNum', 'ReceiptNumber']),
    },
  };
}

/** הוראת קבע */
export function parseRecurring(raw: RawRecord): ParsedRecurring | null {
  const externalId = pick(raw, ['KevaId', 'KevaID', 'Id', 'ID']);
  const amount = toNumber(pick(raw, ['Amount', 'Sum']));
  if (!externalId || amount === null) return null;

  const total = toNumber(pick(raw, ['Tashloumim', 'TotalPayments', 'NumPayments']));
  const done = toNumber(pick(raw, ['Itra', 'PaymentsDone', 'Bitsua', 'SuccessCount']));
  const remainingRaw = toNumber(pick(raw, ['Remaining', 'PaymentsLeft']));
  const monthsTotal = total && total > 0 ? Math.round(total) : null;
  const monthsRemaining =
    remainingRaw !== null ? Math.max(0, Math.round(remainingRaw)) : monthsTotal !== null && done !== null ? Math.max(0, monthsTotal - Math.round(done)) : null;

  const statusText = (pick(raw, ['Status', 'KevaStatus', 'Enabled']) ?? '').toLowerCase();
  let status: ParsedRecurring['status'] = 'active';
  if (/frozen|הוקפא|מוקפא|השהי/.test(statusText)) status = 'frozen';
  else if (/fail|שגיא|נכשל|error/.test(statusText)) status = 'failed';
  else if (/end|cancel|בוטל|הסתיים|false|^0$|disabled|לא פעיל/.test(statusText)) status = 'ended';
  if (monthsRemaining === 0) status = 'ended';

  const day = toNumber(pick(raw, ['Day', 'ChargeDay', 'KevaDay']));
  const lastNum = pick(raw, ['LastNum', 'Last4']);
  const notesParts = [pick(raw, ['Comments', 'Comment', 'Groupe']), lastNum ? `כרטיס: ****${lastNum}` : null].filter(Boolean);

  return {
    externalId,
    donor: parseDonor(raw),
    amount,
    currency: parseCurrency(pick(raw, ['Currency'])),
    chargeDay: day && day >= 1 && day <= 31 ? Math.round(day) : null,
    monthsTotal,
    monthsRemaining,
    nextChargeDate: parseDate(pick(raw, ['NextDate', 'NextCharge', 'NextChargeDate'])),
    status,
    paymentMethod: /בנק|bank|מס"ב|masav/i.test(pick(raw, ['KevaType', 'Type', 'PaymentType']) ?? '') ? 'bank_transfer_israel' : 'credit_card',
    notes: notesParts.length ? notesParts.join(' | ') : null,
  };
}

/** מזהה העסקה הגבוה ביותר ברשימה – נקודת ההמשך לקריאה הבאה */
export function maxTransactionId(rows: RawRecord[], current: string | null): string | null {
  let best = current;
  for (const r of rows) {
    const id = pick(r, ['TransactionId', 'TransactionID', 'Id', 'ID']);
    if (!id) continue;
    if (best === null || Number(id) > Number(best)) best = id;
  }
  return best;
}

/** גוף Callback יכול להגיע כ-JSON או כטופס */
export function parseCallbackBody(text: string, contentType: string | null): RawRecord | null {
  const t = text.trim();
  if (!t) return null;
  if ((contentType ?? '').includes('json') || t.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(t);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as RawRecord) : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(t));
}

// ---------------------------------------------------------------------
// קריאות ל-API (צד שרת בלבד – הסיסמה לא יוצאת מהשרת)
// ---------------------------------------------------------------------

export type NedarimCredentials = { mosadId: string; apiPassword: string };

async function callApi(creds: NedarimCredentials, params: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams({ MosadId: creds.mosadId, ApiPassword: creds.apiPassword, ...params });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`נדרים פלוס החזירו שגיאה ${res.status}`);
  try {
    return JSON.parse(text);
  } catch {
    // תשובת שגיאה בטקסט (סיסמה שגויה, חריגה ממכסת קריאות וכו')
    throw new Error(`תשובה לא צפויה מנדרים פלוס: ${text.slice(0, 200)}`);
  }
}

function asRows(data: unknown): RawRecord[] {
  if (Array.isArray(data)) return data.filter((r): r is RawRecord => !!r && typeof r === 'object');
  if (data && typeof data === 'object') {
    const obj = data as RawRecord;
    // שגיאה בפורמט {Result:"Error", Message:"..."}
    const result = pick(obj, ['Result', 'Status']);
    if (result && /error|שגיאה/i.test(result)) {
      throw new Error(`נדרים פלוס: ${pick(obj, ['Message', 'Error']) ?? result}`);
    }
    for (const v of Object.values(obj)) if (Array.isArray(v)) return asRows(v);
  }
  return [];
}

/** עסקאות שמספרן גדול מ-lastId (null = מההתחלה) */
export async function fetchHistory(creds: NedarimCredentials, lastId: string | null): Promise<RawRecord[]> {
  const data = await callApi(creds, {
    Action: 'GetHistoryJson',
    LastId: lastId ?? '0',
    MaxId: String(HISTORY_PAGE_SIZE),
  });
  return asRows(data);
}

/** כל הוראות הקבע של המוסד */
export async function fetchRecurring(creds: NedarimCredentials): Promise<RawRecord[]> {
  return asRows(await callApi(creds, { Action: 'GetKevaNew' }));
}
