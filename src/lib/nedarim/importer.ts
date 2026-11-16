// =====================================================================
// ייבוא מנדרים פלוס – צד שרת בלבד (service_role). אסור לייבא לקוד 'use client'.
//
// כל עסקה / הוראת קבע:
//   1. כבר קיימת במערכת (לפי מספר העסקה)  → מדלגים (לא נכנס פעמיים)
//   2. שייכת להוראת קבע מוכרת              → לתורם של הוראת הקבע
//   3. התאמה בטוחה (ת"ז / טלפון / מייל)    → לתורם הקיים (+ משלים לו שדות חסרים)
//   4. אין שום פרט מזהה (רק סכום)          → תרומה ללא תורם (לא פותחים כרטיס)
//   5. לא ברור                             → תור "לבדיקה" (import_review)
//   6. אין שום התאמה                       → תורם חדש
// =====================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Json, TablesInsert } from '@/types/database';
import {
  addToIndex,
  buildDonorIndex,
  hasIdentifyingDetails,
  IMPORT_PLACEHOLDER_NAME,
  matchIncomingDonor,
  normalizePhone,
  type DonorIndex,
  type DonorKeys,
  type IncomingDonor,
} from '@/lib/import/donorMatch';
import {
  NEDARIM_SOURCE,
  PAGE_SIZE,
  fetchAllRecurring,
  fetchHistory,
  maxId,
  parseRefusal,
  type RawRecord,
  parseRecurring,
  parseTransaction,
  type ParsedDonation,
  type ParsedRecurring,
} from './adapter';

/**
 * old = לפני תאריך ההתחלה של הייבוא (או הוראת קבע שהסתיימה) – לא נשמר
 * no_donor = נשמר בלי תורם (בנדרים אין שום פרט מזהה – רק סכום)
 */
export type ImportOutcome = 'imported' | 'new_donor' | 'no_donor' | 'review' | 'skipped' | 'invalid' | 'updated' | 'old';

export type ImportCounts = Record<ImportOutcome, number> & { errors: string[] };

export const emptyCounts = (): ImportCounts => ({
  imported: 0,
  new_donor: 0,
  no_donor: 0,
  review: 0,
  skipped: 0,
  invalid: 0,
  updated: 0,
  old: 0,
  errors: [],
});

const DONOR_KEY_COLUMNS = 'id, first_name_he, last_name_he, first_name_en, last_name_en, zeout, phone_1, phone_2, email';

export async function loadDonorIndex(): Promise<DonorIndex> {
  const { data, error } = await supabaseAdmin.from('donors').select(DONOR_KEY_COLUMNS);
  if (error) throw new Error(error.message);
  return buildDonorIndex((data ?? []) as DonorKeys[]);
}

const isUniqueViolation = (e: { code?: string } | null) => e?.code === '23505';

// ---------------------------------------------------------------------
// תורמים
// ---------------------------------------------------------------------

const hasHebrew = (s: string | null) => !!s && /[֐-׿]/.test(s);

/** יצירת תורם חדש מנתונים מיובאים */
export async function createDonorFromIncoming(
  incoming: IncomingDonor,
  extra: { isRecurring?: boolean } = {},
  index?: DonorIndex
): Promise<string> {
  const realFirst = incoming.first_name ?? incoming.full_name;
  // בלי שם בכלל – השם הזמני נשמר בעברית (קודם נשמר בטעות בשדות האנגלית)
  const english =
    !!realFirst && !hasHebrew(incoming.full_name) && !hasHebrew(incoming.first_name) && !hasHebrew(incoming.last_name);
  const first = realFirst ?? IMPORT_PLACEHOLDER_NAME;
  const row: TablesInsert<'donors'> = {
    first_name_he: english ? null : first,
    last_name_he: english ? null : incoming.last_name,
    first_name_en: english ? first : null,
    last_name_en: english ? incoming.last_name : null,
    zeout: incoming.zeout,
    phone_1: incoming.phone,
    email: incoming.email,
    street: incoming.street,
    city: incoming.city,
    house_number: incoming.house_number,
    country: incoming.country,
    is_recurring: extra.isRecurring ?? false,
    notes: 'נוצר אוטומטית בייבוא מנדרים פלוס',
  };
  const { data, error } = await supabaseAdmin.from('donors').insert(row).select(DONOR_KEY_COLUMNS).single();
  if (error || !data) throw new Error(error?.message ?? 'יצירת תורם נכשלה');
  if (index) addToIndex(index, data as DonorKeys);
  return data.id;
}

