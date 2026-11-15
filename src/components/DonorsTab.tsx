'use client';

import { useState } from 'react';
import type { Donor } from '@/types/donor';
import { usePermissions } from '@/hooks/usePermissions';
import { Protect } from '@/components/Protect';
import { UserPlus, Download } from 'lucide-react';
import { exportDonorsToExcel } from './donors/donorUtils';
import { useDonorFilters } from './donors/useDonorFilters';
import DonorsFiltersPanel from './donors/DonorsFiltersPanel';
import DonorsTable from './donors/DonorsTable';
import NavigationPicker from './donors/NavigationPicker';

interface DonorsTabProps {
  donors: Donor[];
  loading: boolean;
  onCreateDonor: () => void;
  onViewDonor: (donor: Donor) => void;
  onAddDonation: (donorId?: string, e?: React.MouseEvent) => void;
}

/** לשונית התורמים: כותרת, חיפוש וסינון, טבלה וחלון ניווט */
export default function DonorsTab({
  donors,
  loading,
  onCreateDonor,
  onViewDonor,
  onAddDonation,
}: DonorsTabProps) {
  const { hasPermission, access, loadingPerms } = usePermissions();

  // פרטי התקשרות: מותר / חסום ("אין הרשאה") / מוסתר (העמודות לא מוצגות)
  const contactAccess = access('donors_view_contact');
  const showContactColumns = contactAccess !== 'hidden';
  const canViewContact = contactAccess === 'allowed';

  const filters = useDonorFilters(donors, canViewContact);
  const { filteredDonors } = filters;

  // כתובת שנבחרה לניווט (פותח חלון בחירת אפליקציה)
  const [navigationAddress, setNavigationAddress] = useState<string | null>(null);

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
    </div>
  );
}
