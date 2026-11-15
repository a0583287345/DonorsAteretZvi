'use client';

import { useState } from 'react';
import DateInput from '@/components/DateInput';
import {
  X, Check, Undo2, Clock, Pencil, Trash2, User, Repeat, Bell, Mail,
  Paperclip, CalendarDays, Sparkles, Loader2, AlarmClockOff,
} from 'lucide-react';
import type { Donor, Reminder } from '@/types/donor';
import { Protect } from '@/components/Protect';
import { useAuth } from '@/components/AuthContext';
import { toast } from '@/components/Toaster';
import { openSecureFile } from '@/lib/storage';
import { addDaysISO, formatGregorian, todayISO, weekdayName } from '@/lib/reminders/dates';
import { formatHebrewDate } from '@/lib/reminders/hebrew';
import { describeRepeat, nextOccurrences, reminderState } from '@/lib/reminders/recurrence';
import {
  clearReminderSnooze,
  deleteReminder,
  markReminderDone,
  snoozeReminder,
  undoReminderDone,
} from '@/lib/reminders/actions';
import { DONOR_MESSAGE_LABELS, STATUS_STYLES, SOURCE_LABELS } from './reminderUi';

type Props = {
  reminder: Reminder;
  donor: Donor | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (reminder: Reminder) => void;
  onViewDonor: (donor: Donor) => void;
};

