'use client';

import { useState } from 'react';
import type { Donation, Donor } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import type { RecurringRow } from '@/lib/recurring/schedule';
import RecurringFormModal from '@/components/recurring/RecurringFormModal';
import { usePermissions } from '@/hooks/usePermissions';
import { Protect } from '@/components/Protect';
import { toast } from '@/components/Toaster';
import { PlusCircle, Download, RefreshCw } from 'lucide-react';
import SortSelect from '@/components/SortSelect';
import { downloadCsv, getDonationSortOptions, getPaymentMethodLabel } from './donations/donationUtils';
import { useDonationDocuments } from './donations/useDonationDocuments';
import { useDonationFilters } from './donations/useDonationFilters';
import DonationsFiltersPanel from './donations/DonationsFiltersPanel';
import DonationsSummary from './donations/DonationsSummary';
import DonationsTable from './donations/DonationsTable';

interface DonationsTabProps {
  donations: Donation[];
  donors: Donor[];
  donorMap: Map<string, Donor>;
  loading: boolean;
  getDonorName: (donorId: string | null) => string;
  onRefresh: () => void;
  onAddDonation: (donorId?: string, e?: React.MouseEvent) => void;
  onViewDonation: (donation: Donation, e?: React.MouseEvent) => void;
  onViewDonor: (donor: Donor) => void;
}

