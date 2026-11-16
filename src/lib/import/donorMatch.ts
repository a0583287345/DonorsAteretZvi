// =====================================================================
// זיהוי תורמים: נרמול (טלפון / ת"ז / מייל / שם), התאמת תורם מיובא לתורם קיים,
// ומציאת כפילויות בין תורמים קיימים. קוד טהור – משמש גם בדפדפן וגם בשרת.
//
// סדר ההתאמה בייבוא:
//   1. ת"ז זהה                    → אותו תורם
//   2. טלפון זהה (+ שם לא סותר)   → אותו תורם
//   3. מייל זהה (+ שם לא סותר)    → אותו תורם
//   4. רק שם זהה / סתירה           → "לבדיקה" (אדם מחליט)
//   5. שום דבר                    → תורם חדש
// =====================================================================

/** הנתונים המינימליים של תורם שצריך לזיהוי */
export type DonorKeys = {
  id: string;
  first_name_he: string | null;
  last_name_he: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  zeout?: string | null;
  phone_1: string | null;
  phone_2: string | null;
  email: string | null;
};

/** תורם כפי שהגיע ממקור חיצוני (נדרים פלוס וכו') */
export type IncomingDonor = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  zeout: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  street: string | null;
  house_number: string | null;
  country: string | null;
};

// ---------------------------------------------------------------------
// נרמול
// ---------------------------------------------------------------------

const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '');

/** טלפון ישראלי למבנה אחיד: 0501234567. +972 / 972 → 0. קצר מ-9 ספרות → null */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = onlyDigits(String(raw));
  if (d.startsWith('00972')) d = '0' + d.slice(5);
  else if (d.startsWith('972')) d = '0' + d.slice(3);
  else if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return d.length >= 9 ? d : null;
}

/** ת"ז: ספרות בלבד, משלים לאפסים מובילים ל-9 ספרות. ריק/אפסים/ארוך מדי → null */
export function normalizeZeout(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = onlyDigits(String(raw));
  if (!d || /^0+$/.test(d) || d.length > 9) return null;
  return d.padStart(9, '0');
}

