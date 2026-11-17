// =====================================================================
// ייבוא מאקסל – תכנון (קוד טהור): לכל שורה – למי היא שייכת, מה יתווסף,
// מה סותר נתון קיים (המשתמש מחליט), ואילו תרומות כבר קיימות.
// =====================================================================

import type { Donation, Donor } from '@/types/donor';
import {
  addToIndex,
  buildDonorIndex,
  donorDisplayName,
  matchIncomingDonor,
  normalizeEmail,
  normalizePhone,
  normalizeZeout,
  type DonorIndex,
  type IncomingDonor,
} from './donorMatch';
import { DONOR_COLUMNS, type DonationField, type DonorField, type ParsedValue } from './excelColumns';
import type { ExcelRow } from './excelFile';

export type DonorValues = Partial<Record<DonorField, ParsedValue>>;
export type DonationValues = Partial<Record<DonationField, ParsedValue>>;

export type RowMatch =
  | { kind: 'existing'; donorId: string; by: string }
  /** תורם חדש (אותו tempId לכל השורות של אותו אדם בקובץ) */
  | { kind: 'new'; tempId: string }
  /** לא ברור – המשתמש בוחר */
  | { kind: 'choose'; candidates: string[]; reason: string }
  /** שורה עם שגיאות – לא תיובא */
  | { kind: 'error' };

export type PlannedRow = {
  key: string;
  row: ExcelRow;
  donor: DonorValues;
  donation: DonationValues | null;
  match: RowMatch;
};

/** בחירת המשתמש לשורה "לא ברורה": מזהה תורם קיים / tempId / 'new' / 'skip' */
export type RowChoice = string;

export const rowKey = (r: ExcelRow) => `${r.sheet}:${r.rowNumber}`;
export const isTempId = (id: string) => id.startsWith('new:');

const MATCH_BY: Record<string, string> = { zeout: 'ת"ז', phone: 'טלפון', email: 'מייל' };

function toIncoming(v: DonorValues, phone: ParsedValue | undefined): IncomingDonor {
  const s = (x: ParsedValue | undefined) => (typeof x === 'string' ? x : null);
  return {
    full_name: null,
    first_name: s(v.first_name_he) ?? s(v.first_name_en),
    last_name: s(v.last_name_he) ?? s(v.last_name_en),
    zeout: s(v.zeout),
    phone: s(phone),
    email: s(v.email),
    city: s(v.city),
    street: s(v.street),
    house_number: null,
    country: null,
  };
}

const hasIdentity = (v: DonorValues) =>
  !!(v.first_name_he || v.last_name_he || v.first_name_en || v.last_name_en || v.zeout || v.phone_1 || v.phone_2 || v.email);

/** מתכנן את כל השורות: תורמים קודם (כדי שתרומות של תורם חדש מהקובץ ישויכו אליו) */
export function planRows(rows: ExcelRow[], donors: Donor[]): PlannedRow[] {
  const index: DonorIndex = buildDonorIndex(donors);
  let nextTemp = 1;
  const ordered = [...rows].sort((a, b) => (a.sheet === b.sheet ? 0 : a.sheet === 'donors' ? -1 : 1));

  return ordered.map((original) => {
    // בלי פרט מזהה – שגיאה (עותק חדש, לא משנים את השורה המקורית)
    const row: ExcelRow = { ...original, errors: [...original.errors] };
    const donor: DonorValues = {};
    const donation: DonationValues = {};
    for (const [field, value] of Object.entries(row.values)) {
      if (DONOR_COLUMNS.some((c) => c.field === field)) donor[field as DonorField] = value;
      else donation[field as DonationField] = value;
    }
    const base = { key: rowKey(row), row, donor, donation: row.sheet === 'donations' ? donation : null };

    if (!hasIdentity(donor)) row.errors.push('חסרים פרטי תורם (שם, ת"ז, טלפון או מייל)');
    if (row.errors.length) return { ...base, match: { kind: 'error' } };

    let m = matchIncomingDonor(toIncoming(donor, donor.phone_1), index);
    if (m.kind === 'new' && donor.phone_2) m = matchIncomingDonor(toIncoming(donor, donor.phone_2), index);

    if (m.kind === 'match') {
      const match: RowMatch = isTempId(m.donorId)
        ? { kind: 'new', tempId: m.donorId }
        : { kind: 'existing', donorId: m.donorId, by: MATCH_BY[m.by] ?? m.by };
      return { ...base, match };
    }
    if (m.kind === 'review') return { ...base, match: { kind: 'choose', candidates: m.candidates, reason: m.reason } };

    // תורם חדש – נכנס לאינדקס כדי ששורות נוספות של אותו אדם יזוהו אליו
    const tempId = `new:${nextTemp++}`;
    const s = (x: ParsedValue | undefined) => (typeof x === 'string' ? x : null);
    addToIndex(index, {
      id: tempId,
      first_name_he: s(donor.first_name_he),
      last_name_he: s(donor.last_name_he),
      first_name_en: s(donor.first_name_en),
      last_name_en: s(donor.last_name_en),
      zeout: s(donor.zeout),
      phone_1: s(donor.phone_1),
      phone_2: s(donor.phone_2),
      email: s(donor.email),
    });
    return { ...base, match: { kind: 'new', tempId } };
  });
}