/** לשונית התרומות: כותרת, סינון, סיכום וטבלה */
export default function DonationsTab({
  donations,
  donors,
  donorMap,
  loading,
  getDonorName,
  onRefresh,
  onAddDonation,
  onViewDonation,
  onViewDonor,
}: DonationsTabProps) {
  // סכומים ופרטי התקשרות: מותר / חסום ("אין הרשאה") / מוסתר
  const { hasPermission, access, loadingPerms } = usePermissions();
  const amountAccess = access('donations_view_amount');
  const canViewAmount = amountAccess === 'allowed';
  const canViewContact = hasPermission('donors_view_contact');

  const { donationDocuments, loadingDonationDocuments, donationHasDocuments } =
    useDonationDocuments(donations);

  const filters = useDonationFilters({
    donations,
    donorMap,
    getDonorName,
    donationHasDocuments,
    canViewAmount,
    canViewContact,
  });
  const { filteredDonations } = filters;

  // הוראת הקבע שנפתחה מהתגית "הו"ק" בטבלה
  const [openedRecurring, setOpenedRecurring] = useState<RecurringRow | null>(null);

  async function openRecurring(donation: Donation) {
    if (!donation.recurring_external_id) return;
    const { data, error } = await supabase
      .from('recurring_donations')
      .select('*')
      .eq('external_source', donation.external_source || 'nedarim')
      .eq('external_id', donation.recurring_external_id)
      .maybeSingle();
    if (error) {
      toast.error(`טעינת הוראת הקבע נכשלה: ${error.message}`);
      return;
    }
    if (!data) {
      toast.info('הוראת הקבע של החיוב הזה לא קיימת במערכת (אולי נמחקה או עוד לא יובאה).');
      return;
    }
    setOpenedRecurring(data);
  }

  function exportFilteredDonations() {
    if (filteredDonations.length === 0) {
      toast.info('אין תרומות לייצוא לפי הסינון הנוכחי.');
      return;
    }

    // ללא הרשאה – לא מייצאים פרטי התקשרות / סכומים
    const columns: { header: string; value: (d: Donation) => unknown; show: boolean }[] = [
      { header: 'שם תורם', value: (d) => getDonorName(d.donor_id), show: true },
      { header: 'טלפון', value: (d) => donorOf(d)?.phone_1 || '', show: canViewContact },
      { header: 'אימייל', value: (d) => donorOf(d)?.email || '', show: canViewContact },
      { header: 'עיר', value: (d) => donorOf(d)?.city || '', show: canViewContact },
      { header: 'מדינה', value: (d) => donorOf(d)?.country || '', show: canViewContact },
      { header: 'סכום', value: (d) => d.amount, show: canViewAmount },
      { header: 'מטבע', value: (d) => d.currency || 'ILS', show: true },
      { header: 'אמצעי תשלום', value: (d) => getPaymentMethodLabel(d.payment_method), show: true },
      { header: 'הוראת קבע', value: (d) => (d.recurring_external_id ? `כן (${d.recurring_external_id})` : ''), show: true },
      { header: 'תאריך תרומה', value: (d) => d.donation_date || '', show: true },
      { header: 'תאריך יצירה', value: (d) => d.created_at || '', show: true },
      { header: 'מספר קבלה', value: (d) => d.receipt_number || '', show: true },
      { header: 'קובץ מצורף', value: (d) => (donationHasDocuments(d) ? 'כן' : 'לא'), show: true },
      { header: 'הערות', value: (d) => d.notes || '', show: true },
      { header: 'מזהה תרומה', value: (d) => d.id, show: true },
    ];
    const visible = columns.filter((c) => c.show);

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `תרומות_מסוננות_${today}.csv`,
      visible.map((c) => c.header),
      filteredDonations.map((d) => visible.map((c) => c.value(d)))
    );
  }

  function donorOf(donation: Donation) {
    return donation.donor_id ? donorMap.get(donation.donor_id) : undefined;
  }

  if (loadingPerms) {
    return <div className="p-8 text-center">טוען הרשאות...</div>;
  }

  if (!hasPermission('donations_view')) {
    return <div className="p-8 text-center text-red-600 font-bold">אין גישה למסך תרומות.</div>;
  }

  return (
    <div className="p-4 md:p-5 space-y-5">

      {/* ======================================================
          כותרת
      ====================================================== */}

      <div
        className="
          flex
          flex-col
          lg:flex-row
          justify-between
          items-start
          lg:items-center
          gap-3
        "
      >
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            תרומות
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            חיפוש, סינון וניהול כל התרומות
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <Protect permId="donations_export">
            <button
              onClick={exportFilteredDonations}
              className="
                bg-blue-600
                hover:bg-blue-700
                text-white
                font-medium
                px-4
                py-2.5
                rounded-xl
                text-xs
                flex
                items-center
                gap-2
                transition
                shadow-sm
              "
            >
              <Download className="w-4 h-4" />

              ייצוא לאקסל

              {filteredDonations.length > 0 &&
                ` (${filteredDonations.length})`}
            </button>
          </Protect>

          <Protect permId="donations_create">
          <button
            onClick={() =>
              onAddDonation()
            }
            className="
              bg-emerald-600
              hover:bg-emerald-700
              text-white
              font-medium
              px-4
              py-2.5
              rounded-xl
              text-xs
              flex
              items-center
              gap-2
              transition
              shadow-sm
            "
          >
            <PlusCircle className="w-4 h-4" />
            הוספת תרומה חדשה
          </button>
          </Protect>

          <button
            onClick={onRefresh}
            className="
              bg-white
              hover:bg-slate-50
              border
              border-slate-200
              text-slate-600
              px-3
              py-2.5
              rounded-xl
              text-xs
              flex
              items-center
              gap-2
            "
            title="רענון תרומות"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>
        </div>
      </div>


      <DonationsFiltersPanel filters={filters} canViewAmount={canViewAmount} canViewContact={canViewContact} />

      <DonationsSummary
        filteredCount={filteredDonations.length}
        totalCount={donations.length}
        donorCount={filters.filteredDonationDonorCount}
        totalsByCurrency={filters.filteredDonationTotals}
        amountAccess={amountAccess}
        filtered={filters.hasActiveDonationFilters}
        onClear={filters.clearDonationFilters}
      />

      <SortSelect
        value={filters.donationSort}
        onChange={filters.setDonationSort}
        options={getDonationSortOptions(canViewAmount)}
        info={`מציג ${filteredDonations.length} תרומות`}
      />

      <DonationsTable
        filteredDonations={filteredDonations}
        donorMap={donorMap}
        loading={loading}
        getDonorName={getDonorName}
        onViewDonation={onViewDonation}
        onViewDonor={onViewDonor}
        onOpenRecurring={openRecurring}
        amountAccess={amountAccess}
        canViewAmount={canViewAmount}
        canViewContact={canViewContact}
        donationDocuments={donationDocuments}
        loadingDonationDocuments={loadingDonationDocuments}
      />

      {openedRecurring && (
        <RecurringFormModal
          key={openedRecurring.id}
          recurring={openedRecurring}
          donors={donors}
          onClose={() => setOpenedRecurring(null)}
          onSaved={() => setOpenedRecurring(null)}
        />
      )}
    </div>
  );
}
