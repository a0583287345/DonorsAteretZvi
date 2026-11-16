// =====================================================================
// ייבוא מנדרים פלוס – צד שרת בלבד (service_role). אסור לייבא לקוד 'use client'.
//
// כל עסקה / הוראת קבע:
//   1. כבר קיימת במערכת (לפי מספר העסקה)  → מדלגים (לא נכנס פעמיים)
//   2. שייכת להוראת קבע מוכרת              → לתורם של הוראת הקבע
//   3. התאמה בטוחה (ת"ז / טלפון / מייל)    → לתורם הקיים (+ משלים לו שדות חסרים)
//   4. לא ברור                             → תור "לבדיקה" (import_review)
//   5. אין שום התאמה                       → תורם חדש
// =====================================================================

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Json, TablesInsert } from '@/types/database';
import {
  addToIndex,
  buildDonorIndex,
  matchIncomingDonor,
  normalizePhone,
  type DonorIndex,
  type DonorKeys,
  type IncomingDonor,
} from '@/lib/import/donorMatch';
import {
  NEDARIM_SOURCE,
  fetchHistory,
  fetchRecurring,
  maxTransactionId,
  parseRecurring,
  parseTransaction,
  type ParsedDonation,
  type ParsedRecurring,
} from './adapter';

export type ImportOutcome = 'imported' | 'new_donor' | 'review' | 'skipped' | 'invalid' | 'updated';

export type ImportCounts = Record<ImportOutcome, number> & { errors: string[] };

export const emptyCounts = (): ImportCounts => ({
  imported: 0,
  new_donor: 0,
  review: 0,
  skipped: 0,
  invalid: 0,
  updated: 0,
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
  const english = !hasHebrew(incoming.full_name) && !hasHebrew(incoming.first_name) && !hasHebrew(incoming.last_name);
  const first = incoming.first_name ?? incoming.full_name ?? 'תורם מנדרים פלוס';
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

/** מוסיף תרומה לתורם. 'skipped' אם העסקה כבר קיימת */
export async function insertDonation(donorId: string, d: ParsedDonation): Promise<'imported' | 'skipped'> {
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

async function donorOfRecurring(kevaId: string | null): Promise<string | null> {
  if (!kevaId) return null;
  const { data } = await supabaseAdmin
    .from('recurring_donations')
    .select('donor_id')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', kevaId)
    .maybeSingle();
  return data?.donor_id ?? null;
}

export async function importTransactionRecord(raw: Record<string, unknown>, index: DonorIndex): Promise<ImportOutcome> {
  const parsed = parseTransaction(raw);
  if (!parsed) return 'invalid';
  const { donor, donation } = parsed;

  const { data: existing } = await supabaseAdmin
    .from('donations')
    .select('id')
    .eq('external_source', NEDARIM_SOURCE)
    .eq('external_id', donation.externalId)
    .maybeSingle();
  if (existing || (await alreadyInReview('donation', donation.externalId))) return 'skipped';

  const kevaDonor = await donorOfRecurring(donation.recurringExternalId);
  if (kevaDonor) return insertDonation(kevaDonor, donation);

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

export async function importRecurringRecord(raw: Record<string, unknown>, index: DonorIndex): Promise<ImportOutcome> {
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
  if (await alreadyInReview('recurring', parsed.externalId)) return 'skipped';

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
  lastHistoryId: string | null;
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
    lastHistoryId: settings?.last_history_id ?? null,
  };
}

/** כמה דפי היסטוריה לכל היותר בהרצה אחת (שלא נחרוג מזמן הריצה של השרת) */
const MAX_PAGES_PER_RUN = 10;

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
    for (const raw of await fetchRecurring(creds)) {
      try {
        tally(summary.recurring, await importRecurringRecord(raw, index));
      } catch (e) {
        summary.recurring.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    let lastId = cfg.lastHistoryId;
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const rows = await fetchHistory(creds, lastId);
      for (const raw of rows) {
        try {
          tally(summary.donations, await importTransactionRecord(raw, index));
        } catch (e) {
          summary.donations.errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      const next = maxTransactionId(rows, lastId);
      if (next !== lastId) {
        lastId = next;
        await supabaseAdmin.from('integration_settings').update({ last_history_id: lastId }).eq('provider', NEDARIM_SOURCE);
      }
      summary.lastHistoryId = lastId;
      if (rows.length === 0 || next === null) break;
      if (page === MAX_PAGES_PER_RUN - 1) summary.morePending = true;
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
