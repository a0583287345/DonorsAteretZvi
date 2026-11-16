// =====================================================================
// תזכורות אוטומטיות מכרטיס התורם
//   יום הולדת → תזכורת שנתית לועזית + תזכורת שנתית עברית
//   כל יום יארצייט (donor_yahrzeits) → תזכורת שנתית עברית לפי כללי יארצייט
// נקרא אחרי שמירת תורם. יוצר / מעדכן / מוחק לפי הנתונים בכרטיס.
// תזכורת חדשה: מייל למנהל + הודעה לתורם (מזל טוב / עילוי נשמה) כברירת מחדל.
// הגדרות שהמשתמש שינה בתזכורת (התראה מראש, מיילים, תיאור) נשמרות.
// =====================================================================

import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import { formatHebrewParts, hebrewToISO, isHebrewLeapYear, toHebrewParts } from './hebrew';
import { addDaysISO, todayISO } from './dates';

export type AutoSource = 'donor_birthday_gregorian' | 'donor_birthday_hebrew' | 'donor_yahrzeit';

const AUTO_SOURCES: AutoSource[] = ['donor_birthday_gregorian', 'donor_birthday_hebrew', 'donor_yahrzeit'];

/** כמה ימים לפני המועד תזכורת אוטומטית מופיעה כפעילה */
export const AUTO_LEAD_DAYS = 7;

/** מופעים שעברו (לפני היום) לא נחשבים "באיחור" בתזכורת אוטומטית חדשה */
const pastHandled = () => addDaysISO(todayISO(), -1);

export type SavedYahrzeit = { id: string; day: number; month: number; name: string | null };

export type DonorDates = {
  id: string;
  name: string;
  birthday: string | null;
  birthday_after_sunset: boolean;
  yahrzeits: SavedYahrzeit[];
};

type Schedule = Required<
  Pick<
    TablesInsert<'reminders'>,
    'title' | 'date_type' | 'gregorian_date' | 'hebrew_day' | 'hebrew_month' | 'hebrew_year' | 'hebrew_date'
  >
>;

type Wanted = { source: AutoSource; yahrzeitId: string | null; schedule: Schedule };

/** שנת בסיס ליארצייט כשידועים רק יום וחודש: אדר ב' → שנה מעוברת, אחרת שנה רגילה */
function yahrzeitBaseYear(month: number): number {
  const leap = 5784; // תשפ"ד – מעוברת
  const regular = 5785; // תשפ"ה – רגילה
  if (!isHebrewLeapYear(leap) || isHebrewLeapYear(regular)) throw new Error('שנות בסיס שגויות');
  return month === 13 ? leap : regular;
}

const keyOf = (source: string, yahrzeitId: string | null | undefined, reminderId?: string) =>
  source === 'donor_yahrzeit' ? `yahrzeit:${yahrzeitId ?? `orphan-${reminderId}`}` : source;

function desiredReminders(d: DonorDates): Map<string, Wanted> {
  const result = new Map<string, Wanted>();

  if (d.birthday) {
    const greg = d.birthday.slice(0, 10);
    const p = toHebrewParts(greg, d.birthday_after_sunset);
    const hebrewLabel = formatHebrewParts(p.day, p.month, p.year);

    result.set('donor_birthday_gregorian', {
      source: 'donor_birthday_gregorian',
      yahrzeitId: null,
      schedule: {
        title: `יום הולדת – ${d.name}`,
        date_type: 'gregorian',
        gregorian_date: greg,
        hebrew_day: null,
        hebrew_month: null,
        hebrew_year: null,
        hebrew_date: hebrewLabel,
      },
    });
    result.set('donor_birthday_hebrew', {
      source: 'donor_birthday_hebrew',
      yahrzeitId: null,
      schedule: {
        title: `יום הולדת עברי – ${d.name}`,
        date_type: 'hebrew',
        gregorian_date: hebrewToISO(p.day, p.month, p.year),
        hebrew_day: p.day,
        hebrew_month: p.month,
        hebrew_year: p.year,
        hebrew_date: hebrewLabel,
      },
    });
  }

  for (const y of d.yahrzeits) {
    const year = yahrzeitBaseYear(y.month);
    const of = y.name?.trim();
    result.set(keyOf('donor_yahrzeit', y.id), {
      source: 'donor_yahrzeit',
      yahrzeitId: y.id,
      schedule: {
        title: of ? `יארצייט – ${of} (${d.name})` : `יארצייט – ${d.name}`,
        date_type: 'hebrew',
        gregorian_date: hebrewToISO(y.day, y.month, year),
        hebrew_day: y.day,
        hebrew_month: y.month,
        hebrew_year: year,
        hebrew_date: formatHebrewParts(y.day, y.month),
      },
    });
  }

  return result;
}

export type SyncResult = { created: number; updated: number; deleted: number; error?: string };

