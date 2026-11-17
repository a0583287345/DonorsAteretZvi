'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Donation, Donor } from '@/types/donor';
import { usePermissions } from '@/hooks/usePermissions';
import { Protect } from '@/components/Protect';
import { UserPlus, Download, GitMerge, FileSpreadsheet } from 'lucide-react';
import ImportExcelModal from './import/ImportExcelModal';
import DuplicatesModal from './donors/duplicates/DuplicatesModal';
import { exportDonorsToExcel } from './donors/donorUtils';
import { getDonorSortOptions, useDonorFilters } from './donors/useDonorFilters';
import DonorsFiltersPanel from './donors/DonorsFiltersPanel';
import DonorsSummary from './donors/DonorsSummary';
import SortSelect from '@/components/SortSelect';
import DonorsTable from './donors/DonorsTable';
import NavigationPicker from './donors/NavigationPicker';

interface DonorsTabProps {
  donors: Donor[];
  /** לצורך מיון לפי תרומה אחרונה / מספר תרומות */
  donations: Donation[];
  loading: boolean;
  onCreateDonor: () => void;
  onViewDonor: (donor: Donor) => void;
  onAddDonation: (donorId?: string, e?: React.MouseEvent) => void;
  /** רענון תורמים ותרומות (אחרי מיזוג / ייבוא) */
  onRefresh: () => void;
}

/** לשונית התורמים: כותרת, חיפוש וסינון, טבלה וחלון ניווט */
export default function DonorsTab({
  donors,
  donations,
  loading,
  onCreateDonor,
  onViewDonor,
  onAddDonation,
  onRefresh,
}: DonorsTabProps) {
  const { hasPermission, access, loadingPerms } = usePermissions();

  // פרטי התקשרות: מותר / חסום ("אין הרשאה") / מוסתר (העמודות לא מוצגות)
  const contactAccess = access('donors_view_contact');
  const showContactColumns = contactAccess !== 'hidden';
  const canViewContact = contactAccess === 'allowed';

  const filters = useDonorFilters(donors, donations, canViewContact);
  const { filteredDonors } = filters;

  // כתובת שנבחרה לניווט (פותח חלון בחירת אפליקציה)
  const [navigationAddress, setNavigationAddress] = useState<string | null>(null);

  // בירור כפילויות + מספר התורמים המיובאים שממתינים לבדיקה
  const canMerge = hasPermission('donors_merge');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [pendingReview, setPendingReview] = useState(0);
  useEffect(() => {
    if (!canMerge || showDuplicates) return;
    let active = true;
    const t = setTimeout(async () => {
      const { count } = await supabase
        .from('import_review')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (active) setPendingReview(count ?? 0);
    }, 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [canMerge, showDuplicates, donors]);

  const exportToExcel = () => {
    // בדיקת הרשאה גם כאן, לא רק בכפתור
    if (!hasPermission('donors_export') || filteredDonors.length === 0) return;
    exportDonorsToExcel(filteredDonors, canViewContact);
  };

  if (loadingPerms) {
    return <div className="p-8 text-center">טוען הרשאות...</div>;
  }

  if (!hasPermission('donors_view')) {
    return <div className="p-8 text-center text-red-600 font-bold">אין גישה למסך תורמים.</div>;
  }

  return (
    <div
      className="p-4 md:p-5 space-y-5"
      dir="rtl"
    >
      {/* כותרת */}

      <div
        className="
          flex
          flex-col
          md:flex-row
          justify-between
          items-start
          md:items-center
          gap-3
        "
      >
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            תורמים
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            ניהול רשימת התורמים והפרטים שלהם
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Protect permId="donors_merge">
            <button
              onClick={() => setShowDuplicates(true)}
              className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <GitMerge className="w-4 h-4" />
              בירור כפילויות
              {pendingReview > 0 && (
                <span
                  className="absolute -top-2 -left-2 min-w-5 h-5 px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center"
                  title="תורמים מיובאים שממתינים לבדיקה"
                >
                  {pendingReview}
                </span>
              )}
            </button>
          </Protect>

          <Protect permId="donors_create">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              ייבוא מאקסל
            </button>
          </Protect>

          <Protect permId="donors_export">
            <button
              onClick={exportToExcel}
              disabled={filteredDonors.length === 0}
              className="
                flex
                items-center
                gap-2
                px-3.5
                py-2.5
                rounded-xl
                text-xs
                font-medium
                bg-emerald-600
                hover:bg-emerald-700
                disabled:bg-slate-300
                disabled:cursor-not-allowed
                text-white
                transition
                shadow-sm
              "
            >
              <Download className="w-4 h-4" />
              ייצוא לאקסל
            </button>
          </Protect>

          <Protect permId="donors_create">
          <button
            onClick={onCreateDonor}
            className="
              bg-blue-600
              hover:bg-blue-700
              text-white
              font-medium
              px-3.5
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
            <UserPlus className="w-4 h-4" />
            הוספת תורם חדש
          </button>
          </Protect>
        </div>
      </div>


      <DonorsFiltersPanel filters={filters} canViewContact={canViewContact} />

      <DonorsSummary filters={filters} totalCount={donors.length} />

      <SortSelect
        value={filters.sort}
        onChange={filters.setSort}
        options={getDonorSortOptions(canViewContact)}
        info={`מציג ${filteredDonors.length} תורמים`}
      />

      <DonorsTable
        donors={donors}
        filteredDonors={filteredDonors}
        loading={loading}
        onViewDonor={onViewDonor}
        onAddDonation={onAddDonation}
        setNavigationAddress={setNavigationAddress}
        hasPermission={hasPermission}
        showContactColumns={showContactColumns}
        canViewContact={canViewContact}
      />

      <NavigationPicker address={navigationAddress} onClose={() => setNavigationAddress(null)} />

      {showImport && (
        <ImportExcelModal
          donors={donors}
          donations={donations}
          onClose={() => setShowImport(false)}
          onImported={onRefresh}
        />
      )}

      {showDuplicates && canMerge && (
        <DuplicatesModal
          donors={donors}
          initialTab={pendingReview > 0 ? 'review' : 'duplicates'}
          onClose={() => setShowDuplicates(false)}
          onChanged={onRefresh}
        />
      )}
    </div>
  );
}
