'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PlugZap, KeyRound, Save, Loader2, CheckCircle2, XCircle, Play, Copy, RefreshCw, Trash2, Info, RotateCcw, Link2,
} from 'lucide-react';
import { callServerApi } from '@/lib/apiClient';
import DateInput from '@/components/DateInput';
import { toast } from '@/components/Toaster';
import NedarimManualImport from './NedarimManualImport';

const inputClass =
  'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30';

type Counts = {
  imported: number;
  new_donor: number;
  no_donor?: number;
  review: number;
  skipped: number;
  invalid: number;
  updated: number;
  old?: number;
  errors: string[];
};
type SyncSummary = {
  ok: boolean;
  skippedReason?: string;
  error?: string;
  donations: Counts;
  recurring: Counts;
  morePending: boolean;
};
type Webhooks = {
  transactionUrl: string;
  kevaUrl: string;
  refusalUrl: string;
  signatureEnabled: boolean;
  secretHint: string;
};
type Conflict = { type: string; existing: string };
const WEBHOOK_LABELS: Record<string, string> = { Transaction: 'עסקאות', Keva: 'הקמת הוראת קבע', Siruv: 'סירובים' };

type Status = {
  enabled: boolean;
  mosadId: string | null;
  hasPassword: boolean;
  callbackKey: string | null;
  lastHistoryId: string | null;
  importFrom: string | null;
  lastSyncAt: string | null;
  lastSyncResult: SyncSummary | null;
};

const api = <T = Record<string, unknown>,>(action: string, payload: Record<string, unknown> = {}) =>
  callServerApi<T>('/api/admin/nedarim', { action, ...payload });

