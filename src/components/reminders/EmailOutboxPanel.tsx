'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Clock, Loader2, Mail, Pause, Play, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callServerApi } from '@/lib/apiClient';
import { logActivity } from '@/lib/logger';
import { useAuth } from '@/components/AuthContext';
import { Protect } from '@/components/Protect';
import { toast } from '@/components/Toaster';
import type { Tables } from '@/types/database';

// =====================================================================
// תור המיילים: ממתינים לאישור / לטיפול, היסטוריה, והרצת הבדיקה היומית.
// מוצג בלשונית התזכורות (emails_view) ובפאנל הניהול → מיילים.
// אישור / דחייה / הרצה דורשים emails_approve (נאכף גם ב-RLS וב-API).
// =====================================================================

type OutboxRow = Tables<'email_outbox'>;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_approval: { label: 'ממתין לאישור', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  approved: { label: 'מאושר – ממתין לשליחה', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent: { label: 'נשלח', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'נכשל', className: 'bg-red-50 text-red-700 border-red-200' },
  rejected: { label: 'נדחה', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  paused: { label: 'מושהה', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { label: 'בוטל', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** מייל שעוד לא נשלח – אפשר להשהות / לבטל / למחוק */
const UNSENT = new Set(['pending_approval', 'approved', 'failed', 'paused']);

/** פעולות על מייל שלא נשלח: הסטטוס החדש, הודעה ורישום ליומן */
const STATUS_ACTIONS = {
  pause: { status: 'paused', log: 'EMAIL_PAUSED', verb: 'השהה', toast: 'המייל הושהה – לא יישלח עד שתמשיך' },
  cancel: { status: 'cancelled', log: 'EMAIL_CANCELLED', verb: 'ביטל', toast: 'המייל בוטל' },
  delete: { status: 'deleted', log: 'EMAIL_DELETED', verb: 'מחק', toast: 'המייל נמחק' },
} as const;

/** המשך אחרי השהיה: הודעה לתורם שלא אושרה חוזרת לאישור, כל השאר – מאושר לשליחה */
const resumeStatus = (m: Tables<'email_outbox'>) =>
  m.kind === 'donor' && !m.decided_at ? 'pending_approval' : 'approved';

const KIND_LABELS: Record<string, string> = { manager: 'למנהל', donor: 'לתורם', test: 'בדיקה' };

const emailApi = <T,>(action: string) => callServerApi<T>('/api/admin/email', { action });

export default function EmailOutboxPanel({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const { user } = useAuth();
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'pending' | 'history'>('pending');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('email_outbox')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) toast.error(`שגיאה בטעינת המיילים: ${error.message}`);
    const rows = data ?? [];
    setOutbox(rows);
    onPendingCount?.(rows.filter((m) => m.status === 'pending_approval').length);
    setLoading(false);
  }, [onPendingCount]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setBusy(null);
    }
  }

  const runNow = () =>
    run('run', async () => {
      const r = await emailApi<{
        queued: { manager: number; donor: number };
        sent: number;
        failed: number;
        waiting: number;
        reason: string | null;
      }>('run_now');
      const parts = [
        `הוכנו ${r.queued.manager} מיילים למנהל ו-${r.queued.donor} לתורמים`,
        `נשלחו ${r.sent}`,
        r.failed ? `נכשלו ${r.failed}` : '',
        r.reason ? `ממתינים ${r.waiting} (${r.reason})` : '',
      ].filter(Boolean);
      toast.info(parts.join(' · '));
      await load();
    });

  const decide = (row: OutboxRow, approve: boolean) =>
    run(`decide-${row.id}`, async () => {
      const { error } = await supabase
        .from('email_outbox')
        .update({
          status: approve ? 'approved' : 'rejected',
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw new Error(error.message);
      await logActivity(
        approve ? 'EMAIL_APPROVED' : 'EMAIL_REJECTED',
        'email_outbox',
        `${approve ? 'אישר' : 'דחה'} הודעה לתורם (${row.to_email}): ${row.subject}`
      );
      // אם הגיע מועד השליחה – שולחים מיד
      if (approve) {
        const r = await emailApi<{ sent: number; reason: string | null }>('send_approved');
        toast.success(r.sent ? 'ההודעה אושרה ונשלחה' : `ההודעה אושרה${r.reason ? ` – ${r.reason}` : ' ותישלח ביום המועד'}`);
      } else {
        toast.info('ההודעה נדחתה');
      }
      await load();
    });

  const retry = (row: OutboxRow) =>
    run(`decide-${row.id}`, async () => {
      const { error } = await supabase.from('email_outbox').update({ status: 'approved', error: null }).eq('id', row.id);
      if (error) throw new Error(error.message);
      await logActivity('EMAIL_RETRY', 'email_outbox', `שליחה חוזרת של מייל ל-${row.to_email}: ${row.subject}`);
      const r = await emailApi<{ sent: number; failed: number; reason: string | null }>('send_approved');
      toast.info(r.sent ? 'נשלח' : r.reason || 'השליחה נכשלה שוב');
      await load();
    });

  /** השהיה / ביטול / מחיקה – רק כל עוד המייל לא נשלח (התנאי גם בעדכון עצמו) */
  const changeStatus = (row: OutboxRow, action: keyof typeof STATUS_ACTIONS) =>
    run(`decide-${row.id}`, async () => {
      const a = STATUS_ACTIONS[action];
      if (action === 'delete' && !window.confirm(`למחוק את המייל "${row.subject}"? הוא לא יישלח ולא יוכן שוב.`)) return;
      const { data, error } = await supabase
        .from('email_outbox')
        // בהשהיה לא נוגעים ב-decided_at: לפיו יודעים אם הודעה לתורם כבר אושרה (בהמשך)
        .update(
          action === 'pause'
            ? { status: a.status }
            : { status: a.status, decided_by: user?.id ?? null, decided_at: new Date().toISOString() }
        )
        .eq('id', row.id)
        .in('status', [...UNSENT])
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('המייל כבר נשלח או שהמצב שלו השתנה – מרענן');
      await logActivity(a.log, 'email_outbox', `${a.verb} מייל ${KIND_LABELS[row.kind] ?? ''} (${row.to_email}): ${row.subject}`);
      toast.info(a.toast);
    }).finally(() => void load());

  const resume = (row: OutboxRow) =>
    run(`decide-${row.id}`, async () => {
      const next = resumeStatus(row);
      const { error } = await supabase
        .from('email_outbox')
        .update({ status: next, error: null })
        .eq('id', row.id)
        .eq('status', 'paused');
      if (error) throw new Error(error.message);
      await logActivity('EMAIL_RESUMED', 'email_outbox', `המשיך מייל מושהה (${row.to_email}): ${row.subject}`);
      if (next === 'approved') {
        const r = await emailApi<{ sent: number; reason: string | null }>('send_approved');
        toast.success(r.sent ? 'המייל נשלח' : `המייל חזר לתור${r.reason ? ` – ${r.reason}` : ' ויישלח ביום המועד'}`);
      } else {
        toast.success('המייל חזר להמתנה לאישור');
      }
      await load();
    });

  const pending = outbox.filter((m) => UNSENT.has(m.status));
  const history = outbox.filter((m) => m.status === 'sent' || m.status === 'rejected' || m.status === 'cancelled');
  const awaitingApproval = outbox.filter((m) => m.status === 'pending_approval').length;
  const list = view === 'pending' ? pending : history;

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border ${active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200'}`;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 ml-auto">
          <Mail className="w-5 h-5 text-purple-600" />
          מיילים
          {awaitingApproval > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-200">
              {awaitingApproval} ממתינים לאישור
            </span>
          )}
        </h3>
        <button onClick={() => setView('pending')} className={tabClass(view === 'pending')}>
          לטיפול ({pending.length})
        </button>
        <button onClick={() => setView('history')} className={tabClass(view === 'history')}>
          היסטוריה ({history.length})
        </button>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          title="רענן"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
        </button>
        <Protect permId="emails_approve">
          <button
            onClick={runNow}
            disabled={busy === 'run'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
            title="מכין מיילים לפי התזכורות של היום ושולח את המאושרים"
          >
            {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            הרץ בדיקה יומית עכשיו
          </button>
        </Protect>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">אין מיילים להצגה.</p>
      ) : (
        <div className="space-y-2">
          {list.map((m) => {
            const st = STATUS_LABELS[m.status] ?? STATUS_LABELS.pending_approval;
            const isBusy = busy === `decide-${m.id}`;
            return (
              <details key={m.id} className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex flex-wrap items-center gap-2 p-3 cursor-pointer text-sm">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${st.className}`}>{st.label}</span>
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{KIND_LABELS[m.kind] ?? m.kind}</span>
                  <span className="font-medium text-slate-800 truncate">{m.subject}</span>
                  <span className="text-xs text-slate-500" dir="ltr">
                    {m.to_email}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 mr-auto">
                    <Clock className="w-3 h-3" />
                    {m.status === 'sent' && m.sent_at
                      ? `נשלח ${new Date(m.sent_at).toLocaleString('he-IL')}`
                      : `לשליחה ב-${new Date(m.send_on).toLocaleDateString('he-IL')}`}
                  </span>
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    {m.body}
                  </pre>
                  {m.error && <p className="text-xs text-red-600">שגיאה: {m.error}</p>}
                  <div className="flex flex-wrap gap-2">
                    {m.status === 'pending_approval' && (
                      <>
                        <Protect permId="emails_approve">
                          <button
                            onClick={() => decide(m, true)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            אשר ושלח
                          </button>
                        </Protect>
                        <Protect permId="emails_approve">
                          <button
                            onClick={() => decide(m, false)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold"
                          >
                            <X className="w-3.5 h-3.5" />
                            דחה
                          </button>
                        </Protect>
                      </>
                    )}
                    {m.status === 'failed' && (
                      <Protect permId="emails_approve">
                        <button
                          onClick={() => retry(m)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          נסה שוב
                        </button>
                      </Protect>
                    )}
                    {m.status === 'paused' && (
                      <Protect permId="emails_approve">
                        <button
                          onClick={() => resume(m)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                        >
                          <Play className="w-3.5 h-3.5" />
                          המשך
                        </button>
                      </Protect>
                    )}
                    {UNSENT.has(m.status) && (
                      <div className="flex flex-wrap gap-2 mr-auto">
                        {m.status !== 'paused' && (
                          <Protect permId="emails_approve">
                            <button
                              onClick={() => changeStatus(m, 'pause')}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-orange-50 hover:text-orange-700 text-slate-600 text-xs font-bold"
                              title="לא יישלח עד שתלחץ 'המשך'"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              השהה
                            </button>
                          </Protect>
                        )}
                        {m.status !== 'pending_approval' && (
                          <Protect permId="emails_approve">
                            <button
                              onClick={() => changeStatus(m, 'cancel')}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold"
                              title="המייל לא יישלח ויעבור להיסטוריה"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              בטל שליחה
                            </button>
                          </Protect>
                        )}
                        <Protect permId="emails_approve">
                          <button
                            onClick={() => changeStatus(m, 'delete')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-500 text-xs font-bold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            מחק
                          </button>
                        </Protect>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
