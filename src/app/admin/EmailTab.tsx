'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Mail, KeyRound, Save, Send, Loader2, CheckCircle2, XCircle, RotateCcw, Info, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import { useAuth } from '@/components/AuthContext';
import { toast } from '@/components/Toaster';
import {
  DEFAULT_TEMPLATES,
  PLACEHOLDERS,
  TEMPLATE_LABELS,
  isValidEmail,
  mergeTemplates,
  type EmailTemplates,
  type TemplateKey,
} from '@/lib/email/templates';
import type { Json } from '@/types/database';
import EmailOutboxPanel from '@/components/reminders/EmailOutboxPanel';

const inputClass =
  'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30';

/** קריאה ל-API המיילים בשרת עם הטוקן של המשתמש */
async function emailApi<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch('/api/admin/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data as T;
}

/** פאנל ניהול → מיילים: חיבור Gmail, נמענים, תבניות (+ תור המיילים המשותף) */
export default function EmailTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // הגדרות
  const [enabled, setEnabled] = useState(false);
  const [gmailUser, setGmailUser] = useState('');
  // הכתובת כפי שנשמרה במסד (השרת שולח רק ממנה)
  const [savedGmailUser, setSavedGmailUser] = useState('');
  const [fromName, setFromName] = useState('');
  const [managerEmails, setManagerEmails] = useState('');
  const [templates, setTemplates] = useState<EmailTemplates>(DEFAULT_TEMPLATES);
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [testTo, setTestTo] = useState('');
  // מרענן את תור המיילים אחרי מייל בדיקה
  const [outboxKey, setOutboxKey] = useState(0);

  const loadAll = useCallback(async () => {
    const [{ data: s }, status] = await Promise.all([
      supabase.from('email_settings').select('*').eq('id', 1).maybeSingle(),
      emailApi<{ hasPassword: boolean }>('status').catch(() => ({ hasPassword: false })),
    ]);
    if (s) {
      setEnabled(s.enabled);
      setGmailUser(s.gmail_user ?? '');
      setSavedGmailUser(s.gmail_user ?? '');
      setFromName(s.from_name);
      setManagerEmails((s.manager_emails ?? []).join('\n'));
      setTemplates(mergeTemplates(s.templates));
    }
    setHasPassword(status.hasPassword);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadAll(), 0);
    return () => clearTimeout(t);
  }, [loadAll]);

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
      const emails = managerEmails
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const bad = emails.filter((e) => !isValidEmail(e));
      if (bad.length) throw new Error(`כתובות לא תקינות: ${bad.join(', ')}`);
      if (gmailUser.trim() && !isValidEmail(gmailUser)) throw new Error('כתובת ה-Gmail לא תקינה');

      const { error } = await supabase
        .from('email_settings')
        .update({
          enabled,
          gmail_user: gmailUser.trim() || null,
          from_name: fromName.trim() || 'עטרת צבי אשדוד',
          manager_emails: emails,
          templates: templates as unknown as Json,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('id', 1);
      if (error) throw new Error(error.message);
      setSavedGmailUser(gmailUser.trim());
      await logActivity('update', 'email_settings', `עודכנו הגדרות המייל (שליחה ${enabled ? 'פעילה' : 'כבויה'})`);
      toast.success('ההגדרות נשמרו');
    });

  /** שומר את כתובת ה-Gmail אם הוקלדה ועוד לא נשמרה (השרת קורא רק מהמסד) */
  async function persistGmailUser() {
    const typed = gmailUser.trim();
    if (!typed || typed === savedGmailUser) return;
    if (!isValidEmail(typed)) throw new Error('כתובת ה-Gmail לא תקינה');
    const { error } = await supabase
      .from('email_settings')
      .update({ gmail_user: typed, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq('id', 1);
    if (error) throw new Error(error.message);
    setSavedGmailUser(typed);
    await logActivity('update', 'email_settings', `עודכנה כתובת ה-Gmail לשליחה: ${typed}`);
  }

  const savePassword = () =>
    run('password', async () => {
      await persistGmailUser();
      await emailApi('save_password', { password: newPassword });
      setNewPassword('');
      setHasPassword(true);
      toast.success('סיסמת האפליקציה נשמרה');
    });

  const clearPassword = () =>
    run('password', async () => {
      if (!window.confirm('למחוק את סיסמת האפליקציה השמורה? שליחת מיילים תיפסק.')) return;
      await emailApi('clear_password');
      setHasPassword(false);
      toast.success('הסיסמה נמחקה');
    });

  const sendTest = () =>
    run('test', async () => {
      await persistGmailUser();
      await emailApi('test', { to: testTo });
      toast.success(`מייל בדיקה נשלח ל-${testTo}`);
      setOutboxKey((k) => k + 1);
    });

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  const ready = hasPassword && !!gmailUser.trim();

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* מצב */}
      <div
        className={`flex flex-wrap items-center gap-3 p-4 rounded-2xl border ${
          enabled && ready ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <Mail className={`w-6 h-6 ${enabled && ready ? 'text-emerald-600' : 'text-amber-600'}`} />
        <div className="flex-1 text-sm">
          <div className="font-bold text-slate-800">
            {enabled && ready ? 'שליחת מיילים פעילה' : 'שליחת מיילים לא פעילה'}
          </div>
          <div className="text-slate-600">
            {!gmailUser.trim()
              ? 'יש להזין כתובת Gmail.'
              : !hasPassword
                ? 'יש לשמור סיסמת אפליקציה.'
                : !enabled
                  ? 'החיבור מוכן – יש להפעיל את השליחה ולשמור.'
                  : `נשלח מ-${gmailUser}. בדיקה אוטומטית כל בוקר. אישור מיילים – גם בלשונית התזכורות.`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* חיבור Gmail */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-600" />
            חיבור ל-Gmail
          </h3>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">כתובת Gmail שממנה נשלח</label>
            <input
              type="email"
              dir="ltr"
              value={gmailUser}
              onChange={(e) => setGmailUser(e.target.value)}
              placeholder="example@gmail.com"
              className={inputClass}
            />
            {gmailUser.trim() !== savedGmailUser && (
              <p className="text-xs text-amber-600">הכתובת עוד לא נשמרה – תישמר אוטומטית בשמירת הסיסמה / מייל בדיקה, או בכפתור &quot;שמירה&quot;.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">סיסמת אפליקציה</label>
            {hasPassword ? (
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
                placeholder={hasPassword ? 'הזן סיסמה חדשה להחלפה' : 'xxxx xxxx xxxx xxxx'}
                className={inputClass}
              />
              <button
                onClick={savePassword}
                disabled={!newPassword.trim() || busy === 'password'}
                className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-bold whitespace-nowrap"
              >
                {busy === 'password' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור סיסמה'}
              </button>
            </div>
            <p className="text-xs text-slate-500">הסיסמה נשמרת בשרת בלבד ולא ניתן לצפות בה שוב – רק להחליף.</p>
          </div>

          <details className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-slate-700">
            <summary className="cursor-pointer font-bold text-blue-800 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              איך יוצרים סיסמת אפליקציה ב-Gmail?
            </summary>
            <ol className="list-decimal pr-5 mt-2 space-y-1">
              <li>נכנסים לחשבון הגוגל: myaccount.google.com</li>
              <li>אבטחה (Security) → מפעילים &quot;אימות דו-שלבי&quot; (2-Step Verification) אם לא מופעל</li>
              <li>מחפשים בחשבון &quot;סיסמאות לאפליקציות&quot; (App passwords)</li>
              <li>נותנים שם, למשל &quot;מערכת תורמים&quot;, ולוחצים &quot;צור&quot;</li>
              <li>מעתיקים את 16 האותיות ומדביקים כאן</li>
            </ol>
          </details>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700">שליחת מייל בדיקה</label>
            <div className="flex gap-2">
              <input
                type="email"
                dir="ltr"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="לאיזו כתובת לשלוח?"
                className={inputClass}
              />
              <button
                onClick={sendTest}
                disabled={!isValidEmail(testTo) || !ready || busy === 'test'}
                className="flex items-center gap-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-bold whitespace-nowrap"
              >
                {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                שלח
              </button>
            </div>
            {!ready && <p className="text-xs text-slate-400">צריך קודם לשמור כתובת Gmail וסיסמת אפליקציה.</p>}
          </div>
        </section>

        {/* הגדרות שליחה */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-600" />
            הגדרות שליחה
          </h3>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-purple-600"
            />
            שליחת מיילים פעילה
          </label>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">שם השולח</label>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">כתובות מנהלים לקבלת תזכורות (כתובת בכל שורה)</label>
            <textarea
              dir="ltr"
              rows={3}
              value={managerEmails}
              onChange={(e) => setManagerEmails(e.target.value)}
              placeholder="manager@example.com"
              className={`${inputClass} resize-none text-left`}
            />
            <p className="text-xs text-slate-500">
              תזכורות שסומן בהן &quot;שלח תזכורת למנהל&quot; יישלחו לכתובות האלה כשהן נעשות פעילות.
            </p>
          </div>

          <button
            onClick={saveSettings}
            disabled={busy === 'settings'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold"
          >
            {busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור הגדרות ותבניות
          </button>
        </section>
      </div>

      {/* תבניות */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-800">תבניות הודעה</h3>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {PLACEHOLDERS.map((p) => (
              <span key={p.key} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600" title={p.label}>
                {p.key}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
            <div key={key} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{TEMPLATE_LABELS[key]}</span>
                <button
                  onClick={() => setTemplates((t) => ({ ...t, [key]: { ...DEFAULT_TEMPLATES[key] } }))}
                  className="text-xs text-slate-400 hover:text-purple-700 flex items-center gap-1"
                  title="שחזור ברירת מחדל"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={templates[key].subject}
                onChange={(e) => setTemplates((t) => ({ ...t, [key]: { ...t[key], subject: e.target.value } }))}
                className={inputClass}
                placeholder="נושא"
              />
              <textarea
                rows={9}
                value={templates[key].body}
                onChange={(e) => setTemplates((t) => ({ ...t, [key]: { ...t[key], body: e.target.value } }))}
                className={`${inputClass} resize-y`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">השינויים בתבניות נשמרים בכפתור &quot;שמור הגדרות ותבניות&quot;.</p>
      </section>

      {/* תור והיסטוריה (גם בלשונית התזכורות) */}
      <EmailOutboxPanel key={outboxKey} />
    </div>
  );
}
