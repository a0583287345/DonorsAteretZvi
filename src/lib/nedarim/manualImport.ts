// =====================================================================
// ייבוא ידני מנדרים פלוס (פאנל ניהול) – צד שרת בלבד.
//
// שני סוגים:
//   recurring    – הוראות הקבע (GetKevaJson): רק פעילות, או כל ההוראות מאז ומעולם (כולל שהסתיימו)
//   transactions – עסקאות (GetHistoryJson) בטווח תאריכים ולפי סוג: רגילה / תשלומים / חיוב הוראת קבע
//
// ל-GetHistoryJson אין סינון תאריך: קוראים דפים של 2000 מהעסקה הראשונה, מסננים אצלנו,
// ועוצרים כשהדף עבר את "עד תאריך". מוגבל ל-20 פניות בשעה – לכן עד MAX_REQUESTS בכל הרצה,
// ואם נשאר עוד – מחזירים nextLastId והמשתמש לוחץ "המשך".
//
// dryRun (תצוגה מקדימה) – אותה קריאה, בלי לכתוב כלום: כמה חדשות, כמה כבר קיימות, למי ישויכו.
// includeIgnored – גם פריטים שסומנו "לא לייבא" או שנמחקו ידנית מהמערכת (מוסר מהם הסימון).
// עסקה שכבר קיימת לא נכנסת פעמיים בשום מקרה.
// =====================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasIdentifyingDetails, matchIncomingDonor, type DonorIndex } from '@/lib/import/donorMatch';
import {
  NEDARIM_SOURCE,
  PAGE_SIZE,
  fetchAllRecurring,
  fetchHistory,
  maxId,
  parseRecurring,
  parseTransaction,
  type ParsedDonation,
} from './adapter';
import {
  emptyCounts,
  getNedarimConfig,
  importRecurringRecord,
  importTransactionRecord,
  loadDonorIndex,
  loadSyncCache,
  reviewExternalId,
  type ImportCounts,
} from './importer';

export type TransactionType = 'regular' | 'installments' | 'keva';
export const TRANSACTION_TYPES: TransactionType[] = ['regular', 'installments', 'keva'];

export type ManualImportOptions = {
  kind: 'recurring' | 'transactions';
  /** הוראות קבע: 'all' = כולל שהסתיימו / בוטלו */
  recurringScope: 'active' | 'all';
  /** עסקאות: YYYY-MM-DD או null = בלי גבול */
  from: string | null;
  to: string | null;
  /** עסקאות: אילו סוגים (ריק = הכל) */
  types: TransactionType[];
  includeIgnored: boolean;
  dryRun: boolean;
  /** המשך מהרצה קודמת (מספר העסקה האחרונה שנקראה) */
  startAfterId: string | null;
};

/** תוצאת תצוגה מקדימה – מה יקרה לכל פריט שעובר את הסינון */
export type PreviewCounts = {
  /** כבר קיימת במערכת – לא תיובא שוב */
  exists: number;
  /** סומנה "לא לייבא" / נמחקה ידנית – תדולג (אלא אם includeIgnored) */
  ignored: number;
  /** כבר ממתינה בתור "לבדיקה" */
  pendingReview: number;
  /** תיכנס לתורם קיים */
  match: number;
  /** ייפתח תורם חדש */
  newDonor: number;
  /** תישמר בלי תורם (אין פרטים מזהים) */
  noDonor: number;
  /** תעבור ל"בירור כפילויות" */
  review: number;
  /** הוראת קבע קיימת – יתעדכנו הסטטוס והחודשים */
  update: number;
  /** הוראת קבע שהסתיימה (לא מיובאת ב"רק פעילות") */
  ended: number;
};

const emptyPreview = (): PreviewCounts => ({
  exists: 0, ignored: 0, pendingReview: 0, match: 0, newDonor: 0, noDonor: 0, review: 0, update: 0, ended: 0,
});

export type ManualImportResult = {
  dryRun: boolean;
  kind: ManualImportOptions['kind'];
  /** כמה פריטים עברו את הסינון (תאריך + סוג) */
  matched: number;
  /** כמה עסקאות נקראו בסך הכל (כולל מחוץ לטווח) */
  scanned: number;
  preview: PreviewCounts | null;
  result: ImportCounts | null;
  /** פניות ל-API בהרצה הזו (מתוך 20 לשעה) */
  requests: number;
  /** null = הסתיים. אחרת – להריץ שוב עם startAfterId */
  nextLastId: string | null;
  /** התאריך של העסקה האחרונה שנקראה (להצגת התקדמות) */
  reachedDate: string | null;
};

