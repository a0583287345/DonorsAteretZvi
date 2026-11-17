'use client';

import { useState } from 'react';
import { Download, Eye, Loader2, Info, Repeat, Receipt, ChevronLeft } from 'lucide-react';
import { callServerApi } from '@/lib/apiClient';
import DateInput from '@/components/DateInput';
import { toast } from '@/components/Toaster';

type Kind = 'recurring' | 'transactions';
type TxType = 'regular' | 'installments' | 'keva';

const TYPE_LABELS: Record<TxType, string> = {
  regular: 'תרומות רגילות',
  installments: 'עסקאות בתשלומים',
  keva: 'חיובי הוראות קבע',
};

type PreviewCounts = {
  exists: number;
  ignored: number;
  pendingReview: number;
  match: number;
  newDonor: number;
  noDonor: number;
  review: number;
  update: number;
  ended: number;
};
type ImportCounts = {
  imported: number;
  new_donor: number;
  no_donor: number;
  review: number;
  skipped: number;
  invalid: number;
  updated: number;
  old: number;
  errors: string[];
};
type Result = {
  dryRun: boolean;
  matched: number;
  scanned: number;
  preview: PreviewCounts | null;
  result: ImportCounts | null;
  requests: number;
  nextLastId: string | null;
  reachedDate: string | null;
};

/** סיכום מצטבר של כמה הרצות (המשך עמוד אחרי עמוד) */
type Accumulated = Result & { totalRequests: number };

function addCounts<T extends Record<string, number | string[]>>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b) as (keyof T)[]) {
    const av = a[k];
    const bv = b[k];
    if (typeof av === 'number' && typeof bv === 'number') out[k] = (av + bv) as T[keyof T];
    else if (Array.isArray(av) && Array.isArray(bv)) out[k] = [...av, ...bv].slice(0, 20) as T[keyof T];
  }
  return out;
}

const il = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * ייבוא ידני מנדרים פלוס: רק הוראות קבע (פעילות / מאז ומעולם), או עסקאות מתאריך עד תאריך ולפי סוג.
 * קודם תצוגה מקדימה (בלי לשמור כלום), ואז ייבוא.
 */