/** כרטיס תזכורת: פרטים, מופעים קרובים, בוצע / דחייה / עריכה / מחיקה */
export default function ReminderCardModal({ reminder, donor, onClose, onChanged, onEdit, onViewDonor }: Props) {
  const { requirePermission } = useAuth();
  const today = todayISO();
  const state = reminderState(reminder, today);
  const [busy, setBusy] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(addDaysISO(today, 1));

  const donorName = donor ? `${donor.first_name_he || ''} ${donor.last_name_he || ''}`.trim() : 'ללא תורם';
  const style = STATUS_STYLES[state.status];
  const upcoming = state.occurrence ? nextOccurrences(reminder, addDaysISO(state.occurrence, 1), 4) : [];

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, close = false) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      toast.error(`הפעולה נכשלה: ${'error' in res ? res.error : ''}`);
      return;
    }
    toast.success(success);
    onChanged();
    if (close) onClose();
  }

  const snoozeTo = (iso: string) => {
    if (!requirePermission('reminders_edit')) return;
    void run(() => snoozeReminder(reminder, iso), `נדחה ל-${formatGregorian(iso)}`, true);
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className={`p-5 border-b ${style.header}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${style.badge}`}>
                  {style.label}
                </span>
                {reminder.source && reminder.source !== 'manual' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border bg-purple-50 text-purple-700 border-purple-200">
                    <Sparkles className="w-3 h-3" />
                    {SOURCE_LABELS[reminder.source] ?? 'אוטומטי'}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-800">{reminder.title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {/* מועד */}
          {state.effectiveDate ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CalendarDays className="w-4 h-4 text-purple-600" />
                יום {weekdayName(state.effectiveDate)}, {formatHebrewDate(state.effectiveDate)}
              </div>
              <div className="text-slate-600 pr-6" dir="rtl">
                {formatGregorian(state.effectiveDate)}
                {state.daysUntil !== null && (
                  <span className="text-slate-400">
                    {' '}
                    ·{' '}
                    {state.daysUntil === 0
                      ? 'היום'
                      : state.daysUntil > 0
                        ? `בעוד ${state.daysUntil} ימים`
                        : `לפני ${-state.daysUntil} ימים`}
                  </span>
                )}
              </div>
              {state.snoozed && state.occurrence && (
                <div className="flex items-center gap-1.5 text-amber-700 pr-6 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  נדחה (המועד המקורי: {formatGregorian(state.occurrence)})
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 font-medium">
              כל המופעים של התזכורת בוצעו.
            </div>
          )}

          {/* פרטים */}
          <div className="space-y-2 text-slate-700">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-slate-400" />
              {describeRepeat(reminder)}
              {reminder.date_type === 'hebrew' && <span className="text-xs text-purple-700">(תאריך עברי)</span>}
            </div>
            {(reminder.lead_days ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                מופיעה כפעילה {reminder.lead_days} ימים לפני
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              {donor ? (
                <button onClick={() => onViewDonor(donor)} className="text-blue-600 hover:underline font-medium">
                  {donorName}
                </button>
              ) : (
                <span className="text-slate-400">ללא תורם מקושר</span>
              )}
            </div>
            {(reminder.notify_email || (reminder.donor_message_type && reminder.donor_message_type !== 'none')) && (
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="space-y-0.5">
                  {reminder.notify_email && <div>מייל למנהל העמותה</div>}
                  {reminder.donor_message_type && reminder.donor_message_type !== 'none' && (
                    <div>{DONOR_MESSAGE_LABELS[reminder.donor_message_type]} (ממתין לאישור)</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {reminder.description && (
            <p className="whitespace-pre-line bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-700">
              {reminder.description}
            </p>
          )}

          {(reminder.attachments?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Paperclip className="w-4 h-4 text-slate-400" />
                קבצים
              </div>
              {reminder.attachments!.map((f, i) => (
                <a
                  key={i}
                  href="#"
                  onClick={(e) => openSecureFile(e, f.url)}
                  className="block text-blue-600 hover:underline truncate pr-6"
                >
                  {f.name}
                </a>
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-1">
              <div className="font-bold text-slate-700">המופעים הבאים</div>
              <ul className="text-slate-600 space-y-0.5 pr-1">
                {upcoming.map((d) => (
                  <li key={d}>
                    {formatHebrewDate(d)} · {formatGregorian(d)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* דחייה */}
          {showSnooze && state.occurrence && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="font-bold text-amber-900">לדחות ל...</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'מחר', days: 1 },
                  { label: 'בעוד 3 ימים', days: 3 },
                  { label: 'בעוד שבוע', days: 7 },
                  { label: 'בעוד חודש', days: 30 },
                ].map((o) => (
                  <button
                    key={o.days}
                    disabled={busy}
                    onClick={() => snoozeTo(addDaysISO(today, o.days))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:bg-amber-100 text-xs font-bold text-amber-900"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <DateInput value={snoozeDate} min={today} onChange={setSnoozeDate} className="max-w-[11rem]" />
                <button
                  disabled={busy || !snoozeDate}
                  onClick={() => snoozeTo(snoozeDate)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  דחה לתאריך הזה
                </button>
              </div>
            </div>
          )}
        </div>

        {/* פעולות */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
          {state.occurrence && (
            <Protect permId="reminders_edit">
              <button
                disabled={busy}
                onClick={() => run(() => markReminderDone(reminder), 'סומן כבוצע', true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                בוצע
              </button>
            </Protect>
          )}

          {state.occurrence && (
            <Protect permId="reminders_edit">
              <button
                disabled={busy}
                onClick={() => setShowSnooze((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-sm font-bold"
              >
                <Clock className="w-4 h-4" />
                דחייה
              </button>
            </Protect>
          )}

          {state.snoozed && (
            <Protect permId="reminders_edit">
              <button
                disabled={busy}
                onClick={() => run(() => clearReminderSnooze(reminder), 'הדחייה בוטלה')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm"
              >
                <AlarmClockOff className="w-4 h-4" />
                בטל דחייה
              </button>
            </Protect>
          )}

          {reminder.completed_through && (
            <Protect permId="reminders_edit">
              <button
                disabled={busy}
                onClick={() => run(() => undoReminderDone(reminder), 'סימון הבוצע האחרון בוטל')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm"
              >
                <Undo2 className="w-4 h-4" />
                בטל בוצע אחרון
              </button>
            </Protect>
          )}

          <div className="flex-1" />

          <Protect permId="reminders_edit">
            <button
              onClick={() => onEdit(reminder)}
              className="p-2 rounded-xl text-slate-500 hover:text-purple-700 hover:bg-purple-50"
              title="עריכה"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </Protect>

          <Protect permId="reminders_delete">
            <button
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`למחוק את התזכורת "${reminder.title}"?`)) return;
                void run(() => deleteReminder(reminder, donorName), 'התזכורת נמחקה', true);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="מחיקה"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Protect>
        </div>
      </div>
    </div>
  );
}
