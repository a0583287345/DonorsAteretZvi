'use client';

import { useMemo, useState } from 'react';
import { X, Save, Loader2, Trash2, Info } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/components/AuthContext';
import DateInput from '@/components/DateInput';
import { PAYMENT_METHOD_LABELS } from '@/components/donations/donationUtils';
import { donorDisplayName } from '@/lib/import/donorMatch';
import { todayISO } from '@/lib/reminders/dates';
import {
  RECURRING_STATUS_LABELS,
  lastChargeDate,
  renewalDate,
  type RecurringRow,
  type RecurringStatus,
} from '@/lib/recurring/schedule';

type Props = {
  /** null = הוראה חדשה */
  recurring: RecurringRow | null;
  donors: Donor[];
  /** תורם קבוע (כשנפתח מכרטיס התורם) */
  fixedDonorId?: string;
  onClose: () => void;
  onSaved: () => void;
};

const inputClass =
  'w-full p-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white disabled:bg-slate-100';

const formatIL = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '-');

/** הוספה / עריכה של הוראת קבע. הוראה מנדרים פלוס: רק תורם, סטטוס והערות (השאר מתעדכן בסנכרון) */
export default function RecurringFormModal({ recurring, donors, fixedDonorId, onClose, onSaved }: Props) {
  const { hasPermission } = useAuth();
  const isNew = !recurring;
  const fromNedarim = recurring?.external_source === 'nedarim';
  const canSave = hasPermission(isNew ? 'donations_create' : 'donations_edit');
  const canDelete = !isNew && !fromNedarim && hasPermission('donations_delete');

  const [donorId, setDonorId] = useState(recurring?.donor_id ?? fixedDonorId ?? '');
  const [donorSearch, setDonorSearch] = useState('');
  const [amount, setAmount] = useState(recurring ? String(recurring.amount) : '');
  const [currency, setCurrency] = useState(recurring?.currency ?? 'ILS');
  const [startDate, setStartDate] = useState(recurring?.start_date ?? (isNew ? todayISO() : ''));
  const [monthsTotal, setMonthsTotal] = useState(recurring?.months_total ? String(recurring.months_total) : '');
  const [status, setStatus] = useState<RecurringStatus>((recurring?.status as RecurringStatus) ?? 'active');
  const [paymentMethod, setPaymentMethod] = useState(recurring?.payment_method ?? 'credit_card');
  const [notes, setNotes] = useState(recurring?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const selectedDonor = donors.find((d) => d.id === donorId);
  const donorOptions = useMemo(() => {
    const q = donorSearch.trim().toLowerCase();
    const list = q
      ? donors.filter((d) => donorDisplayName(d).toLowerCase().includes(q) || (d.zeout ?? '').includes(q))
      : donors;
    return list.slice(0, 50);
  }, [donors, donorSearch]);

  // תצוגה מקדימה של מועד הסיום ותזכורת החידוש
  const preview = useMemo(() => {
    if (fromNedarim && recurring) return { last: lastChargeDate(recurring), renewal: renewalDate(recurring) };
    const total = Number(monthsTotal);
    if (!startDate || !total) return { last: null, renewal: null };
    const draft = { start_date: startDate, months_total: total } as RecurringRow;
    return { last: lastChargeDate(draft), renewal: renewalDate(draft) };
  }, [fromNedarim, recurring, startDate, monthsTotal]);

  const save = async () => {
    if (!canSave) return;
    const amountNum = Number(amount);
    const total = monthsTotal.trim() ? Number(monthsTotal) : null;
    if (!donorId) return toast.warning('יש לבחור תורם');
    if (!fromNedarim) {
      if (!(amountNum > 0)) return toast.warning('יש להזין סכום חודשי');
      if (!startDate) return toast.warning('יש להזין תאריך חיוב ראשון');
      if (total !== null && (!Number.isInteger(total) || total < 1 || total > 600)) {
        return toast.warning('מספר חודשים – מספר שלם בין 1 ל-600 (או ריק = ללא הגבלה)');
      }
    }

    setBusy(true);
    const now = new Date().toISOString();
    const base = { donor_id: donorId, status, notes: notes.trim() || null, updated_at: now };
    const payload = fromNedarim
      ? base
      : {
          ...base,
          amount: amountNum,
          currency,
          start_date: startDate,
          charge_day: Number(startDate.slice(8, 10)),
          months_total: total,
          months_remaining: null,
          next_charge_date: null,
          payment_method: paymentMethod,
        };

    const { error } = isNew
      ? await supabase.from('recurring_donations').insert(payload)
      : await supabase.from('recurring_donations').update(payload).eq('id', recurring.id);
    if (error) {
      setBusy(false);
      toast.error(`השמירה נכשלה: ${error.message}`);
      return;
    }

    if (status === 'active') await supabase.from('donors').update({ is_recurring: true }).eq('id', donorId);

    const name = selectedDonor ? donorDisplayName(selectedDonor) : '';
    await logActivity(
      isNew ? 'create' : 'update',
      'recurring_donations',
      isNew
        ? `נוספה הוראת קבע ל-${name}: ${amountNum} ${currency} לחודש${total ? `, ${total} חודשים` : ', ללא הגבלה'}`
        : `עודכנה הוראת קבע של ${name} (${RECURRING_STATUS_LABELS[status]})`
    );
    toast.success(isNew ? 'הוראת הקבע נוספה' : 'הוראת הקבע עודכנה');
    setBusy(false);
    onSaved();
  };

  const remove = async () => {
    if (!recurring || !canDelete) return;
    if (!window.confirm('למחוק את הוראת הקבע? (התרומות שכבר נרשמו לא יימחקו)')) return;
    setBusy(true);
    const { error } = await supabase.from('recurring_donations').delete().eq('id', recurring.id);
    setBusy(false);
    if (error) return toast.error(`המחיקה נכשלה: ${error.message}`);
    await logActivity(
      'delete',
      'recurring_donations',
      `נמחקה הוראת קבע של ${selectedDonor ? donorDisplayName(selectedDonor) : ''}: ${recurring.amount} ${recurring.currency}`
    );
    toast.success('הוראת הקבע נמחקה');
    onSaved();
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-bold text-slate-800">{isNew ? 'הוראת קבע חדשה' : 'עריכת הוראת קבע'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {fromNedarim && (
            <div className="flex gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0" />
              הוראה מנדרים פלוס – הסכום, החודשים והחיוב הבא מתעדכנים אוטומטית בסנכרון. כאן אפשר לשנות תורם, סטטוס והערות.
            </div>
          )}

          {/* תורם */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">תורם *</label>
            {fixedDonorId ? (
              <div className="p-2.5 border rounded-xl text-sm bg-slate-50">{selectedDonor ? donorDisplayName(selectedDonor) : '-'}</div>
            ) : (
              <div className="space-y-1.5">
                <input
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  placeholder='חיפוש לפי שם או ת"ז'
                  className={inputClass}
                />
                <select value={donorId} onChange={(e) => setDonorId(e.target.value)} className={inputClass} size={5}>
                  {selectedDonor && !donorOptions.includes(selectedDonor) && (
                    <option value={selectedDonor.id}>{donorDisplayName(selectedDonor)}</option>
                  )}
                  {donorOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {donorDisplayName(d)}
                      {d.zeout ? ` · ${d.zeout}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">סכום חודשי *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                disabled={fromNedarim}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">מטבע</label>
              <select value={currency} disabled={fromNedarim} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                <option value="ILS">₪ - שקל חדש</option>
                <option value="USD">$ - דולר ארה&quot;ב</option>
                <option value="EUR">€ - אירו</option>
              </select>
            </div>
          </div>

          {!fromNedarim && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">חיוב ראשון *</label>
                <DateInput value={startDate} onChange={setStartDate} />
                <p className="text-[11px] text-slate-400 mt-1">החיוב בכל חודש באותו יום</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">מספר חודשים</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={monthsTotal}
                  onChange={(e) => setMonthsTotal(e.target.value)}
                  placeholder="ריק = ללא הגבלה"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">סטטוס</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as RecurringStatus)} className={inputClass}>
                {(Object.keys(RECURRING_STATUS_LABELS) as RecurringStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {RECURRING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">אמצעי תשלום</label>
              <select
                value={paymentMethod}
                disabled={fromNedarim}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClass}
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 space-y-0.5">
            {preview.last ? (
              <>
                <div>חיוב אחרון: {formatIL(preview.last)}</div>
                <div>תזכורת חידוש: {formatIL(preview.renewal)} (חודש לפני הסיום)</div>
              </>
            ) : (
              <div>ללא הגבלת חודשים – אין תזכורת חידוש</div>
            )}
            <div className="text-slate-400">אם ההוראה מסומנת &quot;נכשלה&quot; – נוצרת תזכורת לטיפול באותו יום.</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t">
          {canDelete ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              מחיקה
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
              ביטול
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !canSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              שמירה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
