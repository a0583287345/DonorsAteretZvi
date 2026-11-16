'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Protect } from '@/components/Protect';
import { toast } from '@/components/Toaster';
import {
  Bell, Plus, RefreshCw, Search, List, CalendarDays, Repeat, Sparkles, Check, Clock, User, Loader2, Mail,
} from 'lucide-react';
import type { Donor, Reminder } from '@/types/donor';
import { formatGregorian, todayISO } from '@/lib/reminders/dates';
import { formatHebrewDate } from '@/lib/reminders/hebrew';
import { reminderState, type ReminderState, type ReminderStatus } from '@/lib/reminders/recurrence';
import { markReminderDone } from '@/lib/reminders/actions';
import ReminderCardModal from './reminders/ReminderCardModal';
import HebrewCalendarView from './reminders/HebrewCalendarView';
import EmailOutboxPanel from './reminders/EmailOutboxPanel';
import { SOURCE_LABELS, STATUS_STYLES } from './reminders/reminderUi';

export type { Reminder };

interface RemindersTabProps {
  donorMap: Map<string, Donor>;
  onAddReminder: (donorId?: string, e?: React.MouseEvent) => void;
  onEditReminder: (reminder: Reminder, e?: React.MouseEvent) => void;
  onViewDonor: (donor: Donor) => void;
  /** משתנה אחרי שמירה בטופס – גורם לטעינה מחדש */
  refreshKey?: number;
}

type Filter = 'active' | ReminderStatus | 'all';

async function loadReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase.from('reminders').select('*');
  if (error) {
    console.error('שגיאה בטעינת תזכורות:', error.message);
    toast.error('שגיאה בטעינת התזכורות');
    return [];
  }
  return (data || []) as unknown as Reminder[];
}