/** משלים לתורם קיים שדות ריקים (ת"ז, טלפון, מייל, כתובת) – לא דורס נתונים קיימים */
export async function fillMissingDonorFields(donorId: string, incoming: IncomingDonor, index?: DonorIndex) {
  const { data: d } = await supabaseAdmin
    .from('donors')
    .select('zeout, phone_1, phone_2, email, street, city')
    .eq('id', donorId)
    .maybeSingle();
  if (!d) return;

  const patch: { zeout?: string; email?: string; phone_1?: string; phone_2?: string; street?: string; city?: string } = {};
  if (!d.zeout && incoming.zeout) patch.zeout = incoming.zeout;
  if (!d.email && incoming.email) patch.email = incoming.email;
  if (incoming.phone) {
    const known = [normalizePhone(d.phone_1), normalizePhone(d.phone_2)];
    if (!known.includes(incoming.phone)) {
      if (!d.phone_1) patch.phone_1 = incoming.phone;
      else if (!d.phone_2) patch.phone_2 = incoming.phone;
    }
  }
  if (!d.street && !d.city) {
    if (incoming.street) patch.street = incoming.street;
    if (incoming.city) patch.city = incoming.city;
  }
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabaseAdmin.from('donors').update(patch).eq('id', donorId);
  if (!error && index) {
    const current = index.byId.get(donorId);
    if (current) addToIndex(index, { ...current, ...patch });
  }
}

// ---------------------------------------------------------------------
// כתיבת תרומה / הוראת קבע לתורם
// ---------------------------------------------------------------------

/** מוסיף תרומה לתורם (null = תרומה ללא תורם). 'skipped' אם העסקה כבר קיימת */
export async function insertDonation(donorId: string | null, d: ParsedDonation): Promise<'imported' | 'skipped'> {
  const row: TablesInsert<'donations'> = {
    donor_id: donorId,
    amount: d.amount,
    currency: d.currency,
    payment_method: d.paymentMethod,
    donation_date: d.date,
    receipt_number: d.receiptNumber,
    notes: d.notes,
    external_source: NEDARIM_SOURCE,
    external_id: d.externalId,
    installments: d.installments,
    category: d.category,
    recurring_external_id: d.recurringExternalId,
    imported_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('donations').insert(row);
  if (isUniqueViolation(error)) return 'skipped';
  if (error) throw new Error(error.message);
  return 'imported';
}

/** יוצר או מעדכן הוראת קבע. התורם נקבע רק ביצירה (לא משנים שיוך קיים) */
export async function upsertRecurring(donorId: string | null, r: ParsedRecurring): Promise<'imported' | 'updated'> {
  const now = new Date().toISOString();
  const fields = {
    amount: r.amount,
    currency: r.currency,
    charge_day: r.chargeDay,
    months_total: r.monthsTotal,
    months_remaining: r.monthsRemaining,
    next_charge_date: r.nextChargeDate,
    status: r.status,
    payment_method: r.paymentMethod,
    last_synced_at: now,
    updated_at: now,
  };

  const { data: existing } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, donor_id')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', r.externalId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from('recurring_donations')
      .update({ ...fields, donor_id: existing.donor_id ?? donorId })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return 'updated';
  }

  const { error } = await supabaseAdmin.from('recurring_donations').insert({
    ...fields,
    donor_id: donorId,
    external_source: NEDARIM_SOURCE,
    external_id: r.externalId,
    notes: r.notes,
  });
  if (error) throw new Error(error.message);
  if (donorId && r.status === 'active') {
    await supabaseAdmin.from('donors').update({ is_recurring: true }).eq('id', donorId);
  }
  return 'imported';
}

// ---------------------------------------------------------------------
// תור "לבדיקה"
// ---------------------------------------------------------------------

export const reviewExternalId = (kind: 'donation' | 'recurring', id: string) => `${kind}:${id}`;

async function addToReview(
  kind: 'donation' | 'recurring',
  externalId: string,
  donor: IncomingDonor,
  payload: ParsedDonation | ParsedRecurring,
  candidates: string[],
  reason: string
) {
  const { error } = await supabaseAdmin.from('import_review').insert({
    source: NEDARIM_SOURCE,
    external_id: reviewExternalId(kind, externalId),
    incoming_donor: donor as unknown as Json,
    incoming_payload: payload as unknown as Json,
    payload_kind: kind,
    candidate_donor_ids: candidates,
    reason,
  });
  // כבר בתור (או טופל/סומן "להתעלם") – לא מוסיפים שוב
  if (error && !isUniqueViolation(error)) throw new Error(error.message);
}