/** כמה דפי היסטוריה בהרצה אחת – משאירים מקום במכסה לייבוא היומי */
const MAX_REQUESTS = 6;

export function transactionTypeOf(d: ParsedDonation): TransactionType {
  if (d.recurringExternalId) return 'keva';
  if (d.installments && d.installments > 1) return 'installments';
  return 'regular';
}

/** מצב כל פריט בתור הבדיקה (external_id → status) */
async function loadReviewStatuses(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('import_review')
      .select('external_id, status')
      .eq('source', NEDARIM_SOURCE)
      .range(from, from + 999);
    for (const r of data ?? []) if (r.external_id) map.set(r.external_id, r.status);
    if (!data || data.length < 1000) return map;
  }
}

/** מסיר סימון "לא לייבא" כדי שהפריט ייובא (רק בסטטוס ignored – לא נוגע בממתינים) */
async function clearIgnored(reviewId: string) {
  await supabaseAdmin
    .from('import_review')
    .delete()
    .eq('source', NEDARIM_SOURCE)
    .eq('external_id', reviewId)
    .eq('status', 'ignored');
}

/** למי תשויך תרומה / הוראה חדשה (בלי לכתוב) */
function previewDonor(
  donor: Parameters<typeof matchIncomingDonor>[0],
  index: DonorIndex,
  kevaDonor: string | null,
  counts: PreviewCounts
) {
  if (kevaDonor) counts.match += 1;
  else if (!hasIdentifyingDetails(donor)) counts.noDonor += 1;
  else {
    const m = matchIncomingDonor(donor, index);
    if (m.kind === 'match') counts.match += 1;
    else if (m.kind === 'review') counts.review += 1;
    else counts.newDonor += 1;
  }
}

/** מה מצב הפריט מול התור: null = אפשר לייבא */
function reviewBlock(
  status: string | undefined,
  includeIgnored: boolean
): 'ignored' | 'pendingReview' | 'exists' | null {
  if (!status) return null;
  if (status === 'ignored') return includeIgnored ? null : 'ignored';
  if (status === 'pending') return 'pendingReview';
  // linked / created – כבר טופל ויובא
  return 'exists';
}

// ---------------------------------------------------------------------