/** לשונית התזכורות: רשימה לפי מצב או לוח שנה עברי */
export default function RemindersTab({
  donorMap,
  onAddReminder,
  onEditReminder,
  onViewDonor,
  refreshKey = 0,
}: RemindersTabProps) {
  const { loadingPerms, access } = usePermissions();
  const emailsAccess = access('emails_view');
  const canViewEmails = emailsAccess === 'allowed';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [view, setView] = useState<'list' | 'calendar' | 'emails'>('list');
  // מספר ההודעות לתורמים שממתינות לאישור (תג על כפתור "מיילים")
  const [pendingEmails, setPendingEmails] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quickDoneId, setQuickDoneId] = useState<string | null>(null);

  const today = todayISO();

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setReminders(await loadReminders());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadReminders().then((data) => {
      if (cancelled) return;
      setReminders(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!canViewEmails) return;
    let cancelled = false;
    supabase
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval')
      .then(({ count }) => {
        if (!cancelled) setPendingEmails(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewEmails, refreshKey]);

  const donorName = useCallback(
    (id: string | null) => {
      const d = id ? donorMap.get(id) : null;
      return d ? `${d.first_name_he || ''} ${d.last_name_he || ''}`.trim() : '';
    },
    [donorMap]
  );

  // מצב כל תזכורת ביחס להיום, ממוין לפי התאריך בפועל
  const rows = useMemo(() => {
    return reminders
      .map((r) => ({ r, s: reminderState(r, today) }))
      .sort((a, b) => {
        const order = STATUS_STYLES[a.s.status].order - STATUS_STYLES[b.s.status].order;
        if (order !== 0) return order;
        return (a.s.effectiveDate ?? '9999').localeCompare(b.s.effectiveDate ?? '9999');
      });
  }, [reminders, today]);

  const counts = useMemo(() => {
    const c: Record<ReminderStatus, number> = { overdue: 0, today: 0, soon: 0, scheduled: 0, done: 0 };
    for (const { s } of rows) c[s.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(({ r, s }) => {
      if (filter === 'active' && !['overdue', 'today', 'soon'].includes(s.status)) return false;
      if (filter !== 'active' && filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return [r.title, r.description || '', donorName(r.donor_id)].some((f) => f.toLowerCase().includes(q));
    });
  }, [rows, filter, searchQuery, donorName]);

  const openReminder = reminders.find((r) => r.id === openId) ?? null;

  async function quickDone(r: Reminder, e: React.MouseEvent) {
    e.stopPropagation();
    setQuickDoneId(r.id);
    const res = await markReminderDone(r);
    setQuickDoneId(null);
    if (!res.ok) {
      toast.error(`הפעולה נכשלה: ${'error' in res ? res.error : ''}`);
      return;
    }
    toast.success('סומן כבוצע');
    void fetchReminders();
  }

  const FILTERS: { key: Filter; label: string; count?: number; tone: string }[] = [
    { key: 'active', label: 'לטיפול', count: counts.overdue + counts.today + counts.soon, tone: 'text-purple-700' },
    { key: 'overdue', label: 'באיחור', count: counts.overdue, tone: 'text-red-600' },
    { key: 'scheduled', label: 'מתוכננות', count: counts.scheduled, tone: 'text-blue-600' },
    { key: 'done', label: 'הושלמו', count: counts.done, tone: 'text-emerald-600' },
    { key: 'all', label: 'הכל', count: rows.length, tone: 'text-slate-700' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      {/* כותרת ופעולות */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">תזכורות</h2>
            <p className="text-xs text-slate-500">ימי הולדת, יארצייטים, חידושי הוראות קבע ומשימות</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${view === 'list' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <List className="w-4 h-4" />
              רשימה
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${view === 'calendar' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <CalendarDays className="w-4 h-4" />
              לוח שנה
            </button>
            {emailsAccess !== 'hidden' && (
              <Protect permId="emails_view" mode="action">
                <button
                  onClick={() => setView('emails')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${view === 'emails' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Mail className="w-4 h-4" />
                  מיילים
                  {pendingEmails > 0 && (
                    <span
                      className={`min-w-5 px-1.5 rounded-full text-[10px] leading-5 ${view === 'emails' ? 'bg-white text-purple-700' : 'bg-amber-500 text-white'}`}
                      title="ממתינים לאישור"
                    >
                      {pendingEmails}
                    </span>
                  )}
                </button>
              </Protect>
            )}
          </div>

          <button
            onClick={fetchReminders}
            disabled={loading}
            className="p-2.5 text-slate-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition shadow-sm"
            title="רענן"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>

          <Protect permId="reminders_create">
            <button
              onClick={(e) => onAddReminder(undefined, e)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              תזכורת חדשה
            </button>
          </Protect>
        </div>
      </div>

      {loading || loadingPerms ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          טוען תזכורות...
        </div>
      ) : view === 'emails' && canViewEmails ? (
        <EmailOutboxPanel onPendingCount={setPendingEmails} />
      ) : view === 'calendar' ? (
        <HebrewCalendarView reminders={reminders} donorMap={donorMap} today={today} onOpen={(r) => setOpenId(r.id)} />
      ) : (
        <>
          {/* סינון */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                    filter === f.key ? 'bg-white border-purple-300 shadow-sm ring-1 ring-purple-200' : 'bg-slate-50 border-slate-200 hover:bg-white'
                  }`}
                >
                  <span className="text-slate-600">{f.label}</span>{' '}
                  <span className={f.tone}>{f.count}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי נושא, פירוט או תורם..."
                className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* רשימה */}
          {filtered.length === 0 ? (
            <div className="text-center py-14 bg-white border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500">
              {filter === 'active' ? 'אין תזכורות לטיפול כרגע 🎉' : 'לא נמצאו תזכורות.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(({ r, s }) => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  state={s}
                  donorName={donorName(r.donor_id)}
                  busy={quickDoneId === r.id}
                  onOpen={() => setOpenId(r.id)}
                  onDone={(e) => quickDone(r, e)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {openReminder && (
        <ReminderCardModal
          reminder={openReminder}
          donor={openReminder.donor_id ? donorMap.get(openReminder.donor_id) ?? null : null}
          onClose={() => setOpenId(null)}
          onChanged={fetchReminders}
          onEdit={(r) => {
            setOpenId(null);
            onEditReminder(r);
          }}
          onViewDonor={(d) => {
            setOpenId(null);
            onViewDonor(d);
          }}
        />
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  state,
  donorName,
  busy,
  onOpen,
  onDone,
}: {
  reminder: Reminder;
  state: ReminderState;
  donorName: string;
  busy: boolean;
  onOpen: () => void;
  onDone: (e: React.MouseEvent) => void;
}) {
  const style = STATUS_STYLES[state.status];
  const when =
    state.daysUntil === null
      ? ''
      : state.daysUntil === 0
        ? 'היום'
        : state.daysUntil === 1
          ? 'מחר'
          : state.daysUntil > 0
            ? `בעוד ${state.daysUntil} ימים`
            : `באיחור ${-state.daysUntil} ימים`;

  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3 bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm rounded-xl px-3 py-2.5 cursor-pointer transition"
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`font-bold text-sm ${state.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {reminder.title}
          </span>
          {reminder.source && reminder.source !== 'manual' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
              <Sparkles className="w-3 h-3" />
              {SOURCE_LABELS[reminder.source] ?? 'אוטומטי'}
            </span>
          )}
          {reminder.repeat_unit && reminder.repeat_unit !== 'none' && (
            <Repeat className="w-3.5 h-3.5 text-slate-400" aria-label="חוזרת" />
          )}
          {state.snoozed && <Clock className="w-3.5 h-3.5 text-amber-600" aria-label="נדחתה" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
          {state.effectiveDate && (
            <span>
              {formatHebrewDate(state.effectiveDate)} · {formatGregorian(state.effectiveDate)}
            </span>
          )}
          {donorName && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {donorName}
            </span>
          )}
        </div>
      </div>

      {when && (
        <span className={`hidden sm:inline-flex text-[11px] font-bold px-2 py-1 rounded-lg border ${style.badge}`}>{when}</span>
      )}

      {state.occurrence && (
        <Protect permId="reminders_edit">
          <button
            onClick={onDone}
            disabled={busy}
            className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition"
            title="סמן כבוצע"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
        </Protect>
      )}
    </div>
  );
}