async function alreadyInReview(kind: 'donation' | 'recurring', externalId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('import_review')
    .select('id')
    .eq('source', NEDARIM_SOURCE)
    .eq('external_id', reviewExternalId(kind, externalId))
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------
// ייבוא פריט בודד
// ---------------------------------------------------------------------

/**
 * מטמון לסנכרון גדול: מה כבר קיים במערכת נטען פעם אחת, במקום שאילתה לכל עסקה.
 * בעדכון בודד (Webhook) לא משתמשים בו.
 */
export type SyncCache = {
  donationIds: Set<string>;
  reviewIds: Set<string>;
  kevaDonor: Map<string, string | null>;
};

async function selectAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await fetchPage(from, from + 999);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) return all;
  }
}

export async function loadSyncCache(): Promise<SyncCache> {
  const [donations, reviews, recurring] = await Promise.all([
    selectAll((a, b) =>
      supabaseAdmin.from('donations').select('external_id').eq('external_source', NEDARIM_SOURCE).range(a, b)
    ),
    selectAll((a, b) => supabaseAdmin.from('import_review').select('external_id').eq('source', NEDARIM_SOURCE).range(a, b)),
    selectAll((a, b) =>
      supabaseAdmin.from('recurring_donations').select('external_id, donor_id').eq('external_source', NEDARIM_SOURCE).range(a, b)
    ),
  ]);
  return {
    donationIds: new Set(donations.map((d) => d.external_id).filter((x): x is string => !!x)),
    reviewIds: new Set(reviews.map((r) => r.external_id).filter((x): x is string => !!x)),
    kevaDonor: new Map(recurring.filter((r) => r.external_id).map((r) => [r.external_id as string, r.donor_id])),
  };
}

async function donorOfRecurring(kevaId: string | null, cache?: SyncCache): Promise<string | null> {
  if (!kevaId) return null;
  if (cache) return cache.kevaDonor.get(kevaId) ?? null;
  const { data } = await supabaseAdmin
    .from('recurring_donations')
    .select('donor_id')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', kevaId)
    .maybeSingle();
  return data?.donor_id ?? null;
}

/** חיוב מוצלח של הוראת קבע שסומנה "נכשלה" → חזרה לפעילה */
async function markRecurringRecovered(kevaId: string | null) {
  if (!kevaId) return;
  await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', kevaId)
    .eq('status', 'failed');
}

export async function importTransactionRecord(
  raw: RawRecord,
  index: DonorIndex,
  cache?: SyncCache,
  importFrom?: string | null
): Promise<ImportOutcome> {
  const parsed = parseTransaction(raw);
  if (!parsed) return 'invalid';
  const { donor, donation } = parsed;
  if (importFrom && donation.date && donation.date < importFrom) return 'old';

  if (cache) {
    if (cache.donationIds.has(donation.externalId) || cache.reviewIds.has(reviewExternalId('donation', donation.externalId))) {
      return 'skipped';
    }
    cache.donationIds.add(donation.externalId);
  } else {
    const { data: existing } = await supabaseAdmin
      .from('donations')
      .select('id')
      .eq('external_source', NEDARIM_SOURCE)
      .eq('external_id', donation.externalId)
      .maybeSingle();
    if (existing || (await alreadyInReview('donation', donation.externalId))) return 'skipped';
  }

  if (!cache && donation.amount > 0) await markRecurringRecovered(donation.recurringExternalId);

  const kevaDonor = await donorOfRecurring(donation.recurringExternalId, cache);
  if (kevaDonor) return insertDonation(kevaDonor, donation);

  // אין שם / ת"ז / טלפון / מייל / כתובת – תרומה ללא תורם, בלי כרטיס חדש
  if (!hasIdentifyingDetails(donor)) {
    return (await insertDonation(null, donation)) === 'imported' ? 'no_donor' : 'skipped';
  }

  const match = matchIncomingDonor(donor, index);
  if (match.kind === 'match') {
    await fillMissingDonorFields(match.donorId, donor, index);
    return insertDonation(match.donorId, donation);
  }
  if (match.kind === 'review') {
    await addToReview('donation', donation.externalId, donor, donation, match.candidates, match.reason);
    return 'review';
  }
  const donorId = await createDonorFromIncoming(donor, { isRecurring: !!donation.recurringExternalId }, index);
  await insertDonation(donorId, donation);
  return 'new_donor';
}