function describeSync(s: SyncSummary | null): string {
  if (!s) return '';
  if (s.skippedReason) return s.skippedReason;
  if (s.error) return `שגיאה: ${s.error}`;
  const d = s.donations;
  const r = s.recurring;
  return [
    `${d.imported + d.new_donor + (d.no_donor ?? 0)} תרומות חדשות`,
    d.new_donor ? `${d.new_donor} תורמים חדשים` : '',
    d.no_donor ? `${d.no_donor} ללא תורם` : '',
    r.imported + r.new_donor + (r.no_donor ?? 0) ? `${r.imported + r.new_donor + (r.no_donor ?? 0)} הוראות קבע חדשות` : '',
    r.updated ? `${r.updated} הוראות קבע עודכנו` : '',
    d.review + r.review ? `${d.review + r.review} לבדיקה` : '',
    d.old ? `${d.old} עסקאות ישנות דולגו` : '',
    d.errors.length + r.errors.length ? `${d.errors.length + r.errors.length} שגיאות` : '',
    s.morePending ? 'יש עוד – להריץ שוב' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** פאנל ניהול → נדרים פלוס: חיבור, כתובת Callback וייבוא */
export default function NedarimTab() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mosadId, setMosadId] = useState('');
  const [importFrom, setImportFrom] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [webhooks, setWebhooks] = useState<Webhooks | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<Status>('status');
      setStatus(s);
      setEnabled(s.enabled);
      setMosadId(s.mosadId ?? '');
      // ברירת מחדל: מתחילת השנה הנוכחית
      setImportFrom(s.importFrom ?? `${new Date().getFullYear()}-01-01`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const saveSettings = () =>
    run('settings', async () => {
      await api('save_settings', { enabled, mosadId, importFrom });
      toast.success('ההגדרות נשמרו');
      await load();
    });

  const savePassword = () =>
    run('password', async () => {
      await api('save_password', { password: newPassword });
      setNewPassword('');
      toast.success('סיסמת ה-API נשמרה');
      await load();
    });

  const clearPassword = () =>
    run('password', async () => {
      if (!window.confirm('למחוק את סיסמת ה-API? הייבוא היומי ייפסק.')) return;
      await api('clear_password');
      toast.success('הסיסמה נמחקה');
      await load();
    });

  const test = () =>
    run('test', async () => {
      const r = await api<{ webhooks: Webhooks }>('test');
      setWebhooks(r.webhooks);
      toast.success('החיבור לנדרים פלוס תקין');
    });

  const setupWebhooks = (force = false) =>
    run('setup', async () => {
      const r = await api<{ success: boolean; conflicts?: Conflict[]; webhooks?: Webhooks }>('setup_webhooks', {
        origin: window.location.origin,
        force,
      });
      if (!r.success && r.conflicts?.length) {
        const list = r.conflicts.map((c) => `${WEBHOOK_LABELS[c.type] ?? c.type}: ${c.existing}`).join('\n');
        const question = `בנדרים פלוס כבר מוגדרות כתובות אחרות:\n${list}\n\nלהחליף אותן בכתובת של המערכת? (הכתובות הקודמות יפסיקו לקבל עדכונים)`;
        if (window.confirm(question)) {
          setBusy(null);
          await setupWebhooks(true);
        }
        return;
      }
      if (r.webhooks) setWebhooks(r.webhooks);
      toast.success('העדכונים המיידיים הוגדרו בנדרים פלוס, כולל חתימה');
    });

  const syncNow = () =>
    run('sync', async () => {
      if ((status?.importFrom ?? null) !== (importFrom || null)) {
        toast.warning('יש לשמור קודם את תאריך ההתחלה (כפתור "שמירה")');
        return;
      }
      const r = await api<SyncSummary>('sync_now');
      if (r.ok) toast.success(describeSync(r));
      else toast.error(describeSync(r));
      await load();
    });

  const resetHistory = () =>
    run('reset', async () => {
      if (!window.confirm('לייבא שוב את כל ההיסטוריה מההתחלה? (עסקאות שכבר יובאו לא ייכנסו פעמיים)')) return;
      await api('reset_history');
      toast.info('בייבוא הבא ההיסטוריה תיקרא מההתחלה');
      await load();
    });

  const newKey = () =>
    run('key', async () => {
      if (!window.confirm('ליצור כתובת חדשה? הכתובת הקודמת תפסיק לעבוד – אחר כך יש ללחוץ שוב "הגדרה אוטומטית בנדרים פלוס".')) return;
      await api('new_key');
      toast.success('נוצרה כתובת חדשה – יש ללחוץ "הגדרה אוטומטית בנדרים פלוס"');
      await load();
    });

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  const callbackUrl =
    status?.callbackKey && typeof window !== 'undefined'
      ? `${window.location.origin}/api/nedarim/callback?key=${status.callbackKey}`
      : '';
  const ready = !!status?.hasPassword && !!status?.mosadId;
  const active = ready && !!status?.enabled;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      toast.success('הכתובת הועתקה');
    } catch {
      toast.error('ההעתקה נכשלה – אפשר לסמן ולהעתיק ידנית');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* מצב */}
      <div
        className={`flex flex-wrap items-center gap-3 p-4 rounded-2xl border ${
          active ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <PlugZap className={`w-6 h-6 ${active ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="flex-1 text-sm">
          <div className="font-bold text-slate-800">{active ? 'החיבור לנדרים פלוס פעיל' : 'החיבור לנדרים פלוס לא פעיל'}</div>
          <div className="text-slate-600">
            {!status?.mosadId
              ? 'יש להזין מספר מוסד.'
              : !status.hasPassword
                ? 'יש לשמור סיסמת API.'
                : !status.enabled
                  ? 'החיבור מוכן – יש להפעיל ולשמור.'
                  : 'ייבוא אוטומטי כל בוקר + עדכון מיידי דרך כתובת ה-Callback.'}
          </div>
          {status?.lastSyncAt && (
            <div className="text-xs text-slate-500 mt-1">
              ייבוא אחרון: {new Date(status.lastSyncAt).toLocaleString('he-IL')} – {describeSync(status.lastSyncResult)}
            </div>
          )}
        </div>
        <button
          onClick={syncNow}
          disabled={!ready || busy === 'sync'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          {busy === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          ייבוא עכשיו
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* חיבור */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-600" />
            פרטי חיבור
          </h3>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">מספר מוסד בנדרים פלוס</label>
            <input
              dir="ltr"
              inputMode="numeric"
              value={mosadId}
              onChange={(e) => setMosadId(e.target.value.replace(/[^0-9]/g, ''))}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">לייבא תרומות מתאריך</label>
            <DateInput value={importFrom} onChange={setImportFrom} />
            <p className="text-xs text-slate-400">
              עסקאות לפני התאריך לא ייכנסו (גם לא התורמים שלהן). ריק = כל ההיסטוריה. הוראות קבע שכבר הסתיימו לא מיובאות.
            </p>
            {status?.importFrom !== (importFrom || null) && (
              <p className="text-xs text-amber-600">התאריך עוד לא נשמר – ללחוץ &quot;שמירה&quot; לפני הייבוא.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            להפעיל ייבוא אוטומטי
          </label>

          <button
            onClick={saveSettings}
            disabled={busy === 'settings'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמירה
          </button>

          <div className="border-t pt-4 space-y-1.5">
            <label className="text-sm font-medium text-slate-700">סיסמת API</label>
            {status?.hasPassword ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                סיסמה שמורה (מוסתרת)
                <button onClick={clearPassword} className="mr-auto text-xs text-slate-400 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" />
                  מחק
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <XCircle className="w-4 h-4" />
                לא הוגדרה סיסמה
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={status?.hasPassword ? 'הזן סיסמה חדשה להחלפה' : 'סיסמת API מנדרים פלוס'}
                className={inputClass}
              />
              <button
                onClick={savePassword}
                disabled={!newPassword.trim() || busy === 'password'}
                className="shrink-0 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
              >
                שמור
              </button>
            </div>
            <p className="text-xs text-slate-400">הסיסמה נשמרת בשרת בלבד ולא מוצגת שוב בדפדפן.</p>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button
              onClick={test}
              disabled={!ready || busy === 'test'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              בדיקת חיבור
            </button>
            <button
              onClick={resetHistory}
              disabled={busy === 'reset'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              ייבוא היסטוריה מההתחלה
            </button>
          </div>
        </section>

        {/* Callback */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" />
            עדכון מיידי (Callback)
          </h3>
          <p className="text-sm text-slate-600">
            נדרים פלוס שולחים למערכת עדכון מיידי על כל תרומה, על הקמת הוראת קבע ועל סירוב חיוב (הוראה שנכשלה מסומנת
            ונוצרת תזכורת). הכפתור רושם את הכתובת בנדרים פלוס ומפעיל חתימה דיגיטלית, כך שאי אפשר לזייף עדכון.
          </p>
          <button
            onClick={() => void setupWebhooks(false)}
            disabled={!ready || busy === 'setup'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {busy === 'setup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            הגדרה אוטומטית בנדרים פלוס
          </button>
          {webhooks && callbackUrl && (
            <ul className="text-xs space-y-1 bg-slate-50 rounded-xl p-3">
              {([
                ['Transaction', webhooks.transactionUrl],
                ['Keva', webhooks.kevaUrl],
                ['Siruv', webhooks.refusalUrl],
              ] as const).map(([type, url]) => {
                const ours = url === callbackUrl;
                return (
                  <li key={type} className="flex items-center gap-1.5">
                    {ours ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
                    <span className="font-medium">{WEBHOOK_LABELS[type]}:</span>
                    <span className="text-slate-500">{ours ? 'מחובר למערכת' : url ? 'מוגדרת כתובת אחרת' : 'לא מוגדר'}</span>
                  </li>
                );
              })}
              <li className="flex items-center gap-1.5">
                {webhooks.signatureEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
                <span className="font-medium">חתימה דיגיטלית:</span>
                <span className="text-slate-500">{webhooks.signatureEnabled ? 'פעילה' : 'לא פעילה'}</span>
              </li>
            </ul>
          )}
          <p className="text-xs text-slate-500">
            אפשרות ידנית (בלי חתימה): להעתיק את הכתובת ולהדביק בנדרים פלוס בהגדרות &gt; API &gt; Webhook בשלושת השדות
            (עדכוני עסקאות, הקמת הוראת קבע, עדכוני סירובים).
          </p>
          {callbackUrl ? (
            <>
              <div dir="ltr" className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 break-all font-mono text-slate-700 select-all">
                {callbackUrl}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                >
                  <Copy className="w-4 h-4" />
                  העתקה
                </button>
                <button
                  onClick={newKey}
                  disabled={busy === 'key'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  כתובת חדשה
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-700">לא נמצא מפתח – יש להפעיל את עדכון מסד הנתונים.</p>
          )}

          <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>הכתובת כוללת מפתח סודי – לא לשתף אותה מחוץ להגדרות נדרים פלוס.</p>
              <p>
                תורם שמזוהה בוודאות (ת&quot;ז, טלפון או מייל) – התרומה נכנסת אליו. תורם שלא ברור למי הוא שייך – עובר
                ל&quot;בירור כפילויות&quot; בלשונית התורמים. תורם שלא קיים – נוצר חדש.
              </p>
            </div>
          </div>
        </section>
      </div>

      <NedarimManualImport ready={ready} onDone={() => void load()} />
    </div>
  );
}