async function runRecurring(
  opts: ManualImportOptions,
  creds: { mosadId: string; apiPassword: string },
  index: DonorIndex
): Promise<ManualImportResult> {
  const rows = await fetchAllRecurring(creds, 5);
  // כל דף מלא (2000) גורר פניה נוספת
  const requests = Math.floor(rows.length / PAGE_SIZE) + 1;
  const reviews = await loadReviewStatuses();
  const known = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('recurring_donations')
      .select('external_id')
      .eq('external_source', NEDARIM_SOURCE)
      .range(from, from + 999);
    for (const r of data ?? []) if (r.external_id) known.add(r.external_id);
    if (!data || data.length < 1000) break;
  }

  const preview = opts.dryRun ? emptyPreview() : null;
  const result = opts.dryRun ? null : emptyCounts();
  let matched = 0;

  for (const raw of rows) {
    const parsed = parseRecurring(raw);
    if (!parsed) continue;
    matched += 1;
    const reviewId = reviewExternalId('recurring', parsed.externalId);

    if (preview) {
      if (known.has(parsed.externalId)) preview.update += 1;
      else if (opts.recurringScope === 'active' && parsed.status === 'ended') preview.ended += 1;
      else {
        const block = reviewBlock(reviews.get(reviewId), opts.includeIgnored);
        if (block) preview[block] += 1;
        else previewDonor(parsed.donor, index, null, preview);
      }
      continue;
    }

    try {
      if (opts.includeIgnored && reviews.get(reviewId) === 'ignored') await clearIgnored(reviewId);
      const outcome = await importRecurringRecord(raw, index, { skipEnded: opts.recurringScope === 'active' });
      result![outcome] += 1;
    } catch (e) {
      result!.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (result) result.errors = result.errors.slice(0, 20);
  return {
    dryRun: opts.dryRun,
    kind: 'recurring',
    matched,
    scanned: rows.length,
    preview,
    result,
    requests,
    nextLastId: null,
    reachedDate: null,
  };
}

async function runTransactions(
  opts: ManualImportOptions,
  creds: { mosadId: string; apiPassword: string },
  index: DonorIndex
): Promise<ManualImportResult> {
  const types = opts.types.length ? opts.types : TRANSACTION_TYPES;
  const [cache, reviews] = await Promise.all([loadSyncCache(), loadReviewStatuses()]);

  const preview = opts.dryRun ? emptyPreview() : null;
  const result = opts.dryRun ? null : emptyCounts();
  let matched = 0;
  let scanned = 0;
  let requests = 0;
  let lastId = opts.startAfterId;
  let reachedDate: string | null = null;
  let finished = false;

  while (requests < MAX_REQUESTS) {
    const rows = await fetchHistory(creds, lastId);
    requests += 1;
    scanned += rows.length;

    for (const raw of rows) {
      const parsed = parseTransaction(raw);
      if (!parsed) continue;
      const d = parsed.donation;
      if (d.date) reachedDate = d.date;
      if (opts.from && (!d.date || d.date < opts.from)) continue;
      if (opts.to && (!d.date || d.date > opts.to)) continue;
      if (!types.includes(transactionTypeOf(d))) continue;
      matched += 1;

      const reviewId = reviewExternalId('donation', d.externalId);
      if (preview) {
        if (cache.donationIds.has(d.externalId)) preview.exists += 1;
        else {
          const block = reviewBlock(reviews.get(reviewId), opts.includeIgnored);
          if (block) preview[block] += 1;
          else previewDonor(parsed.donor, index, d.recurringExternalId ? cache.kevaDonor.get(d.recurringExternalId) ?? null : null, preview);
        }
        continue;
      }

      try {
        if (opts.includeIgnored && reviews.get(reviewId) === 'ignored') {
          await clearIgnored(reviewId);
          cache.reviewIds.delete(reviewId);
        }
        result![await importTransactionRecord(raw, index, cache, null)] += 1;
      } catch (e) {
        result!.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    const next = maxId(rows, lastId, 'TransactionId');
    const pastEnd = !!opts.to && !!reachedDate && reachedDate > opts.to;
    if (rows.length < PAGE_SIZE || next === null || next === lastId || pastEnd) {
      finished = true;
      lastId = next;
      break;
    }
    lastId = next;
  }

  if (result) result.errors = result.errors.slice(0, 20);
  return {
    dryRun: opts.dryRun,
    kind: 'transactions',
    matched,
    scanned,
    preview,
    result,
    requests,
    nextLastId: finished ? null : lastId,
    reachedDate,
  };
}

export async function runManualImport(opts: ManualImportOptions): Promise<ManualImportResult> {
  const cfg = await getNedarimConfig();
  if (!cfg.mosadId || !cfg.apiPassword) throw new Error('יש לשמור קודם מספר מוסד וסיסמת API');
  const creds = { mosadId: cfg.mosadId, apiPassword: cfg.apiPassword };
  const index = await loadDonorIndex();
  return opts.kind === 'recurring' ? runRecurring(opts, creds, index) : runTransactions(opts, creds, index);
}

/** קלט מהדפדפן → אפשרויות תקינות (או הודעת שגיאה) */
export function parseManualImportOptions(body: Record<string, unknown>): ManualImportOptions | string {
  const kind = body.kind === 'recurring' ? 'recurring' : body.kind === 'transactions' ? 'transactions' : null;
  if (!kind) return 'סוג ייבוא לא תקין';
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = date(body.from);
  const to = date(body.to);
  if (from && to && from > to) return '"מתאריך" אחרי "עד תאריך"';
  const types = Array.isArray(body.types)
    ? body.types.filter((t): t is TransactionType => TRANSACTION_TYPES.includes(t as TransactionType))
    : [];
  const startAfterId = typeof body.startAfterId === 'string' && /^\d+$/.test(body.startAfterId) ? body.startAfterId : null;
  return {
    kind,
    recurringScope: body.recurringScope === 'all' ? 'all' : 'active',
    from,
    to,
    types,
    includeIgnored: body.includeIgnored === true,
    dryRun: body.dryRun !== false,
    startAfterId,
  };
}