export async function importRecurringRecord(
  raw: RawRecord,
  index: DonorIndex,
  { skipEnded = false } = {}
): Promise<ImportOutcome> {
  const parsed = parseRecurring(raw);
  if (!parsed) return 'invalid';

  // כבר קיימת → רק עדכון סטטוס/סכום/חודשים
  const known = await supabaseAdmin
    .from('recurring_donations')
    .select('id')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', parsed.externalId)
    .maybeSingle();
  if (known.data) {
    await upsertRecurring(null, parsed);
    return 'updated';
  }
  // הוראה שהסתיימה ועוד לא מוכרת – היסטוריה, לא מייבאים
  if (skipEnded && parsed.status === 'ended') return 'old';
  if (await alreadyInReview('recurring', parsed.externalId)) return 'skipped';

  // הוראת קבע בלי שום פרט מזהה – נשמרת בלי תורם
  if (!hasIdentifyingDetails(parsed.donor)) {
    await upsertRecurring(null, parsed);
    return 'no_donor';
  }

  const match = matchIncomingDonor(parsed.donor, index);
  if (match.kind === 'match') {
    await fillMissingDonorFields(match.donorId, parsed.donor, index);
    await upsertRecurring(match.donorId, parsed);
    return 'imported';
  }
  if (match.kind === 'review') {
    await addToReview('recurring', parsed.externalId, parsed.donor, parsed, match.candidates, match.reason);
    return 'review';
  }
  const donorId = await createDonorFromIncoming(parsed.donor, { isRecurring: parsed.status === 'active' }, index);
  await upsertRecurring(donorId, parsed);
  return 'new_donor';
}

// ---------------------------------------------------------------------
// הגדרות וסנכרון מלא
// ---------------------------------------------------------------------

export type NedarimConfig = {
  enabled: boolean;
  mosadId: string | null;
  apiPassword: string | null;
  callbackKey: string | null;
  /** מפתח חתימת HMAC (whsec_) – כשמוגדר, כל עדכון חייב חתימה תקינה */
  webhookSecret: string | null;
  lastHistoryId: string | null;
  /** YYYY-MM-DD – עסקאות לפני התאריך לא מיובאות (null = הכול) */
  importFrom: string | null;
};

export async function getNedarimConfig(): Promise<NedarimConfig> {
  const [{ data: settings }, { data: secrets }] = await Promise.all([
    supabaseAdmin.from('integration_settings').select('*').eq('provider', NEDARIM_SOURCE).maybeSingle(),
    supabaseAdmin.from('integration_secrets').select('*').eq('provider', NEDARIM_SOURCE).maybeSingle(),
  ]);
  return {
    enabled: settings?.enabled ?? false,
    mosadId: settings?.mosad_id ?? null,
    apiPassword: secrets?.api_password ?? null,
    callbackKey: secrets?.callback_key ?? null,
    webhookSecret: secrets?.webhook_secret ?? null,
    lastHistoryId: settings?.last_history_id ?? null,
    importFrom: settings?.import_from ?? null,
  };
}

/** כמה דפי היסטוריה (2000 עסקאות כל אחד) עם ייבוא בפועל בהרצה אחת – זמן ריצה */
const MAX_PAGES_PER_RUN = 2;
/** כמה דפים לכל היותר בהרצה (כולל דפים ישנים שכולם מדולגים – מהירים) – מכסת 20 פניות בשעה */
const MAX_REQUESTS_PER_RUN = 8;

export type SyncSummary = {
  ok: boolean;
  skippedReason?: string;
  donations: ImportCounts;
  recurring: ImportCounts;
  lastHistoryId: string | null;
  morePending: boolean;
  error?: string;
};

function tally(counts: ImportCounts, outcome: ImportOutcome) {
  counts[outcome] += 1;
}

