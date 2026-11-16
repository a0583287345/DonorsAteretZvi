// =====================================================================
// נדרים פלוס – המקום היחיד שמכיר את שמות השדות וה-API שלהם. צד שרת בלבד.
// אומת מול התיעוד הרשמי: docs/NedarimPlus-API.md
//
// API (GET, פרמטרים בכתובת): https://matara.pro/nedarimplus/Reports/Manage3.aspx
//   MosadId + ApiPassword (npk_...) בכל פניה. תשובה: JSON עם Result/Status = OK/Error, או טקסט שגיאה.
//   GetHistoryJson – עסקאות אשראי, LastId (לא כולל) + MaxId (עד 2000). מוגבל ל-20 פניות בשעה!
//   GetKevaJson    – כל הוראות הקבע באשראי (לסנכרון), LastId + MaxId. מוגבל ל-20 פניות בשעה!
//   GetWebhook / SetWebhook / SetWebhookSecret – הגדרת כתובות העדכון והחתימה
//
// Webhook (POST, application/json) – שלושה סוגים לאותה כתובת שלנו:
//   עסקה מוצלחת (TransactionId) · הקמת הוראת קבע (KevaId, בלי TransactionId) · סירוב (Status=Error)
//   חתימה: X-Nedarim-Timestamp + X-Nedarim-Signature = v1=HMAC-SHA256(secret, ts + "." + rawBody)
//
// הערות מהתיעוד: Amount בעסקת תשלומים = הסכום המלא (שורה אחת). עסקה שבוטלה → Amount 0.
// זיכוי → שורה נפרדת עם סכום שלילי. מטבע: 1 שקל, 2 דולר. תאריכים dd/MM/yyyy.
// =====================================================================

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingDonor } from '@/lib/import/donorMatch';
import { normalizeEmail, normalizePhone, normalizeZeout, splitFullName } from '@/lib/import/donorMatch';

export const NEDARIM_SOURCE = 'nedarim';
const API_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
/** כמה רשומות לבקש בכל קריאה (המקסימום לפי התיעוד) */
export const PAGE_SIZE = 2000;

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

export type ParsedRefusal = {
  kevaId: string | null;
  /** בכשל הו"ק: האם זה הניסיון הראשון של החודש (ולא ניסיון חוזר) */
  isFirstTry: boolean;
  message: string;
  amount: number | null;
  currency: string;
  date: string | null;
  donor: IncomingDonor;
};

// ---------------------------------------------------------------------
// קריאת שדות – סובלני לאותיות גדולות/קטנות ולכמה כתיבים של אותו שדה
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

const hasKey = (raw: RawRecord, name: string) => Object.keys(raw).some((k) => k.toLowerCase() === name.toLowerCase());

