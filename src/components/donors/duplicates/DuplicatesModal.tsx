'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Users, Inbox, RefreshCw } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import { callServerApi } from '@/lib/apiClient';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/components/AuthContext';
import { donorDisplayName, findDuplicatePairs, pairKey } from '@/lib/import/donorMatch';
import { loadDonorYahrzeits, syncDonorAutoReminders } from '@/lib/reminders/donorAuto';
import DuplicatePairCard from './DuplicatePairCard';
import ImportReviewCard, { type ReviewItem } from './ImportReviewCard';

type Props = {
  donors: Donor[];
  initialTab?: 'duplicates' | 'review';
  onClose: () => void;
  /** נקרא אחרי שינוי בתורמים/תרומות – לרענון הרשימות */
  onChanged: () => void;
};

/** בירור כפילויות (לשונית תורמים): תורמים כפולים + תורמים מיובאים שממתינים לבדיקה */
export default function DuplicatesModal({ donors, initialTab = 'duplicates', onClose, onChanged }: Props) {
  const { user, hasPermission } = useAuth();
  const canViewContact = hasPermission('donors_view_contact');
  const canViewAmount = hasPermission('donations_view_amount');

  const [tab, setTab] = useState<'duplicates' | 'review'>(initialTab);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [donationCounts, setDonationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const donorsById = useMemo(() => new Map(donors.map((d) => [d.id, d])), [donors]);
  const pairs = useMemo(
    () => findDuplicatePairs(donors, dismissed).filter((p) => donorsById.has(p.a) && donorsById.has(p.b)),
    [donors, dismissed, donorsById]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [dismissals, review, donations] = await Promise.all([
      supabase.from('donor_duplicate_dismissals').select('donor_a, donor_b'),
      supabase.from('import_review').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(200),
      supabase.from('donations').select('donor_id'),
    ]);
    if (dismissals.error || review.error) {
      toast.error('שגיאה בטעינת נתוני הכפילויות');
    }
    setDismissed(new Set((dismissals.data ?? []).map((r) => pairKey(r.donor_a, r.donor_b))));
    setReviewItems(review.data ?? []);
    const counts: Record<string, number> = {};
    for (const d of donations.data ?? []) if (d.donor_id) counts[d.donor_id] = (counts[d.donor_id] ?? 0) + 1;
    setDonationCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    // טעינה ראשונית מהמסד כשהחלון נפתח
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const merge = async (keepId: string, removeId: string) => {
    const keep = donorsById.get(keepId);
    const remove = donorsById.get(removeId);
    if (!keep || !remove) return;
    setBusyKey(pairKey(keepId, removeId));
    const { error } = await supabase.rpc('merge_donors', { p_keep: keepId, p_remove: removeId });
    if (error) {
      setBusyKey(null);
      toast.error(`המיזוג נכשל: ${error.message}`);
      return;
    }

    // תזכורות אוטומטיות (יום הולדת / יארצייט) לפי הנתונים המאוחדים
    const { data: merged } = await supabase.from('donors').select('*').eq('id', keepId).maybeSingle();
    if (merged) {
      await syncDonorAutoReminders(
        {
          id: keepId,
          name: donorDisplayName(merged),
          birthday: merged.birthday,
          birthday_after_sunset: Boolean(merged.birthday_after_sunset),
          yahrzeits: await loadDonorYahrzeits(keepId),
        },
        user?.id
      );
    }

    await logActivity('MERGE', 'donors', `מיזוג תורמים: "${donorDisplayName(remove)}" אוחד לתוך "${donorDisplayName(keep)}"`);
    toast.success('התורמים אוחדו');
    setBusyKey(null);
    onChanged();
  };

  const dismiss = async (a: string, b: string) => {
    const [donor_a, donor_b] = a < b ? [a, b] : [b, a];
    setBusyKey(pairKey(a, b));
    const { error } = await supabase.from('donor_duplicate_dismissals').insert({ donor_a, donor_b, created_by: user?.id ?? null });
    setBusyKey(null);
    if (error) {
      toast.error(`השמירה נכשלה: ${error.message}`);
      return;
    }
    setDismissed((prev) => new Set(prev).add(pairKey(a, b)));
    const da = donorsById.get(a);
    const db = donorsById.get(b);
    await logActivity(
      'update',
      'donors',
      `סומן "לא כפילות": ${da ? donorDisplayName(da) : a} / ${db ? donorDisplayName(db) : b}`
    );
  };

  const resolve = async (item: ReviewItem, action: 'link' | 'create' | 'ignore', donorId?: string) => {
    setBusyKey(item.id);
    try {
      await callServerApi('/api/import-review', { id: item.id, action, donorId });
      setReviewItems((prev) => prev.filter((r) => r.id !== item.id));
      toast.success(action === 'link' ? 'שויך לתורם' : action === 'create' ? 'נוצר תורם חדש' : 'סומן "לא לייבא"');
      if (action !== 'ignore') onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setBusyKey(null);
    }
  };

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-800">בירור כפילויות</h2>
            <p className="text-xs text-slate-400 mt-0.5">תורמים שנראים כפולים, ותורמים מנדרים פלוס שממתינים לשיוך</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void load()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="רענון">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="סגירה">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-4 pt-3">
          <button type="button" className={tabClass(tab === 'duplicates')} onClick={() => setTab('duplicates')}>
            <Users className="w-4 h-4" />
            תורמים כפולים ({pairs.length})
          </button>
          <button type="button" className={tabClass(tab === 'review')} onClick={() => setTab('review')}>
            <Inbox className="w-4 h-4" />
            מיובאים לבדיקה ({reviewItems.length})
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">טוען...</div>
          ) : tab === 'duplicates' ? (
            pairs.length === 0 ? (
              <Empty text="לא נמצאו תורמים כפולים 👍" />
            ) : (
              pairs.map((p) => (
                <DuplicatePairCard
                  key={pairKey(p.a, p.b)}
                  pair={p}
                  a={donorsById.get(p.a)!}
                  b={donorsById.get(p.b)!}
                  donationCounts={donationCounts}
                  canViewContact={canViewContact}
                  busy={busyKey === pairKey(p.a, p.b)}
                  onMerge={merge}
                  onDismiss={() => void dismiss(p.a, p.b)}
                />
              ))
            )
          ) : reviewItems.length === 0 ? (
            <Empty text="אין פריטים שממתינים לבדיקה" />
          ) : (
            reviewItems.map((item) => (
              <ImportReviewCard
                key={item.id}
                item={item}
                donors={donors}
                donorsById={donorsById}
                canViewAmount={canViewAmount}
                canViewContact={canViewContact}
                busy={busyKey === item.id}
                onResolve={(action, donorId) => void resolve(item, action, donorId)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-slate-400 bg-white rounded-2xl border border-dashed">{text}</div>;
}
