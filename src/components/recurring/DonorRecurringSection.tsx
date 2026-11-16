'use client';

import { useCallback, useEffect, useState } from 'react';
import { Repeat, Plus } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';
import { Protect } from '@/components/Protect';
import { todayISO } from '@/lib/reminders/dates';
import type { RecurringRow } from '@/lib/recurring/schedule';
import RecurringList from './RecurringList';
import RecurringFormModal from './RecurringFormModal';

/** כרטיס תורם: הוראות הקבע שלו + הוספה/עריכה */
export default function DonorRecurringSection({ donor }: { donor: Donor }) {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<RecurringRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<RecurringRow | 'new' | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recurring_donations')
      .select('*')
      .eq('donor_id', donor.id)
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoaded(true);
  }, [donor.id]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!hasPermission('donations_view')) return null;
  // בלי הוראות ובלי הרשאה להוסיף – לא מציגים את האזור
  if (loaded && rows.length === 0 && !hasPermission('donations_create')) return null;

  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <Repeat className="w-3.5 h-3.5 text-slate-400" />
          הוראות קבע
        </h4>
        <Protect permId="donations_create">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing('new');
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-blue-600 hover:bg-blue-50"
          >
            <Plus className="w-3.5 h-3.5" />
            הוספה
          </button>
        </Protect>
      </div>
      <div className="p-2">
        {loaded && (
          <RecurringList
            rows={rows}
            today={todayISO()}
            canViewAmount={hasPermission('donations_view_amount')}
            hideDonor
            onOpen={(r) => setEditing(r)}
            emptyText="אין הוראות קבע לתורם הזה"
          />
        )}
      </div>

      {editing && (
        <RecurringFormModal
          key={editing === 'new' ? 'new' : editing.id}
          recurring={editing === 'new' ? null : editing}
          donors={[donor]}
          fixedDonorId={donor.id}
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
