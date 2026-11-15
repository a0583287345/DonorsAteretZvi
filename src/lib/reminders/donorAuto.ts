// =====================================================================
// תזכורות אוטומטיות מכרטיס התורם
//   יום הולדת → תזכורת שנתית לועזית + תזכורת שנתית עברית
//   יארצייט (יום + חודש עבריים) → תזכורת שנתית עברית לפי כללי יארצייט
// נקרא אחרי שמירת תורם. יוצר / מעדכן / מוחק לפי הנתונים בכרטיס.
// הגדרות שהמשתמש שינה בתזכורת (התראה מראש, מיילים, תיאור) נשמרות.
// =====================================================================

import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import { formatHebrewParts, hebrewToISO, isHebrewLeapYear, toHebrewParts } from './hebrew';
import { addDaysISO, todayISO } from './dates';

/** מופעים שעברו (לפני היום) לא נחשבים "באיחור" בתזכורת אוטומטית חדשה */
const pastHandled = () => addDaysISO(todayISO(), -1);

export type AutoSource = 'donor_birthday_gregorian' | 'donor_birthday_hebrew' | 'donor_yahrzeit';

const AUTO_SOURCES: AutoSource[] = ['donor_birthday_gregorian', 'donor_birthday_hebrew', 'donor_yahrzeit'];

/** כמה ימים לפני המועד תזכורת אוטומטית מופיעה כפעילה */
export const AUTO_LEAD_DAYS = 7;

export type DonorDates = {
  id: string;
  name: string;
  birthday: string | null;
  birthday_after_sunset: boolean;
  yahrzeit_hebrew_day: number | null;
  yahrzeit_hebrew_month: number | null;
  yahrzeit_of: string | null;
};

type Schedule = Required<
  Pick<
    TablesInsert<'reminders'>,
    'title' | 'date_type' | 'gregorian_date' | 'hebrew_day' | 'hebrew_month' | 'hebrew_year' | 'hebrew_date'
  >
>;

/** שנת בסיס ליארצייט כשידועים רק יום וחודש: אדר ב' → שנה מעוברת, אחרת שנה רגילה */
function yahrzeitBaseYear(month: number): number {
  const leap = 5784; // תשפ"ד – מעוברת
  const regular = 5785; // תשפ"ה – רגילה
  if (!isHebrewLeapYear(leap) || isHebrewLeapYear(regular)) throw new Error('שנות בסיס שגויות');
  return month === 13 ? leap : regular;
}

function desiredSchedules(d: DonorDates): Partial<Record<AutoSource, Schedule>> {
  const result: Partial<Record<AutoSource, Schedule>> = {};

  if (d.birthday) {
    const greg = d.birthday.slice(0, 10);
    const p = toHebrewParts(greg, d.birthday_after_sunset);
    const hebrewLabel = formatHebrewParts(p.day, p.month, p.year);

    result.donor_birthday_gregorian = {
      title: `יום הולדת – ${d.name}`,
      date_type: 'gregorian',
      gregorian_date: greg,
      hebrew_day: null,
      hebrew_month: null,
      hebrew_year: null,
      hebrew_date: hebrewLabel,
    };
    result.donor_birthday_hebrew = {
      title: `יום הולדת עברי – ${d.name}`,
      date_type: 'hebrew',
      gregorian_date: hebrewToISO(p.day, p.month, p.year),
      hebrew_day: p.day,
      hebrew_month: p.month,
      hebrew_year: p.year,
      hebrew_date: hebrewLabel,
    };
  }

  if (d.yahrzeit_hebrew_day && d.yahrzeit_hebrew_month) {
    const year = yahrzeitBaseYear(d.yahrzeit_hebrew_month);
    const of = d.yahrzeit_of?.trim();
    result.donor_yahrzeit = {
      title: of ? `יארצייט – ${of} (${d.name})` : `יארצייט – ${d.name}`,
      date_type: 'hebrew',
      gregorian_date: hebrewToISO(d.yahrzeit_hebrew_day, d.yahrzeit_hebrew_month, year),
      hebrew_day: d.yahrzeit_hebrew_day,
      hebrew_month: d.yahrzeit_hebrew_month,
      hebrew_year: year,
      hebrew_date: formatHebrewParts(d.yahrzeit_hebrew_day, d.yahrzeit_hebrew_month),
    };
  }

  return result;
}

export type SyncResult = { created: number; updated: number; deleted: number; error?: string };

/** יצירה / עדכון / מחיקה של התזכורות האוטומטיות של תורם */
export async function syncDonorAutoReminders(d: DonorDates, userId?: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 };
  const wanted = desiredSchedules(d);

  const { data: existing, error } = await supabase
    .from('reminders')
    .select('id, source, gregorian_date, hebrew_day, hebrew_month, hebrew_year, title')
    .eq('donor_id', d.id)
    .in('source', AUTO_SOURCES);

  if (error) return { ...result, error: error.message };

  for (const source of AUTO_SOURCES) {
    const current = existing?.find((r) => r.source === source);
    const schedule = wanted[source];

    if (!schedule && current) {
      const { error: e } = await supabase.from('reminders').delete().eq('id', current.id);
      if (e) return { ...result, error: e.message };
      result.deleted += 1;
      continue;
    }

    if (schedule && !current) {
      const insert: TablesInsert<'reminders'> = {
        ...schedule,
        donor_id: d.id,
        source,
        repeat_unit: 'year',
        repeat_interval: 1,
        repeat_end_type: 'never',
        lead_days: AUTO_LEAD_DAYS,
        is_recurring: true,
        recurring_type: 'yearly',
        completed_through: pastHandled(),
        created_by: userId ?? null,
      };
      const { error: e } = await supabase.from('reminders').insert([insert]);
      if (e) return { ...result, error: e.message };
      result.created += 1;
      continue;
    }

    if (schedule && current) {
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
  }

  return result;
}