export default function NedarimManualImport({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>('recurring');
  const [recurringScope, setRecurringScope] = useState<'active' | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [types, setTypes] = useState<TxType[]>(['regular', 'installments', 'keva']);
  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [preview, setPreview] = useState<Accumulated | null>(null);
  const [imported, setImported] = useState<Accumulated | null>(null);

  // כל שינוי בהגדרות מבטל את התצוגה המקדימה הקודמת
  const changed = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPreview(null);
    setImported(null);
  };

  const options = { kind, recurringScope, from: from || null, to: to || null, types, includeIgnored };

  async function call(dryRun: boolean, startAfterId: string | null) {
    return callServerApi<Result>('/api/admin/nedarim', { action: 'manual_import', ...options, dryRun, startAfterId });
  }

  const accumulate = (prev: Accumulated | null, r: Result): Accumulated =>
    prev
      ? {
          ...r,
          matched: prev.matched + r.matched,
          scanned: prev.scanned + r.scanned,
          preview: addCounts(prev.preview, r.preview),
          result: addCounts(prev.result, r.result),
          totalRequests: prev.totalRequests + r.requests,
        }
      : { ...r, totalRequests: r.requests };

  async function runPreview(more: boolean) {
    if (kind === 'transactions' && types.length === 0) {
      toast.warning('יש לבחור לפחות סוג עסקה אחד');
      return;
    }
    setBusy('preview');
    try {
      const r = await call(true, more ? preview?.nextLastId ?? null : null);
      setPreview((p) => accumulate(more ? p : null, r));
      setImported(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'התצוגה המקדימה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  async function runImport(more: boolean) {
    if (!more) {
      const p = preview?.preview;
      const count = p ? p.match + p.newDonor + p.noDonor + p.review + p.update : 0;
      if (!window.confirm(`לייבא עכשיו? (${count} פריטים לפי התצוגה המקדימה. מה שכבר קיים לא ייכנס פעמיים)`)) return;
    }
    setBusy('import');
    try {
      const r = await call(false, more ? imported?.nextLastId ?? null : null);
      const acc = accumulate(more ? imported : null, r);
      setImported(acc);
      const c = r.result;
      if (c) {
        toast.success(
          `יובאו ${c.imported + c.new_donor + c.no_donor} חדשים${c.updated ? `, ${c.updated} עודכנו` : ''}${
            c.review ? `, ${c.review} לבדיקה` : ''
          }`
        );
      }
      if (!r.nextLastId) onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'הייבוא נכשל');
    } finally {
      setBusy(null);
    }
  }

  const p = preview?.preview;
  const toImport = p ? p.match + p.newDonor + p.noDonor + p.review : 0;
  const c = imported?.result;

  const radio = (checked: boolean) =>
    `flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm ${
      checked ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-slate-800 flex items-center gap-2">
        <Download className="w-5 h-5 text-purple-600" />
        ייבוא ידני
      </h3>
      <p className="text-sm text-slate-600">
        ייבוא מדויק לפי בחירה – בנפרד מהייבוא היומי. קודם &quot;תצוגה מקדימה&quot; (לא נשמר כלום), ואז &quot;ייבוא&quot;.
      </p>

      {/* מה מייבאים */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className={radio(kind === 'recurring')}>
          <input type="radio" checked={kind === 'recurring'} onChange={() => changed(setKind)('recurring')} className="mt-1" />
          <span>
            <span className="font-bold flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-emerald-600" />
              הוראות קבע
            </span>
            <span className="block text-xs text-slate-500">ההוראות עצמן (סכום, חודשים, סטטוס) – בלי החיובים</span>
          </span>
        </label>
        <label className={radio(kind === 'transactions')}>
          <input type="radio" checked={kind === 'transactions'} onChange={() => changed(setKind)('transactions')} className="mt-1" />
          <span>
            <span className="font-bold flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-blue-600" />
              תרומות (עסקאות)
            </span>
            <span className="block text-xs text-slate-500">לפי טווח תאריכים וסוג עסקה</span>
          </span>
        </label>
      </div>

      {kind === 'recurring' ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              checked={recurringScope === 'all'}
              onChange={() => changed(setRecurringScope)('all')}
            />
            כל הוראות הקבע מאז ומעולם (כולל שהסתיימו או בוטלו)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              checked={recurringScope === 'active'}
              onChange={() => changed(setRecurringScope)('active')}
            />
            רק הוראות פעילות
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">מתאריך</label>
              <DateInput value={from} onChange={changed(setFrom)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">עד תאריך</label>
              <DateInput value={to} onChange={changed(setTo)} />
            </div>
          </div>
          <p className="text-xs text-slate-400">תאריך ריק = בלי הגבלה (מהעסקה הראשונה / עד היום).</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TYPE_LABELS) as TxType[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={types.includes(t)}
                  onChange={(e) => changed(setTypes)(e.target.checked ? [...types, t] : types.filter((x) => x !== t))}
                  className="w-4 h-4"
                />
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            כל החיובים של הוראות הקבע מאז ומעולם: לסמן רק &quot;חיובי הוראות קבע&quot; ולהשאיר את התאריכים ריקים.
            כדאי לייבא קודם את הוראות הקבע עצמן – כך החיובים ישויכו ישר לתורם של ההוראה.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={includeIgnored}
          onChange={(e) => changed(setIncludeIgnored)(e.target.checked)}
          className="w-4 h-4 mt-0.5"
        />
        <span>
          לייבא גם פריטים שסומנו &quot;לא לייבא&quot; או שנמחקו ידנית מהמערכת
          <span className="block text-xs text-slate-400">למשל הוראת קבע שנמחקה בטעות</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void runPreview(false)}
          disabled={!ready || busy !== null}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          תצוגה מקדימה
        </button>
        <button
          onClick={() => void runImport(false)}
          disabled={!ready || busy !== null || !preview || preview.nextLastId !== null}
          title={!preview ? 'קודם תצוגה מקדימה' : preview.nextLastId ? 'קודם להשלים את התצוגה המקדימה' : undefined}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          ייבוא
        </button>
      </div>

      {/* תצוגה מקדימה */}
      {preview && p && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="font-bold text-slate-800">
            תצוגה מקדימה: {preview.matched} {kind === 'recurring' ? 'הוראות קבע' : 'עסקאות'} מתאימות
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
            {p.match > 0 && <li>✅ ייכנסו לתורם קיים: <b>{p.match}</b></li>}
            {p.newDonor > 0 && <li>🆕 ייפתח תורם חדש: <b>{p.newDonor}</b></li>}
            {p.noDonor > 0 && <li>➖ יישמרו בלי תורם (אין פרטים): <b>{p.noDonor}</b></li>}
            {p.review > 0 && <li>🔍 יעברו לבירור כפילויות: <b>{p.review}</b></li>}
            {p.update > 0 && <li>🔄 כבר קיימות – יעודכנו: <b>{p.update}</b></li>}
            {p.exists > 0 && <li className="text-slate-500">כבר קיימות במערכת (לא ייובאו שוב): {p.exists}</li>}
            {p.pendingReview > 0 && <li className="text-slate-500">כבר ממתינות בבירור כפילויות: {p.pendingReview}</li>}
            {p.ignored > 0 && <li className="text-slate-500">סומנו &quot;לא לייבא&quot; / נמחקו (ידולגו): {p.ignored}</li>}
            {p.ended > 0 && <li className="text-slate-500">הסתיימו (לא ייובאו ב&quot;רק פעילות&quot;): {p.ended}</li>}
          </ul>
          {preview.matched === 0 && <div className="text-slate-500">אין פריטים שמתאימים לבחירה.</div>}
          {kind === 'transactions' && preview.nextLastId === null && toImport + p.exists > 0 && (
            <div className="text-xs text-slate-500">נבדקו {preview.scanned} עסקאות בנדרים פלוס.</div>
          )}
          {preview.nextLastId && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              נקראו העסקאות עד {il(preview.reachedDate)} – יש עוד.
              <button
                onClick={() => void runPreview(true)}
                disabled={busy !== null}
                className="flex items-center gap-1 font-bold underline disabled:opacity-50"
              >
                להמשיך את התצוגה המקדימה
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="text-[11px] text-slate-400">פניות לנדרים פלוס עד עכשיו: {preview.totalRequests} (מכסה: 20 בשעה, כולל הייבוא היומי)</div>
        </div>
      )}

      {/* תוצאת ייבוא */}
      {imported && c && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="font-bold text-emerald-800">{imported.nextLastId ? 'הייבוא בתהליך' : 'הייבוא הסתיים'}</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
            <li>יובאו לתורם קיים: <b>{c.imported}</b></li>
            <li>תורמים חדשים: <b>{c.new_donor}</b></li>
            {c.no_donor > 0 && <li>בלי תורם: <b>{c.no_donor}</b></li>}
            {c.updated > 0 && <li>עודכנו: <b>{c.updated}</b></li>}
            {c.review > 0 && <li>לבירור כפילויות: <b>{c.review}</b></li>}
            {c.skipped > 0 && <li className="text-slate-500">דולגו (כבר קיימים / מסומנים): {c.skipped}</li>}
            {c.old > 0 && <li className="text-slate-500">הוראות שהסתיימו – לא יובאו: {c.old}</li>}
          </ul>
          {c.errors.length > 0 && (
            <details className="text-xs text-red-700">
              <summary className="cursor-pointer">{c.errors.length} שגיאות</summary>
              <ul className="mt-1 space-y-0.5">
                {c.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          {imported.nextLastId && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700">
              יובא עד {il(imported.reachedDate)} – יש עוד.
              <button
                onClick={() => void runImport(true)}
                disabled={busy !== null}
                className="flex items-center gap-1 font-bold underline disabled:opacity-50"
              >
                להמשיך לייבא
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            לנדרים פלוס אין סינון לפי תאריך – המערכת קוראת את העסקאות מהראשונה (2000 בכל פניה) ועוצרת אחרי &quot;עד תאריך&quot;.
            מותרות 20 פניות בשעה, ולכן בהיסטוריה גדולה הייבוא נעשה בכמה שלבים (&quot;להמשיך&quot;).
          </p>
          <p>מה שכבר קיים במערכת לא ייכנס פעמיים. הייבוא הידני לא משנה את נקודת ההמשך של הייבוא היומי.</p>
        </div>
      </div>
    </section>
  );
}
