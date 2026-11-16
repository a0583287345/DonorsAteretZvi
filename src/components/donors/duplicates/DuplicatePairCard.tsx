'use client';

import { useState } from 'react';
import { GitMerge, UserX, Check } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { DUPLICATE_REASON_LABELS, donorDisplayName, type DuplicatePair } from '@/lib/import/donorMatch';
import { formatDate } from '@/components/donations/donationUtils';

type Props = {
  pair: DuplicatePair;
  a: Donor;
  b: Donor;
  donationCounts: Record<string, number>;
  canViewContact: boolean;
  busy: boolean;
  onMerge: (keepId: string, removeId: string) => void;
  onDismiss: () => void;
};

/** זוג תורמים חשוד ככפילות: השוואה, בחירה מי נשאר, מיזוג או "לא כפילות" */
export default function DuplicatePairCard({ pair, a, b, donationCounts, canViewContact, busy, onMerge, onDismiss }: Props) {
  // ברירת מחדל: להשאיר את מי שיש לו יותר תרומות (או הוותיק)
  const [keepId, setKeepId] = useState(() => {
    const ca = donationCounts[a.id] ?? 0;
    const cb = donationCounts[b.id] ?? 0;
    if (ca !== cb) return ca > cb ? a.id : b.id;
    return (a.created_at ?? '') <= (b.created_at ?? '') ? a.id : b.id;
  });
  const [confirming, setConfirming] = useState(false);
  const removeId = keepId === a.id ? b.id : a.id;

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {pair.reasons.map((r) => (
          <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {DUPLICATE_REASON_LABELS[r]}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {[a, b].map((d) => {
          const selected = d.id === keepId;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setKeepId(d.id);
                setConfirming(false);
              }}
              className={`text-right p-3 rounded-xl border transition ${
                selected ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-semibold text-sm text-slate-800">{donorDisplayName(d)}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {selected ? 'נשאר' : 'יתמזג ויימחק'}
                </span>
              </div>
              <dl className="text-xs text-slate-600 space-y-0.5">
                <Row label='ת"ז' value={d.zeout} />
                {canViewContact && (
                  <>
                    <Row label="טלפון" value={[d.phone_1, d.phone_2].filter(Boolean).join(', ')} />
                    <Row label="מייל" value={d.email} />
                    <Row label="כתובת" value={[d.street, d.house_number, d.city].filter(Boolean).join(' ')} />
                  </>
                )}
                <Row label="תרומות" value={String(donationCounts[d.id] ?? 0)} />
                <Row label="נוצר" value={formatDate(d.created_at)} />
              </dl>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">
        במיזוג: כל התרומות, המסמכים, התזכורות, ימי היארצייט והוראות הקבע עוברים לתורם שנשאר; שדות ריקים אצלו מושלמים
        מהתורם השני, והתורם השני נמחק.
      </p>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <UserX className="w-4 h-4" />
          לא כפילות – אנשים שונים
        </button>
        {confirming ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMerge(keepId, removeId)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            בטוח? לחיצה נוספת ממזגת
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <GitMerge className="w-4 h-4" />
            מיזוג
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-slate-400 shrink-0">{label}:</dt>
      <dd className="truncate">{value || '-'}</dd>
    </div>
  );
}
