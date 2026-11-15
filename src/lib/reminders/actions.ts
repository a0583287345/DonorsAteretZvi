// =====================================================================
// פעולות על תזכורת: בוצע / ביטול בוצע / דחייה – כולל רישום ליומן
// =====================================================================

import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import type { Reminder } from '@/types/donor';
import type { TablesUpdate } from '@/types/database';
import { addDaysISO, formatGregorian, todayISO } from './dates';
import { nextOccurrence, previousOccurrence, reminderState } from './recurrence';

type Result = { ok: true } | { ok: false; error: string };

async function update(id: string, values: TablesUpdate<'reminders'>): Promise<Result> {
  const { error } = await supabase.from('reminders').update(values).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** סימון המופע הנוכחי כבוצע. בתזכורת חוזרת – עוברים למופע הבא */
export async function markReminderDone(r: Reminder): Promise<Result> {
  const state = reminderState(r, todayISO());
  if (!state.occurrence) return { ok: true };

  const hasMore = !!nextOccurrence(r, addDaysISO(state.occurrence, 1));
  const res = await update(r.id, {
    completed_through: state.occurrence,
    snoozed_until: null,
    is_completed: !hasMore,
  });
  if (res.ok) {
    await logActivity(
      'REMINDER_MARKED_COMPLETE',
      'reminders',
      `סימן כבוצע את "${r.title}" (מופע ${formatGregorian(state.occurrence)})`
    );
  }
  return res;
}

/** ביטול הסימון האחרון של "בוצע" – חוזרים למופע הקודם */
export async function undoReminderDone(r: Reminder): Promise<Result> {
  if (!r.completed_through) return { ok: true };
  const prev = previousOccurrence(r, r.completed_through.slice(0, 10));
  const res = await update(r.id, { completed_through: prev, is_completed: false });
  if (res.ok) {
    await logActivity('REMINDER_MARKED_PENDING', 'reminders', `ביטל סימון בוצע עבור "${r.title}"`);
  }
  return res;
}

/** דחיית המופע הנוכחי לתאריך אחר */
export async function snoozeReminder(r: Reminder, dateISO: string): Promise<Result> {
  const res = await update(r.id, { snoozed_until: dateISO });
  if (res.ok) {
    await logActivity('REMINDER_SNOOZED', 'reminders', `דחה את "${r.title}" ל-${formatGregorian(dateISO)}`);
  }
  return res;
}

/** ביטול דחייה – חוזרים לתאריך המקורי של המופע */
export async function clearReminderSnooze(r: Reminder): Promise<Result> {
  const res = await update(r.id, { snoozed_until: null });
  if (res.ok) {
    await logActivity('REMINDER_SNOOZE_CLEARED', 'reminders', `ביטל דחייה של "${r.title}"`);
  }
  return res;
}

export async function deleteReminder(r: Reminder, donorName: string): Promise<Result> {
  const { error } = await supabase.from('reminders').delete().eq('id', r.id);
  if (error) return { ok: false, error: error.message };
  await logActivity('REMINDER_DELETED', 'reminders', `מחק תזכורת "${r.title}" (תורם: ${donorName})`);
  return { ok: true };
}
