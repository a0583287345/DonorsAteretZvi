'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, CalendarRange, Repeat, Users, Plus, Bell, Inbox, Mail, AlertTriangle, ChevronLeft,
} from 'lucide-react';
import type { Donation, Donor, Reminder } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';
import { Protect, LockedText } from '@/components/Protect';
import { donorDisplayName } from '@/lib/import/donorMatch';
import { formatNumber, getPaymentMethodLabel } from '@/components/donations/donationUtils';
import { todayISO } from '@/lib/reminders/dates';
import { reminderState } from '@/lib/reminders/recurrence';
import { STATUS_STYLES } from '@/components/reminders/reminderUi';
import {
  addMonthsISO,
  chargeStatsByRecurring,
  chargesInMonth,
  isEndingSoon,
  monthKey,
  sumByCurrency,
  type RecurringRow,
} from '@/lib/recurring/schedule';
import RecurringList from '@/components/recurring/RecurringList';
import RecurringFormModal from '@/components/recurring/RecurringFormModal';
import { HorizontalBars, MonthlyBars, type MonthPoint } from './Charts';

type Props = {
  donors: Donor[];
  donations: Donation[];
  onViewDonor: (donor: Donor) => void;
  onGoToTab: (tab: 'donors' | 'donations' | 'reminders') => void;
};

type RecurringFilter = 'active' | 'ending' | 'failed' | 'all';

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const monthLabel = (ym: string) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

type Totals = { currency: string; total: number }[];

