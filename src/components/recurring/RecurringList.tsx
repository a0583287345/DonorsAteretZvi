'use client';

import type { Donor } from '@/types/donor';
import { donorDisplayName } from '@/lib/import/donorMatch';
import { formatAmount } from '@/components/donations/donationUtils';
import {
  RECURRING_STATUS_LABELS,
  RECURRING_STATUS_STYLES,
  isEndingSoon,
  lastChargeDate,
  nextChargeDate,
  remainingCharges,
  type RecurringRow,
  type RecurringStatus,
} from '@/lib/recurring/schedule';

type Props = {
  rows: RecurringRow[];
  donorsById?: Map<string, Donor>;
  today: string;
  canViewAmount: boolean;
  /** בכרטיס תורם – בלי עמודת תורם */
  hideDonor?: boolean;
  onOpen?: (r: RecurringRow) => void;
  onOpenDonor?: (donor: Donor) => void;
  emptyText?: string;
};

const formatIL = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '-');

/** טבלת הוראות קבע */
export default function RecurringList({
  rows,
  donorsById,
  today,
  canViewAmount,
  hideDonor,
  onOpen,
  onOpenDonor,
  emptyText = 'אין הוראות קבע',
}: Props) {
  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-slate-400 border border-dashed rounded-xl bg-white">{emptyText}</div>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {!hideDonor && <th className="p-2.5 text-right font-medium">תורם</th>}
            {canViewAmount && <th className="p-2.5 text-right font-medium">לחודש</th>}
            <th className="p-2.5 text-right font-medium">חיוב הבא</th>
            <th className="p-2.5 text-right font-medium">נותרו</th>
            <th className="p-2.5 text-right font-medium">חיוב אחרון</th>
            <th className="p-2.5 text-right font-medium">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const donor = r.donor_id ? donorsById?.get(r.donor_id) : undefined;
            const remaining = remainingCharges(r, today);
            const last = lastChargeDate(r);
            const soon = isEndingSoon(r, today);
            const status = r.status as RecurringStatus;
            return (
              <tr
                key={r.id}
                onClick={() => onOpen?.(r)}
                className={`border-t border-slate-100 ${onOpen ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                {!hideDonor && (
                  <td className="p-2.5">
                    {donor ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDonor?.(donor);
                        }}
                        className="font-medium text-slate-800 hover:text-blue-600 hover:underline text-right"
                      >
                        {donorDisplayName(donor)}
                      </button>
                    ) : (
                      <span className="text-slate-400">ללא תורם</span>
                    )}
                    {r.external_source === 'nedarim' && (
                      <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                        נדרים פלוס
                      </span>
                    )}
                  </td>
                )}
                {canViewAmount && (
                  <td className="p-2.5 font-semibold text-slate-800 whitespace-nowrap">{formatAmount(r.amount, r.currency)}</td>
                )}
                <td className="p-2.5 whitespace-nowrap">{formatIL(nextChargeDate(r, today))}</td>
                <td className="p-2.5 whitespace-nowrap">{remaining === null ? 'ללא הגבלה' : `${remaining} חודשים`}</td>
                <td className="p-2.5 whitespace-nowrap">
                  {formatIL(last)}
                  {soon && (
                    <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      מסתיימת בקרוב
                    </span>
                  )}
                </td>
                <td className="p-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${RECURRING_STATUS_STYLES[status] ?? ''}`}>
                    {RECURRING_STATUS_LABELS[status] ?? r.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
