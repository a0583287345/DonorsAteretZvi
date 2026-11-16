'use client';

import { useMemo, useState } from 'react';
import { Link2, UserPlus, Ban, Search } from 'lucide-react';
import type { Donor } from '@/types/donor';
import type { Tables } from '@/types/database';
import {
  donorDisplayName,
  nameTokens,
  normalizePhone,
  type IncomingDonor,
} from '@/lib/import/donorMatch';
import { formatAmount, formatDate } from '@/components/donations/donationUtils';

export type ReviewItem = Tables<'import_review'>;

type Payload = {
  amount?: number;
  currency?: string;
  date?: string | null;
  installments?: number | null;
  category?: string | null;
  monthsTotal?: number | null;
  monthsRemaining?: number | null;
  status?: string;
};

type Props = {
  item: ReviewItem;
  donors: Donor[];
  donorsById: Map<string, Donor>;
  canViewAmount: boolean;
  canViewContact: boolean;
  busy: boolean;
  onResolve: (action: 'link' | 'create' | 'ignore', donorId?: string) => void;
};

/** פריט מיובא שלא ברור למי הוא שייך: שיוך לתורם קיים / תורם חדש / לא לייבא */
export default function ImportReviewCard({ item, donors, donorsById, canViewAmount, canViewContact, busy, onResolve }: Props) {
  const incoming = item.incoming_donor as unknown as IncomingDonor;
  const payload = (item.incoming_payload ?? {}) as Payload;
  const isRecurring = item.payload_kind === 'recurring';
  const [search, setSearch] = useState('');

  const candidates = item.candidate_donor_ids.map((id) => donorsById.get(id)).filter((d): d is Donor => !!d);

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (q.length < 2) return [];
    const tokens = nameTokens(q);
    const phone = normalizePhone(q);
    return donors
      .filter((d) => {
        if (phone && canViewContact && [d.phone_1, d.phone_2].some((p) => normalizePhone(p) === phone)) return true;
        if (d.zeout && q.replace(/[^0-9]/g, '').length >= 5 && d.zeout.includes(q.replace(/[^0-9]/g, ''))) return true;
        const name = nameTokens(d.first_name_he, d.last_name_he, d.first_name_en, d.last_name_en);
        return tokens.length > 0 && tokens.every((t) => name.some((n) => n.startsWith(t)));
      })
      .slice(0, 6);
  }, [search, donors, canViewContact]);

  const incomingName =
    incoming.full_name || [incoming.first_name, incoming.last_name].filter(Boolean).join(' ') || 'ללא שם';

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800">{incomingName}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              נדרים פלוס · {isRecurring ? 'הוראת קבע' : 'תרומה'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {incoming.zeout && <span>ת&quot;ז: {incoming.zeout}</span>}
            {canViewContact && incoming.phone && <span>טלפון: {incoming.phone}</span>}
            {canViewContact && incoming.email && <span>מייל: {incoming.email}</span>}
            {canViewContact && (incoming.street || incoming.city) && (
              <span>כתובת: {[incoming.street, incoming.city].filter(Boolean).join(', ')}</span>
            )}
          </div>
        </div>
        <div className="text-xs text-slate-600 text-left">
          {canViewAmount && payload.amount !== undefined && (
            <div className="font-semibold text-slate-800">
              {formatAmount(payload.amount, payload.currency)}
              {isRecurring ? ' לחודש' : ''}
            </div>
          )}
          {!isRecurring && payload.date && <div>{formatDate(payload.date)}</div>}
          {isRecurring && (
            <div>
              {payload.monthsTotal ? `${payload.monthsTotal} חודשים` : 'ללא הגבלה'}
              {payload.monthsRemaining != null ? ` · נותרו ${payload.monthsRemaining}` : ''}
            </div>
          )}
          {payload.category && <div>{payload.category}</div>}
        </div>
      </div>

      {item.reason && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">{item.reason}</p>}

      {candidates.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">תורמים אפשריים במערכת:</p>
          {candidates.map((d) => (
            <DonorChoice key={d.id} donor={d} canViewContact={canViewContact} busy={busy} onPick={() => onResolve('link', d.id)} />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={canViewContact ? 'חיפוש תורם אחר לפי שם, טלפון או ת"ז' : 'חיפוש תורם אחר לפי שם או ת"ז'}
            className="w-full pr-8 p-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        {searchResults.map((d) => (
          <DonorChoice key={d.id} donor={d} canViewContact={canViewContact} busy={busy} onPick={() => onResolve('link', d.id)} />
        ))}
        {search.trim().length >= 2 && searchResults.length === 0 && (
          <p className="text-[11px] text-slate-400">לא נמצאו תורמים</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-end pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve('ignore')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Ban className="w-4 h-4" />
          לא לייבא
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve('create')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          תורם חדש
        </button>
      </div>
    </div>
  );
}

function DonorChoice({
  donor,
  canViewContact,
  busy,
  onPick,
}: {
  donor: Donor;
  canViewContact: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const details = [
    donor.zeout ? `ת"ז ${donor.zeout}` : null,
    canViewContact ? donor.phone_1 : null,
    canViewContact ? donor.email : null,
    canViewContact ? donor.city : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-100 bg-slate-50/60">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-800">{donorDisplayName(donor)}</div>
        {details.length > 0 && <div className="text-[11px] text-slate-500 truncate">{details.join(' · ')}</div>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        <Link2 className="w-3.5 h-3.5" />
        שייך לתורם הזה
      </button>
    </div>
  );
}