function Amounts({ totals, empty = '0' }: { totals: Totals; empty?: string }) {
  if (totals.length === 0) return <div className="text-xl font-bold text-slate-800">{empty}</div>;
  return (
    <div className="space-y-0.5">
      {totals.map((t, i) => (
        <div key={t.currency} className={i === 0 ? 'text-xl font-bold text-slate-800' : 'text-sm font-semibold text-slate-600'}>
          {formatNumber(t.total)} <span className="text-xs font-medium text-slate-400">{t.currency}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ icon, title, children, foot }: { icon: React.ReactNode; title: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {title}
      </div>
      <div className="flex-1">{children}</div>
      {foot && <div className="text-[11px] text-slate-500">{foot}</div>}
    </div>
  );
}

/** דשבורד: סיכומים, הוראות קבע, גרפים ו"מה מחכה לי" */
export default function DashboardTab({ donors, donations, onViewDonor, onGoToTab }: Props) {
  const { hasPermission, access } = useAuth();
  const canViewAmount = hasPermission('donations_view_amount');
  const amountLocked = access('donations_view_amount') === 'locked';
  const canViewDonations = hasPermission('donations_view');
  const canViewReminders = hasPermission('reminders_view');
  const canMerge = hasPermission('donors_merge');
  const canManage = hasPermission('manage_users');

  const today = todayISO();
  const thisMonth = monthKey(today);
  const lastMonth = monthKey(addMonthsISO(`${thisMonth}-01`, -1));
  const thisYear = today.slice(0, 4);

  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pendingReview, setPendingReview] = useState(0);
  const [pendingEmails, setPendingEmails] = useState(0);
  const [filter, setFilter] = useState<RecurringFilter>('active');
  const [editing, setEditing] = useState<RecurringRow | 'new' | null>(null);
  const [chartCurrency, setChartCurrency] = useState('ILS');

  const load = useCallback(async () => {
    const [rec, rem, review, emails] = await Promise.all([
      canViewDonations
        ? supabase.from('recurring_donations').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as RecurringRow[] }),
      canViewReminders ? supabase.from('reminders').select('*') : Promise.resolve({ data: [] as Reminder[] }),
      canMerge
        ? supabase.from('import_review').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        : Promise.resolve({ count: 0 }),
      canManage
        ? supabase.from('email_outbox').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval')
        : Promise.resolve({ count: 0 }),
    ]);
    setRecurring((rec.data ?? []) as RecurringRow[]);
    setReminders((rem.data ?? []) as Reminder[]);
    setPendingReview(review.count ?? 0);
    setPendingEmails(emails.count ?? 0);
  }, [canViewDonations, canViewReminders, canMerge, canManage]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const donorsById = useMemo(() => new Map(donors.map((d) => [d.id, d])), [donors]);
  // חיוב ראשון ומספר חיובים לכל הוראה מנדרים
  const chargeStats = useMemo(() => chargeStatsByRecurring(donations), [donations]);

  // ---------- סיכומים ----------
  const stats = useMemo(() => {
    const inMonth = (ym: string) => donations.filter((d) => d.donation_date && monthKey(d.donation_date) === ym);
    const month = inMonth(thisMonth);
    const prev = inMonth(lastMonth);
    const year = donations.filter((d) => d.donation_date?.startsWith(thisYear));
    const sum = (list: Donation[]) => sumByCurrency(list, (d) => d.amount, (d) => d.currency);

    const activeRec = recurring.filter((r) => r.status === 'active');
    const expected = activeRec.filter((r) => chargesInMonth(r, thisMonth));
    const receivedNedarim = month.filter((d) => d.external_source === 'nedarim' && !!d.recurring_external_id);

    return {
      month: sum(month),
      monthCount: month.length,
      prev: sum(prev),
      prevCount: prev.length,
      year: sum(year),
      yearCount: year.length,
      expected: sumByCurrency(expected, (r) => r.amount, (r) => r.currency),
      expectedCount: expected.length,
      receivedNedarimCount: receivedNedarim.length,
      activeRecurringDonors: new Set(activeRec.map((r) => r.donor_id).filter(Boolean)).size,
      newDonors: donors.filter((d) => d.created_at && monthKey(d.created_at) === thisMonth).length,
    };
  }, [donations, recurring, donors, thisMonth, lastMonth, thisYear]);

  // ---------- הוראות קבע ----------
  const recurringRows = useMemo(() => {
    switch (filter) {
      case 'active':
        return recurring.filter((r) => r.status === 'active');
      case 'ending':
        return recurring.filter((r) => isEndingSoon(r, today));
      case 'failed':
        return recurring.filter((r) => r.status === 'failed');
      default:
        return recurring;
    }
  }, [recurring, filter, today]);

  const counts = useMemo(
    () => ({
      active: recurring.filter((r) => r.status === 'active').length,
      ending: recurring.filter((r) => isEndingSoon(r, today)).length,
      failed: recurring.filter((r) => r.status === 'failed').length,
      all: recurring.length,
    }),
    [recurring, today]
  );

  // ---------- גרפים ----------
  const currencies = useMemo(() => {
    const set = new Set(donations.map((d) => d.currency || 'ILS'));
    return ['ILS', 'USD', 'EUR'].filter((c) => set.has(c)).concat([...set].filter((c) => !['ILS', 'USD', 'EUR'].includes(c)));
  }, [donations]);
  const currency = currencies.includes(chartCurrency) ? chartCurrency : (currencies[0] ?? 'ILS');

  const charts = useMemo(() => {
    const ofCurrency = donations.filter((d) => (d.currency || 'ILS') === currency && d.donation_date);
    const months: MonthPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const ym = monthKey(addMonthsISO(`${thisMonth}-01`, -i));
      const list = ofCurrency.filter((d) => monthKey(d.donation_date!) === ym);
      months.push({ key: ym, label: monthLabel(ym), total: list.reduce((s, d) => s + Number(d.amount || 0), 0), count: list.length });
    }

    const yearList = ofCurrency.filter((d) => d.donation_date!.startsWith(thisYear));
    const byMethod = new Map<string, { total: number; count: number }>();
    const byDonor = new Map<string, { total: number; count: number }>();
    for (const d of yearList) {
      const m = d.payment_method || 'other';
      const mv = byMethod.get(m) ?? { total: 0, count: 0 };
      byMethod.set(m, { total: mv.total + Number(d.amount || 0), count: mv.count + 1 });
      if (d.donor_id) {
        const dv = byDonor.get(d.donor_id) ?? { total: 0, count: 0 };
        byDonor.set(d.donor_id, { total: dv.total + Number(d.amount || 0), count: dv.count + 1 });
      }
    }
    const methods = [...byMethod.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([m, v]) => ({ key: m, label: getPaymentMethodLabel(m), value: v.total, sub: `${v.count} תרומות` }));
    const top = [...byDonor.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, v]) => {
        const donor = donorsById.get(id);
        return {
          key: id,
          label: donor ? donorDisplayName(donor) : 'תורם שנמחק',
          value: v.total,
          sub: `${v.count} תרומות`,
          onClick: donor ? () => onViewDonor(donor) : undefined,
        };
      });
    return { months, methods, top };
  }, [donations, currency, thisMonth, thisYear, donorsById, onViewDonor]);

  // ---------- מה מחכה לי ----------
  const waiting = useMemo(() => {
    return reminders
      .map((r) => ({ r, state: reminderState(r, today) }))
      .filter(({ state }) => state.status === 'overdue' || state.status === 'today' || state.status === 'soon' || (state.daysUntil !== null && state.daysUntil <= 7 && state.status !== 'done'))
      .sort((a, b) => (a.state.effectiveDate ?? '').localeCompare(b.state.effectiveDate ?? ''))
      .slice(0, 10);
  }, [reminders, today]);

  const filterChip = (id: RecurringFilter, label: string, n: number, tone = '') => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
        filter === id ? 'bg-blue-600 text-white border-blue-600' : `bg-white border-slate-200 text-slate-600 hover:bg-slate-50 ${tone}`
      }`}
    >
      {label} ({n})
    </button>
  );

  const prevFoot =
    stats.prevCount > 0 || stats.prev.length > 0
      ? `חודש קודם: ${stats.prev.map((t) => `${formatNumber(t.total)} ${t.currency}`).join(' · ') || '0'} (${stats.prevCount} תרומות)`
      : 'חודש קודם: אין תרומות';

  return (
    <div className="p-4 md:p-5 space-y-5" dir="rtl">
      <div>
        <h2 className="text-lg font-bold text-slate-800">דשבורד</h2>
        <p className="text-xs text-slate-400 mt-1">
          {monthLabel(thisMonth)} · סכומים לפי מטבע (לא מחברים מטבעות שונים)
        </p>
      </div>

      {/* כרטיסי סיכום */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile icon={<TrendingUp className="w-4 h-4 text-blue-600" />} title="תרומות החודש" foot={canViewAmount ? prevFoot : `חודש קודם: ${stats.prevCount} תרומות`}>
          {canViewAmount ? <Amounts totals={stats.month} /> : amountLocked ? <LockedText /> : null}
          <div className="text-xs text-slate-500 mt-1">{stats.monthCount} תרומות</div>
        </Tile>

        <Tile icon={<CalendarRange className="w-4 h-4 text-blue-600" />} title={`מתחילת ${thisYear}`}>
          {canViewAmount ? <Amounts totals={stats.year} /> : amountLocked ? <LockedText /> : null}
          <div className="text-xs text-slate-500 mt-1">{stats.yearCount} תרומות</div>
        </Tile>

        <Tile
          icon={<Repeat className="w-4 h-4 text-blue-600" />}
          title="צפי החודש מהוראות קבע"
          foot={stats.receivedNedarimCount > 0 ? `התקבלו החודש דרך נדרים פלוס: ${stats.receivedNedarimCount} חיובים` : undefined}
        >
          {canViewAmount ? <Amounts totals={stats.expected} /> : amountLocked ? <LockedText /> : null}
          <div className="text-xs text-slate-500 mt-1">{stats.expectedCount} הוראות פעילות שמחייבות החודש</div>
        </Tile>

        <Tile icon={<Users className="w-4 h-4 text-blue-600" />} title="תורמים">
          <div className="text-xl font-bold text-slate-800">{donors.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.newDonors} חדשים החודש · {stats.activeRecurringDonors} עם הוראת קבע פעילה
          </div>
        </Tile>
      </div>

      {/* מה מחכה לי */}
      {(canViewReminders || pendingReview > 0 || pendingEmails > 0) && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            מה מחכה לי
          </h3>
          <div className="flex flex-wrap gap-2">
            {pendingReview > 0 && (
              <button
                type="button"
                onClick={() => onGoToTab('donors')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
              >
                <Inbox className="w-4 h-4" />
                {pendingReview} תורמים מיובאים לבדיקה (בירור כפילויות)
              </button>
            )}
            {pendingEmails > 0 && (
              <a
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              >
                <Mail className="w-4 h-4" />
                {pendingEmails} מיילים לתורמים ממתינים לאישור
              </a>
            )}
          </div>
          {canViewReminders &&
            (waiting.length === 0 ? (
              <p className="text-xs text-slate-400">אין תזכורות לשבוע הקרוב</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {waiting.map(({ r, state }) => {
                  const style = STATUS_STYLES[state.status];
                  const donor = r.donor_id ? donorsById.get(r.donor_id) : undefined;
                  const date = state.effectiveDate;
                  return (
                    <li key={r.id} className="flex items-center gap-2 py-2 text-xs">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] ${style.badge}`}>{style.label}</span>
                      <span className="flex-1 truncate text-slate-700">
                        {r.title}
                        {donor && !r.title.includes(donorDisplayName(donor)) ? ` – ${donorDisplayName(donor)}` : ''}
                      </span>
                      {date && (
                        <span className="shrink-0 text-slate-500">
                          {date.slice(8, 10)}/{date.slice(5, 7)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          {canViewReminders && (
            <button type="button" onClick={() => onGoToTab('reminders')} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              לכל התזכורות
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </section>
      )}

      {/* הוראות קבע */}
      {canViewDonations && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-blue-600" />
              הוראות קבע
            </h3>
            <Protect permId="donations_create">
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                הוראת קבע ידנית
              </button>
            </Protect>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterChip('active', 'פעילות', counts.active)}
            {filterChip('ending', 'מסתיימות בקרוב', counts.ending)}
            {filterChip('failed', 'נכשלו', counts.failed, counts.failed ? 'text-red-600' : '')}
            {filterChip('all', 'הכול', counts.all)}
          </div>
          {counts.failed > 0 && filter !== 'failed' && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-4 h-4" />
              {counts.failed} הוראות קבע נכשלו – כדאי ליצור קשר עם התורמים
            </p>
          )}
          <RecurringList
            rows={recurringRows}
            donorsById={donorsById}
            chargeStats={chargeStats}
            today={today}
            canViewAmount={canViewAmount}
            onOpen={(r) => setEditing(r)}
            onOpenDonor={onViewDonor}
            emptyText={filter === 'all' ? 'אין עדיין הוראות קבע' : 'אין הוראות קבע בקטגוריה הזו'}
          />
        </section>
      )}

      {/* גרפים */}
      {canViewDonations && canViewAmount && (
        <section className="space-y-3">
          {currencies.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">מטבע בגרפים:</span>
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChartCurrency(c)}
                  className={`px-2.5 py-1 rounded-lg border ${
                    c === currency ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 xl:col-span-2">
              <h3 className="text-sm font-bold text-slate-800 mb-3">תרומות לפי חודש – 12 חודשים ({currency})</h3>
              <MonthlyBars points={charts.months} currency={currency} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">לפי אמצעי תשלום – {thisYear}</h3>
              <HorizontalBars items={charts.methods} unit={currency} />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">10 התורמים הגדולים – {thisYear} ({currency})</h3>
            <HorizontalBars items={charts.top} unit={currency} />
          </div>
        </section>
      )}

      {editing && (
        <RecurringFormModal
          key={editing === 'new' ? 'new' : editing.id}
          recurring={editing === 'new' ? null : editing}
          donors={donors}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