function toNumber(s: string | null): number | null {
  if (s === null) return null;
  const n = Number(s.replace(/[,₪$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** מטבע של נדרים → ISO. 1 = שקל, 2 = דולר */
export function parseCurrency(s: string | null): string {
  const v = (s ?? '').trim().toUpperCase();
  if (v === '2' || v === 'USD' || v === '$') return 'USD';
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

/** אמצעי תשלום לפי הסולק (Solek): 27-29 ביט, 30 העברה בקליק, 31 מטבע דיגיטלי, אחרת אשראי */
function paymentMethodOf(raw: RawRecord): string {
  const solek = toNumber(pick(raw, ['Solek']));
  if (solek !== null && solek >= 27 && solek <= 29) return 'bit';
  if (solek === 30) return 'bank_transfer_israel';
  if (solek === 31) return 'other';
  return 'credit_card';
}

/** מסיר תגיות (<br/> בהודעות סירוב) */
const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function parseDonor(raw: RawRecord): IncomingDonor {
  const fullName = pick(raw, ['ClientName', 'KevaName']);
  const first = pick(raw, ['FirstName']);
  const last = pick(raw, ['LastName', 'FamilyName']);
  const split = first || last ? { first, last } : splitFullName(fullName);
  return {
    full_name: fullName ?? ([first, last].filter(Boolean).join(' ') || null),
    first_name: split.first,
    last_name: split.last,
    zeout: normalizeZeout(pick(raw, ['Zeout', 'KevaZeout', 'ClientZeout'])),
    phone: normalizePhone(pick(raw, ['Phone', 'KevaPhone', 'Phone1', 'ClientPhone'])),
    email: normalizeEmail(pick(raw, ['Mail', 'KevaMail', 'Email', 'ClientMail'])),
    // נדרים שולחים כתובת מלאה בשדה אחד – נשמרת ב"רחוב"
    street: pick(raw, ['Adresse', 'KevaAdresse', 'ClientAdresse', 'Address']),
    city: pick(raw, ['City', 'KevaCity']),
    house_number: null,
    country: null,
  };
}

// ---------------------------------------------------------------------
// עסקאות
// ---------------------------------------------------------------------

/** עסקה (מהיסטוריה או מ-Webhook). null = חסר מספר עסקה / סכום, או עסקה שבוטלה (סכום 0) */
export function parseTransaction(raw: RawRecord): ParsedTransaction | null {
  const externalId = pick(raw, ['TransactionId']);
  const amount = toNumber(pick(raw, ['Amount']));
  if (!externalId || amount === null || amount === 0) return null;

  const type = pick(raw, ['TransactionType']);
  const kevaId = pick(raw, ['KevaId']);
  const installments = toNumber(pick(raw, ['Tashloumim', 'Tashlumim']));
  const lastNum = pick(raw, ['LastNum']);
  const confirmation = pick(raw, ['Confirmation']);
  const comments = pick(raw, ['Comments', 'Comment', 'Avour']);
  const isRefund = amount < 0;

  const notesParts = [
    isRefund ? 'זיכוי' : null,
    comments,
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
      date: parseDate(pick(raw, ['TransactionTime'])),
      // חיוב הו"ק מחזיר תמיד Tashloumim=1 – רק עסקת תשלומים אמיתית נשמרת
      installments: !kevaId && installments && installments > 1 ? Math.round(installments) : null,
      category: pick(raw, ['Groupe']),
      paymentMethod: paymentMethodOf(raw),
      notes: `נדרים פלוס – ${notesParts.join(' | ') || 'עסקה'}`,
      recurringExternalId: kevaId,
      receiptNumber: pick(raw, ['ReceiptDocNum', 'KabalaId']),
    },
  };
}

/** מספר העסקה הגבוה ביותר ברשימה – נקודת ההמשך (LastId) לקריאה הבאה */
export function maxId(rows: RawRecord[], current: string | null, field: 'TransactionId' | 'KevaId'): string | null {
  let best = current;
  for (const r of rows) {
    const id = pick(r, [field]);
    if (!id) continue;
    if (best === null || Number(id) > Number(best)) best = id;
  }
  return best;
}

// ---------------------------------------------------------------------
// הוראות קבע
// ---------------------------------------------------------------------

/** "יתרת חיובים" גדולה מזה = בפועל ללא הגבלה */
const UNLIMITED_THRESHOLD = 999;

/**
 * הוראת קבע – משני מקורות:
 *   GetKevaJson: Itra (יתרת חיובים), Success (בוצעו), NextDate, Enabled, ErrorText
 *   Webhook הקמת הוראה: NextDate (חיוב ראשון), Tashloumim (מספר חודשים, ריק = ללא הגבלה)
 */
export function parseRecurring(raw: RawRecord): ParsedRecurring | null {
  const externalId = pick(raw, ['KevaId']);
  const amount = toNumber(pick(raw, ['Amount', 'KevaAmount']));
  if (!externalId || amount === null) return null;

  let monthsTotal: number | null;
  let monthsRemaining: number | null;
  if (hasKey(raw, 'Itra')) {
    const itra = toNumber(pick(raw, ['Itra']));
    const done = toNumber(pick(raw, ['Success'])) ?? 0;
    if (itra === null || itra >= UNLIMITED_THRESHOLD) {
      monthsTotal = null;
      monthsRemaining = null;
    } else {
      monthsRemaining = Math.max(0, Math.round(itra));
      monthsTotal = monthsRemaining + Math.max(0, Math.round(done));
    }
  } else {
    const months = toNumber(pick(raw, ['Tashloumim', 'Tashlumim']));
    monthsTotal = months && months > 0 && months < UNLIMITED_THRESHOLD ? Math.round(months) : null;
    monthsRemaining = monthsTotal;
  }

  const enabled = pick(raw, ['Enabled']);
  const errorText = pick(raw, ['ErrorText']);
  let status: ParsedRecurring['status'] = 'active';
  if (enabled === '0' || enabled?.toLowerCase() === 'false') status = 'ended';
  else if (errorText) status = 'failed';
  if (monthsRemaining === 0) status = 'ended';

  const next = parseDate(pick(raw, ['NextDate', 'KevaNextDate']));
  const lastNum = pick(raw, ['LastNum']);
  const notesParts = [
    pick(raw, ['Groupe']),
    pick(raw, ['Comments', 'Comment']),
    lastNum ? `כרטיס: ****${lastNum}` : null,
    errorText ? `שגיאה אחרונה: ${stripTags(errorText)}` : null,
  ].filter(Boolean);

  return {
    externalId,
    donor: parseDonor(raw),
    amount,
    currency: parseCurrency(pick(raw, ['Currency', 'KevaCurrency'])),
    chargeDay: next ? Number(next.slice(8, 10)) : null,
    monthsTotal,
    monthsRemaining,
    nextChargeDate: next,
    status,
    paymentMethod: 'credit_card',
    notes: notesParts.length ? notesParts.join(' | ') : null,
  };
}

// ---------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------

export type WebhookKind = 'transaction' | 'keva' | 'refusal' | 'unknown';

export function classifyWebhook(raw: RawRecord): WebhookKind {
  if ((pick(raw, ['Status']) ?? '').toLowerCase() === 'error') return 'refusal';
  if (pick(raw, ['TransactionId'])) return 'transaction';
  if (pick(raw, ['KevaId'])) return 'keva';
  return 'unknown';
}

export function parseRefusal(raw: RawRecord): ParsedRefusal {
  return {
    kevaId: pick(raw, ['KevaId']),
    isFirstTry: pick(raw, ['IsFirstKevaTry']) !== '0',
    message: stripTags(pick(raw, ['Message']) ?? 'סירוב'),
    amount: toNumber(pick(raw, ['Amount'])),
    currency: parseCurrency(pick(raw, ['Currency'])),
    date: parseDate(pick(raw, ['ErrorTime'])),
    donor: parseDonor(raw),
  };
}

/** גוף Webhook: JSON (לפי התיעוד). תמיכה גם בטופס, ליתר ביטחון */
export function parseWebhookBody(text: string, contentType: string | null): RawRecord | null {
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

/** מפתח חתימה חדש בפורמט שנדרים דורשים: whsec_ + 64 תווי הקסה */
export const generateWebhookSecret = () => `whsec_${randomBytes(32).toString('hex')}`;

/** בדיקת חתימת HMAC של Webhook. חלון זמן: 5 דקות */
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Date.now() / 1000
): boolean {
  const sig = (signatureHeader ?? '').replace(/^v1=/, '');
  if (!timestamp || !sig || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

// ---------------------------------------------------------------------
// קריאות ל-API (הסיסמה לא יוצאת מהשרת)
// ---------------------------------------------------------------------

export type NedarimCredentials = { mosadId: string; apiPassword: string };

async function callApi(creds: NedarimCredentials, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ MosadId: creds.mosadId, ApiPassword: creds.apiPassword, ...params });
  const res = await fetch(`${API_URL}?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`נדרים פלוס החזירו שגיאה ${res.status}`);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // לפי התיעוד: שגיאה יכולה לחזור כטקסט גם בפעולה שמוגדרת JSON
    throw new Error(`נדרים פלוס: ${stripTags(text).slice(0, 200) || 'תשובה ריקה'}`);
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as RawRecord;
    const result = pick(obj, ['Result', 'Status']);
    if (result && result.toLowerCase() === 'error') {
      const msg = pick(obj, ['Message']) ?? 'שגיאה';
      throw new Error(/TOO MANY REQUESTS/i.test(msg) ? 'נדרים פלוס: חריגה ממכסת 20 פניות בשעה – לנסות שוב מאוחר יותר' : `נדרים פלוס: ${msg}`);
    }
  }
  return data;
}

function asRows(data: unknown): RawRecord[] {
  if (Array.isArray(data)) return data.filter((r): r is RawRecord => !!r && typeof r === 'object');
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as RawRecord)) if (Array.isArray(v)) return asRows(v);
  }
  return [];
}

/** עסקאות שמספרן גדול מ-lastId (null = מהעסקה הראשונה) */
export async function fetchHistory(creds: NedarimCredentials, lastId: string | null): Promise<RawRecord[]> {
  const params: Record<string, string> = { Action: 'GetHistoryJson', MaxId: String(PAGE_SIZE) };
  if (lastId) params.LastId = lastId;
  return asRows(await callApi(creds, params));
}

/** כל הוראות הקבע באשראי (כולל לא פעילות), בעימוד. maxPages מגן על מכסת 20 הפניות בשעה */
export async function fetchAllRecurring(creds: NedarimCredentials, maxPages = 3): Promise<RawRecord[]> {
  const all: RawRecord[] = [];
  let lastId: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { Action: 'GetKevaJson', MaxId: String(PAGE_SIZE) };
    if (lastId) params.LastId = lastId;
    const rows = asRows(await callApi(creds, params));
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    const next = maxId(rows, lastId, 'KevaId');
    if (next === lastId) break;
    lastId = next;
  }
  return all;
}

export type WebhookType = 'Transaction' | 'Keva' | 'Siruv';

export type WebhookStatus = {
  transactionUrl: string;
  kevaUrl: string;
  refusalUrl: string;
  signatureEnabled: boolean;
  secretHint: string;
};

/** הכתובות שמוגדרות כרגע בנדרים פלוס (משמש גם כבדיקת חיבור – לא נספר במכסת ההיסטוריה) */
export async function getWebhooks(creds: NedarimCredentials): Promise<WebhookStatus> {
  const data = (await callApi(creds, { Action: 'GetWebhook' })) as RawRecord;
  return {
    transactionUrl: pick(data, ['CallBackUrl']) ?? '',
    kevaUrl: pick(data, ['CallBackKevaUrl']) ?? '',
    refusalUrl: pick(data, ['CallBackSiruvUrl']) ?? '',
    signatureEnabled: pick(data, ['SignatureEnabled']) === '1',
    secretHint: pick(data, ['SecretHint']) ?? '',
  };
}

/** הגדרת כתובת Webhook. בלי force – נכשל אם כבר מוגדרת כתובת אחרת (ומחזיר אותה ב-existing) */
export async function setWebhook(
  creds: NedarimCredentials,
  type: WebhookType,
  url: string,
  force: boolean
): Promise<{ ok: true } | { ok: false; existing: string | null; message: string }> {
  const query = new URLSearchParams({
    MosadId: creds.mosadId,
    ApiPassword: creds.apiPassword,
    Action: 'SetWebhook',
    Type: type,
    Url: url,
    ...(force ? { Force: '1' } : {}),
  });
  const res = await fetch(`${API_URL}?${query.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let data: RawRecord;
  try {
    data = JSON.parse(text) as RawRecord;
  } catch {
    return { ok: false, existing: null, message: stripTags(text).slice(0, 200) };
  }
  if ((pick(data, ['Result']) ?? '').toLowerCase() === 'ok') return { ok: true };
  return { ok: false, existing: pick(data, ['Existing']), message: pick(data, ['Message']) ?? 'שגיאה' };
}

export async function setWebhookSecret(creds: NedarimCredentials, secret: string): Promise<void> {
  await callApi(creds, { Action: 'SetWebhookSecret', Secret: secret });
}