/** התורם הסופי של שורה (אחרי בחירת המשתמש). null = לא תיובא */
export function targetOf(p: PlannedRow, choices: Record<string, RowChoice>): string | null {
  switch (p.match.kind) {
    case 'existing':
      return p.match.donorId;
    case 'new':
      return p.match.tempId;
    case 'choose': {
      const c = choices[p.key];
      if (!c || c === 'skip') return null;
      return c === 'new' ? `new:row:${p.key}` : c;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------
// השוואה לתורם קיים: מה חסר לו (יתווסף) ומה שונה (שאלה)
// ---------------------------------------------------------------------

export type Conflict = {
  /** `${donorId}:${field}` */
  id: string;
  donorId: string;
  field: DonorField;
  label: string;
  current: string;
  incoming: string;
  /** הערך החדש כפי שיישמר */
  value: ParsedValue;
  /** הערות – מוסיפים להערות הקיימות במקום להחליף */
  append?: boolean;
};

export type DonorUpdate = {
  donorId: string;
  name: string;
  /** שדות ריקים אצל התורם – יתמלאו אוטומטית */
  fills: DonorValues;
  conflicts: Conflict[];
};

const label = (f: DonorField) => DONOR_COLUMNS.find((c) => c.field === f)?.header ?? f;

export const displayValue = (v: ParsedValue | undefined): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
};

function sameValue(field: DonorField, a: unknown, b: ParsedValue): boolean {
  if (field === 'email') return normalizeEmail(String(a ?? '')) === normalizeEmail(String(b));
  if (field === 'zeout') return normalizeZeout(String(a ?? '')) === normalizeZeout(String(b));
  if (field === 'birthday') return String(a ?? '').slice(0, 10) === String(b);
  return String(a ?? '').trim().toLowerCase() === String(b).trim().toLowerCase();
}

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** ערכי כל השורות של אותו תורם: הערך הראשון שאינו ריק לכל שדה */
export function mergeValues(list: DonorValues[]): DonorValues {
  const out: DonorValues = {};
  for (const v of list) {
    for (const [f, val] of Object.entries(v) as [DonorField, ParsedValue][]) {
      if (out[f] === undefined && !isEmpty(val)) out[f] = val;
    }
  }
  return out;
}

export function compareWithExisting(existing: Donor, incoming: DonorValues): DonorUpdate {
  const fills: DonorValues = {};
  const conflicts: Conflict[] = [];
  const add = (field: DonorField, current: unknown, value: ParsedValue, append = false) =>
    conflicts.push({
      id: `${existing.id}:${field}`,
      donorId: existing.id,
      field,
      label: label(field),
      current: displayValue(current as ParsedValue),
      incoming: displayValue(value),
      value,
      append,
    });

  // טלפונים: מספר חדש → למקום פנוי; אין מקום → שאלה (במקום טלפון נוסף)
  const have = [existing.phone_1, existing.phone_2].map((p) => normalizePhone(p)).filter(Boolean);
  const fresh = [incoming.phone_1, incoming.phone_2]
    .filter((p): p is string => typeof p === 'string')
    .filter((p, i, arr) => !have.includes(normalizePhone(p)) && arr.findIndex((q) => normalizePhone(q) === normalizePhone(p)) === i);
  const freeSlots: ('phone_1' | 'phone_2')[] = (['phone_1', 'phone_2'] as const).filter((f) => isEmpty(existing[f]));
  for (const p of fresh) {
    const slot = freeSlots.shift();
    if (slot) fills[slot] = p;
    else if (!conflicts.some((c) => c.field === 'phone_2')) add('phone_2', existing.phone_2, p);
  }

  for (const col of DONOR_COLUMNS) {
    const f = col.field;
    if (f === 'phone_1' || f === 'phone_2') continue;
    const value = incoming[f];
    if (value === undefined || value === null) continue;
    const current = (existing as unknown as Record<string, unknown>)[f];

    if (f === 'has_yissachar_zevulun') {
      if (value === true && !current) fills[f] = true;
      else if (value === false && current === true) add(f, true, false);
      continue;
    }
    if (isEmpty(current)) fills[f] = value;
    else if (!sameValue(f, current, value)) add(f, current, value, f === 'notes');
  }

  return { donorId: existing.id, name: donorDisplayName(existing), fills, conflicts };
}

// ---------------------------------------------------------------------
// סיכום התוכנית לפי בחירות המשתמש
// ---------------------------------------------------------------------

export type ImportPlan = {
  /** tempId → פרטי התורם החדש (מכל השורות שלו) */
  newDonors: Map<string, { values: DonorValues; rows: PlannedRow[] }>;
  updates: DonorUpdate[];
  donations: { row: PlannedRow; target: string }[];
  /** תרומות שכבר קיימות במערכת (אותו תורם, תאריך, סכום ומטבע) */
  duplicates: PlannedRow[];
  /** שורות "לא ברורות" שעוד לא נבחר להן תורם */
  undecided: PlannedRow[];
  skipped: PlannedRow[];
  errors: PlannedRow[];
};

const donationKey = (donorId: string, date: unknown, amount: unknown, currency: unknown) =>
  `${donorId}|${String(date ?? '').slice(0, 10)}|${Number(amount)}|${currency || 'ILS'}`;

export function buildPlan(
  planned: PlannedRow[],
  choices: Record<string, RowChoice>,
  donors: Donor[],
  existingDonations: Donation[]
): ImportPlan {
  const donorById = new Map(donors.map((d) => [d.id, d]));
  const existingKeys = new Set(
    existingDonations.filter((d) => d.donor_id).map((d) => donationKey(d.donor_id!, d.donation_date, d.amount, d.currency))
  );

  const plan: ImportPlan = { newDonors: new Map(), updates: [], donations: [], duplicates: [], undecided: [], skipped: [], errors: [] };
  const valuesByExisting = new Map<string, DonorValues[]>();

  for (const p of planned) {
    if (p.match.kind === 'error') {
      plan.errors.push(p);
      continue;
    }
    if (p.match.kind === 'choose' && !choices[p.key]) {
      plan.undecided.push(p);
      continue;
    }
    const target = targetOf(p, choices);
    if (!target) {
      plan.skipped.push(p);
      continue;
    }

    if (isTempId(target)) {
      const entry = plan.newDonors.get(target) ?? { values: {}, rows: [] };
      entry.rows.push(p);
      entry.values = mergeValues([entry.values, p.donor]);
      plan.newDonors.set(target, entry);
    } else {
      valuesByExisting.set(target, [...(valuesByExisting.get(target) ?? []), p.donor]);
    }

    if (p.donation) {
      if (!isTempId(target) && existingKeys.has(donationKey(target, p.donation.donation_date, p.donation.amount, p.donation.currency))) {
        plan.duplicates.push(p);
      } else {
        plan.donations.push({ row: p, target });
      }
    }
  }

  for (const [donorId, list] of valuesByExisting) {
    const existing = donorById.get(donorId);
    if (!existing) continue;
    const u = compareWithExisting(existing, mergeValues(list));
    if (Object.keys(u.fills).length || u.conflicts.length) plan.updates.push(u);
  }
  return plan;
}