/** ייבוא עסקאות חדשות + עדכון הוראות קבע. force = גם כשהחיבור כבוי (הרצה ידנית) */
export async function runNedarimSync({ force = false } = {}): Promise<SyncSummary> {
  const cfg = await getNedarimConfig();
  const summary: SyncSummary = {
    ok: true,
    donations: emptyCounts(),
    recurring: emptyCounts(),
    lastHistoryId: cfg.lastHistoryId,
    morePending: false,
  };

  if (!cfg.enabled && !force) return { ...summary, skippedReason: 'החיבור כבוי' };
  if (!cfg.mosadId || !cfg.apiPassword) return { ...summary, ok: false, skippedReason: 'חסרים מספר מוסד או סיסמת API' };

  const creds = { mosadId: cfg.mosadId, apiPassword: cfg.apiPassword };
  const index = await loadDonorIndex();

  try {
    // הוראות קבע קודם – כדי שחיובים חודשיים ישויכו לתורם של ההוראה
    for (const raw of await fetchAllRecurring(creds)) {
      try {
        tally(summary.recurring, await importRecurringRecord(raw, index, { skipEnded: true }));
      } catch (e) {
        summary.recurring.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    // המטמון נטען אחרי הוראות הקבע – כדי לכלול את ההוראות שנוצרו עכשיו
    const cache = await loadSyncCache();
    let lastId = cfg.lastHistoryId;
    // דף שכל העסקאות בו לפני תאריך ההתחלה מדולג מהר – לא נספר כ"דף ייבוא"
    let importPages = 0;
    for (let request = 0; request < MAX_REQUESTS_PER_RUN && importPages < MAX_PAGES_PER_RUN; request++) {
      const rows = await fetchHistory(creds, lastId);
      let pageHadNew = false;
      for (const raw of rows) {
        try {
          const outcome = await importTransactionRecord(raw, index, cache, cfg.importFrom);
          tally(summary.donations, outcome);
          if (outcome !== 'old') pageHadNew = true;
        } catch (e) {
          summary.donations.errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (pageHadNew) importPages++;
      const next = maxId(rows, lastId, 'TransactionId');
      if (next !== lastId) {
        lastId = next;
        await supabaseAdmin.from('integration_settings').update({ last_history_id: lastId }).eq('provider', NEDARIM_SOURCE);
      }
      summary.lastHistoryId = lastId;
      if (rows.length < PAGE_SIZE || next === null) break;
      if (request === MAX_REQUESTS_PER_RUN - 1 || importPages >= MAX_PAGES_PER_RUN) summary.morePending = true;
    }
  } catch (e) {
    summary.ok = false;
    summary.error = e instanceof Error ? e.message : String(e);
  }

  // שומרים רק 20 שגיאות ראשונות
  summary.donations.errors = summary.donations.errors.slice(0, 20);
  summary.recurring.errors = summary.recurring.errors.slice(0, 20);

  await supabaseAdmin
    .from('integration_settings')
    .update({ last_sync_at: new Date().toISOString(), last_sync_result: summary as unknown as Json })
    .eq('provider', NEDARIM_SOURCE);

  return summary;
}

// ---------------------------------------------------------------------
// Webhook – עדכון בודד מנדרים פלוס
// ---------------------------------------------------------------------

/**
 * סירוב: כשל בחיוב הוראת קבע (ניסיון ראשון בחודש) → ההוראה מסומנת "נכשלה",
 * והטריגר במסד יוצר תזכורת "הוראת קבע נכשלה". סירוב של עסקה רגילה – לא נשמר.
 */
export async function applyRefusal(raw: RawRecord): Promise<ImportOutcome> {
  const refusal = parseRefusal(raw);
  if (!refusal.kevaId || !refusal.isFirstTry) return 'skipped';
  const { data: rec } = await supabaseAdmin
    .from('recurring_donations')
    .select('id, notes, status')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', refusal.kevaId)
    .maybeSingle();
  if (!rec) return 'skipped';

  const when = refusal.date ? `${refusal.date.slice(8, 10)}/${refusal.date.slice(5, 7)}/${refusal.date.slice(0, 4)}` : '';
  const note = `סירוב ${when}: ${refusal.message}`.trim();
  const notes = [note, ...(rec.notes ?? '').split(' | ').filter((p) => p && !p.startsWith('סירוב '))].join(' | ').slice(0, 1000);
  const { error } = await supabaseAdmin
    .from('recurring_donations')
    .update({ status: 'failed', notes, updated_at: new Date().toISOString() })
    .eq('id', rec.id);
  if (error) throw new Error(error.message);
  return 'updated';
}