/** בדיקת ספרת ביקורת של ת"ז ישראלית */
export function isValidZeout(raw: string | null | undefined): boolean {
  const z = normalizeZeout(raw);
  if (!z) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(z[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  return e.includes('@') && e.length > 3 ? e : null;
}

/** מילות השם בלי תארים וסימנים (ר', הרב, משפחת...) – לזיהוי לא תלוי סדר */
const NAME_NOISE = new Set(['הרב', 'רב', 'ר', 'מר', 'גב', 'הגב', 'משפחת', 'משפ', 'מרת', 'רבי', 'הגאון', 'ד', 'דר', 'mr', 'mrs', 'ms', 'dr', 'rabbi']);

export function nameTokens(...parts: (string | null | undefined)[]): string[] {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  return text
    .replace(/["'`״׳.,\-()/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !NAME_NOISE.has(t));
}

const donorNameTokens = (d: DonorKeys) => nameTokens(d.first_name_he, d.last_name_he);
const donorNameTokensEn = (d: DonorKeys) => nameTokens(d.first_name_en, d.last_name_en);
const allNameTokens = (d: DonorKeys) => [...donorNameTokens(d), ...donorNameTokensEn(d)];

const incomingNameTokens = (i: IncomingDonor) =>
  i.first_name || i.last_name ? nameTokens(i.first_name, i.last_name) : nameTokens(i.full_name);

/** אותו שם – אותן מילים (בכל סדר) */
function sameName(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const sa = [...new Set(a)].sort().join(' ');
  const sb = [...new Set(b)].sort().join(' ');
  return sa === sb;
}

/** השמות לא סותרים: אחד ריק, או שיש לפחות מילה משותפת אחת (למשל שם משפחה) */
function namesCompatible(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  const sb = new Set(b);
  return a.some((t) => sb.has(t));
}

/** השם שניתן לתורם שנוצר מייבוא בלי שם – לא שם אמיתי, לא משמש לזיהוי כפילויות */
export const IMPORT_PLACEHOLDER_NAME = 'תורם מנדרים פלוס';

/** שמות שמקורות חיצוניים שולחים כשאין תורם (נבדק אחרי nameTokens) */
const ANONYMOUS_NAMES = new Set(
  [IMPORT_PLACEHOLDER_NAME, 'אנונימי', 'תורם אנונימי', 'ללא שם', 'בעילום שם', 'anonymous', 'anonim'].map((n) =>
    nameTokens(n).join(' ')
  )
);

const isAnonymousName = (tokens: string[]) => tokens.length === 0 || ANONYMOUS_NAMES.has(tokens.join(' '));

/**
 * האם יש לתורם המיובא פרט מזהה כלשהו (שם / ת"ז / טלפון / מייל / כתובת).
 * בלי אף אחד – "תרומה ללא תורם": לא פותחים כרטיס תורם.
 */
export function hasIdentifyingDetails(i: IncomingDonor): boolean {
  if (normalizeZeout(i.zeout) || normalizePhone(i.phone) || normalizeEmail(i.email)) return true;
  if (i.street?.trim() || i.city?.trim()) return true;
  return !isAnonymousName(incomingNameTokens(i));
}

export const donorDisplayName = (d: Pick<DonorKeys, 'first_name_he' | 'last_name_he' | 'first_name_en' | 'last_name_en'>) =>
  [d.first_name_he, d.last_name_he].filter(Boolean).join(' ') ||
  [d.first_name_en, d.last_name_en].filter(Boolean).join(' ') ||
  'ללא שם';

/** פיצול "שם מלא" לשם פרטי + משפחה (מילה ראשונה = פרטי). אפשר לתקן אחר כך בכרטיס */
export function splitFullName(full: string | null | undefined): { first: string | null; last: string | null } {
  const words = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: null, last: null };
  if (words.length === 1) return { first: words[0], last: null };
  return { first: words[0], last: words.slice(1).join(' ') };
}

// ---------------------------------------------------------------------
// אינדקס תורמים לחיפוש מהיר
// ---------------------------------------------------------------------

export type DonorIndex = {
  byId: Map<string, DonorKeys>;
  byZeout: Map<string, string[]>;
  byPhone: Map<string, string[]>;
  byEmail: Map<string, string[]>;
};

function push(map: Map<string, string[]>, key: string | null, id: string) {
  if (!key) return;
  const list = map.get(key);
  if (!list) map.set(key, [id]);
  else if (!list.includes(id)) list.push(id);
}

export function buildDonorIndex(donors: DonorKeys[]): DonorIndex {
  const index: DonorIndex = { byId: new Map(), byZeout: new Map(), byPhone: new Map(), byEmail: new Map() };
  for (const d of donors) addToIndex(index, d);
  return index;
}

export function addToIndex(index: DonorIndex, d: DonorKeys) {
  index.byId.set(d.id, d);
  push(index.byZeout, normalizeZeout(d.zeout), d.id);
  push(index.byPhone, normalizePhone(d.phone_1), d.id);
  push(index.byPhone, normalizePhone(d.phone_2), d.id);
  push(index.byEmail, normalizeEmail(d.email), d.id);
}

// ---------------------------------------------------------------------
// התאמת תורם מיובא
// ---------------------------------------------------------------------

export type MatchResult =
  | { kind: 'match'; donorId: string; by: 'zeout' | 'phone' | 'email' }
  | { kind: 'review'; candidates: string[]; reason: string }
  | { kind: 'new' };

export function matchIncomingDonor(incoming: IncomingDonor, index: DonorIndex): MatchResult {
  const zeout = normalizeZeout(incoming.zeout);
  const phone = normalizePhone(incoming.phone);
  const email = normalizeEmail(incoming.email);
  const tokens = incomingNameTokens(incoming);

  // תורם קיים עם ת"ז אחרת – בוודאות לא אותו אדם
  const conflictsZeout = (id: string) => {
    const z = normalizeZeout(index.byId.get(id)?.zeout);
    return !!(zeout && z && z !== zeout);
  };
  const nameOk = (id: string) => {
    const d = index.byId.get(id);
    if (!d) return false;
    return namesCompatible(tokens, allNameTokens(d));
  };
  const exactName = (id: string) => {
    const d = index.byId.get(id);
    return !!d && (sameName(tokens, donorNameTokens(d)) || sameName(tokens, donorNameTokensEn(d)));
  };

  // 1. ת"ז
  if (zeout) {
    const ids = index.byZeout.get(zeout) ?? [];
    if (ids.length === 1) return { kind: 'match', donorId: ids[0], by: 'zeout' };
    if (ids.length > 1) return { kind: 'review', candidates: ids, reason: 'כמה תורמים במערכת עם אותה ת"ז' };
  }

  // 2-3. טלפון, מייל
  const suspects = new Set<string>();
  for (const [by, key, map, label] of [
    ['phone', phone, index.byPhone, 'טלפון'],
    ['email', email, index.byEmail, 'מייל'],
  ] as const) {
    if (!key) continue;
    const ids = (map.get(key) ?? []).filter((id) => !conflictsZeout(id));
    const good = ids.filter(nameOk);
    if (good.length === 1) return { kind: 'match', donorId: good[0], by };
    if (good.length > 1) {
      const exact = good.filter(exactName);
      if (exact.length === 1) return { kind: 'match', donorId: exact[0], by };
      return { kind: 'review', candidates: good, reason: `כמה תורמים במערכת עם אותו ${label}` };
    }
    ids.forEach((id) => suspects.add(id));
  }
  if (suspects.size > 0) {
    return { kind: 'review', candidates: [...suspects], reason: 'טלפון או מייל זהים אבל השם שונה' };
  }

  // 4. שם זהה בלבד
  if (tokens.length >= 2 && !isAnonymousName(tokens)) {
    const sameNameIds = [...index.byId.values()]
      .filter((d) => !conflictsZeout(d.id) && (sameName(tokens, donorNameTokens(d)) || sameName(tokens, donorNameTokensEn(d))))
      .map((d) => d.id);
    if (sameNameIds.length > 0) {
      return { kind: 'review', candidates: sameNameIds, reason: 'שם זהה לתורם קיים, בלי ת"ז/טלפון/מייל תואמים' };
    }
  }

  return { kind: 'new' };
}

// ---------------------------------------------------------------------
// כפילויות בין תורמים קיימים
// ---------------------------------------------------------------------

export type DuplicateReason = 'zeout' | 'phone' | 'email' | 'name';

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  zeout: 'ת"ז זהה',
  phone: 'טלפון זהה',
  email: 'מייל זהה',
  name: 'שם זהה',
};

export type DuplicatePair = { a: string; b: string; reasons: DuplicateReason[]; score: number };

const REASON_SCORE: Record<DuplicateReason, number> = { zeout: 100, phone: 40, email: 40, name: 25 };

export const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/**
 * זוגות חשודים ככפילות. dismissed = מפתחות pairKey של זוגות שסומנו "לא כפילות".
 * זוג עם ת"ז שונה (שתיהן מלאות) לא מוצג – אלה בוודאות שני אנשים.
 */
export function findDuplicatePairs(donors: DonorKeys[], dismissed: Set<string> = new Set()): DuplicatePair[] {
  const groups = new Map<string, string[]>();
  const add = (reason: DuplicateReason, key: string | null, id: string) => {
    if (key) push(groups, `${reason}:${key}`, id);
  };

  for (const d of donors) {
    add('zeout', normalizeZeout(d.zeout), d.id);
    add('phone', normalizePhone(d.phone_1), d.id);
    add('phone', normalizePhone(d.phone_2), d.id);
    add('email', normalizeEmail(d.email), d.id);
    for (const tokens of [donorNameTokens(d), donorNameTokensEn(d)]) {
      // "תורם מנדרים פלוס" / "אנונימי" – לא שם אמיתי, לא סיבה לחשוד בכפילות
      if (tokens.length >= 2 && !isAnonymousName(tokens)) add('name', [...new Set(tokens)].sort().join(' '), d.id);
    }
  }

  const byId = new Map(donors.map((d) => [d.id, d]));
  const pairs = new Map<string, DuplicatePair>();
  for (const [groupKey, ids] of groups) {
    if (ids.length < 2) continue;
    const reason = groupKey.slice(0, groupKey.indexOf(':')) as DuplicateReason;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        if (dismissed.has(key)) continue;
        const za = normalizeZeout(byId.get(ids[i])?.zeout);
        const zb = normalizeZeout(byId.get(ids[j])?.zeout);
        if (za && zb && za !== zb) continue;
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        const pair = pairs.get(key) ?? { a, b, reasons: [], score: 0 };
        if (!pair.reasons.includes(reason)) {
          pair.reasons.push(reason);
          pair.score += REASON_SCORE[reason];
        }
        pairs.set(key, pair);
      }
    }
  }

  return [...pairs.values()].sort((x, y) => y.score - x.score);
}