/** יצירה / עדכון / מחיקה של התזכורות האוטומטיות של תורם */
export async function syncDonorAutoReminders(d: DonorDates, userId?: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };
  const wanted = desiredReminders(d);

  const { data: existing, error } = await supabase
    .from('reminders')
    .select('id, source, yahrzeit_id, gregorian_date, hebrew_day, hebrew_month, hebrew_year, title')
    .eq('donor_id', d.id)
    .in('source', AUTO_SOURCES);

  if (error) return { ...result, error: error.message };

  const existingByKey = new Map((existing ?? []).map((r) => [keyOf(r.source, r.yahrzeit_id, r.id), r]));

  // מחיקה – תזכורות שכבר לא רלוונטיות
  for (const [key, current] of existingByKey) {
    if (wanted.has(key)) continue;
    const { error: e } = await supabase.from('reminders').delete().eq('id', current.id);
    if (e) return { ...result, error: e.message };
    result.deleted += 1;
  }

  for (const [key, { source, yahrzeitId, schedule }] of wanted) {
    const current = existingByKey.get(key);

    if (!current) {
      const insert: TablesInsert<'reminders'> = {
        ...schedule,
        donor_id: d.id,
        source,
        yahrzeit_id: yahrzeitId,
        repeat_unit: 'year',
        repeat_interval: 1,
        repeat_end_type: 'never',
        lead_days: AUTO_LEAD_DAYS,
        is_recurring: true,
        recurring_type: 'yearly',
        completed_through: pastHandled(),
        // ברירת מחדל: מייל למנהל + הודעה לתורם (ממתינה לאישור לפני שליחה)
        notify_email: true,
        donor_message_type: source === 'donor_yahrzeit' ? 'memorial' : 'birthday',
        created_by: userId ?? null,
      };
      const { error: e } = await supabase.from('reminders').insert([insert]);
      if (e) return { ...result, error: e.message };
      result.created += 1;
      continue;
    }

    const dateChanged =
      current.gregorian_date?.slice(0, 10) !== schedule.gregorian_date ||
      current.hebrew_day !== schedule.hebrew_day ||
      current.hebrew_month !== schedule.hebrew_month ||
      current.hebrew_year !== schedule.hebrew_year;

    if (!dateChanged && current.title === schedule.title) continue;

    const update: TablesUpdate<'reminders'> = {
      ...schedule,
      // תאריך חדש → מתחילים מחדש (בלי "בוצע" ודחייה ישנים)
      ...(dateChanged ? { completed_through: pastHandled(), snoozed_until: null, is_completed: false } : {}),
    };
    const { error: e } = await supabase.from('reminders').update(update).eq('id', current.id);
    if (e) return { ...result, error: e.message };
    result.updated += 1;
  }

  return result;
}

// ---------------------------------------------------------------------
// ימי יארצייט של תורם (donor_yahrzeits)
// ---------------------------------------------------------------------

export async function loadDonorYahrzeits(donorId: string): Promise<SavedYahrzeit[]> {
  const { data, error } = await supabase
    .from('donor_yahrzeits')
    .select('id, hebrew_day, hebrew_month, name')
    .eq('donor_id', donorId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('שגיאה בטעינת ימי יארצייט:', error.message);
    return [];
  }
  return (data ?? []).map((y) => ({ id: y.id, day: y.hebrew_day, month: y.hebrew_month, name: y.name }));
}

/**
 * שמירת רשימת היארצייטים: מוסיף חדשים, מעדכן קיימים, מוחק שהוסרו
 * (מחיקה מוחקת גם את התזכורת שלו – on delete cascade).
 */
export async function saveDonorYahrzeits(
  donorId: string,
  entries: { id?: string; day: number; month: number; name: string }[]
): Promise<{ saved: SavedYahrzeit[]; error?: string }> {
  const existing = await loadDonorYahrzeits(donorId);
  const keepIds = new Set(entries.filter((e) => e.id).map((e) => e.id));
  const saved: SavedYahrzeit[] = [];

  const removed = existing.filter((y) => !keepIds.has(y.id)).map((y) => y.id);
  if (removed.length) {
    const { error } = await supabase.from('donor_yahrzeits').delete().in('id', removed);
    if (error) return { saved: existing, error: error.message };
  }

  for (const e of entries) {
    const row = { hebrew_day: e.day, hebrew_month: e.month, name: e.name.trim() || null };
    if (e.id) {
      const before = existing.find((y) => y.id === e.id);
      if (before && (before.day !== e.day || before.month !== e.month || (before.name ?? '') !== (row.name ?? ''))) {
        const { error } = await supabase.from('donor_yahrzeits').update(row).eq('id', e.id);
        if (error) return { saved, error: error.message };
      }
      saved.push({ id: e.id, day: e.day, month: e.month, name: row.name });
    } else {
      const { data, error } = await supabase
        .from('donor_yahrzeits')
        .insert([{ ...row, donor_id: donorId }])
        .select('id')
        .single();
      if (error || !data) return { saved, error: error?.message ?? 'שמירת יארצייט נכשלה' };
      saved.push({ id: data.id, day: e.day, month: e.month, name: row.name });
    }
  }

  return { saved };
}
