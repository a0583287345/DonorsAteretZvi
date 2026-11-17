'use client';

import { MapPin, User, Mail } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { Protect, LockedText } from '@/components/Protect';
import PhoneLink from '@/components/PhoneLink';
import { getFullAddress } from './donorUtils';

type Props = {
  donors: Donor[];
  filteredDonors: Donor[];
  loading: boolean;
  onViewDonor: (donor: Donor) => void;
  onAddDonation: (donorId?: string, e?: React.MouseEvent) => void;
  /** כתובת שנבחרה לניווט */
  setNavigationAddress: (address: string) => void;
  hasPermission: (permId: string) => boolean;
  showContactColumns: boolean;
  canViewContact: boolean;
};

/** טבלת התורמים (אחרי סינון) */
export default function DonorsTable({
  donors,
  filteredDonors,
  loading,
  onViewDonor,
  onAddDonation,
  setNavigationAddress,
  hasPermission,
  showContactColumns,
  canViewContact,
}: Props) {
  return (
    <>
      {/* טבלה */}

      {loading ? (
        <div className="text-center py-20 text-slate-500">
          טוען נתונים...
        </div>
      ) : filteredDonors.length === 0 ? (
        <div
          className="
            bg-white
            rounded-2xl
            p-12
            text-center
            border
            border-slate-200
            text-slate-400
          "
        >
          לא נמצאו תורמים התואמים את הסינון.
        </div>
      ) : (
        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            shadow-sm
            overflow-hidden
          "
        >
          <div className="overflow-x-auto">
            <table
              className="
                w-full
                text-right
                text-[11px]
              "
            >
              <thead
                className="
                  bg-slate-50
                  border-b
                  border-slate-200
                  text-slate-500
                  sticky
                  top-0
                  z-10
                "
              >
                <tr>
                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    שם התורם
                  </th>

                  {showContactColumns && (<>
                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    טלפונים
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    אימייל
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    כתובת
                  </th>
                  </>)}

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    איש קשר
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    הו&quot;ק
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    יששכר וזבולון
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    הערות
                  </th>

                  <th className="px-2.5 py-3 font-medium whitespace-nowrap">
                    פעולות
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDonors.map((donor) => {
                  const fullName =
                    `${donor.first_name_he || ''} ${
                      donor.last_name_he || ''
                    }`.trim();

                  const englishName =
                    `${donor.first_name_en || ''} ${
                      donor.last_name_en || ''
                    }`.trim();

                  const fullAddress =
                    getFullAddress(donor);

                  return (
                    <tr
                      key={donor.id}
                      className="hover:bg-slate-50 transition"
                    >
                      <td className="px-2.5 py-3 min-w-[145px]">
                        <button
                          type="button"
                          onClick={() =>
                            onViewDonor(donor)
                          }
                          className="text-right group max-w-full"
                        >
                          <div
                            className="
                              font-bold
                              text-blue-700
                              group-hover:text-blue-900
                              group-hover:underline
                              transition
                              truncate
                              max-w-[170px]
                            "
                          >
                            {fullName || 'ללא שם'}
                          </div>

                          {englishName && (
                            <div
                              dir="ltr"
                              className="
                                text-[9px]
                                text-slate-400
                                mt-0.5
                                text-right
                                truncate
                                max-w-[160px]
                              "
                            >
                              {englishName}
                            </div>
                          )}
                        </button>
                      </td>

                      {showContactColumns && (!canViewContact ? (
                        <td colSpan={3} className="px-2.5 py-3 text-center">
                          <LockedText />
                        </td>
                      ) : (<>
                      <td className="px-2.5 py-3 min-w-[115px]">
                        <div className="flex flex-col gap-1">
                          {donor.phone_1 && (
                            <PhoneLink phone={donor.phone_1} showIcon className="text-blue-600 hover:text-blue-800" />
                          )}

                          {donor.phone_2 && (
                            <PhoneLink phone={donor.phone_2} showIcon className="text-blue-600 hover:text-blue-800" />
                          )}

                          {!donor.phone_1 &&
                            !donor.phone_2 && (
                              <span className="text-slate-400">
                                -
                              </span>
                            )}
                        </div>
                      </td>

                      <td className="px-2.5 py-3 min-w-[155px]">
                        {donor.email ? (
                          <a
                            href={`mailto:${donor.email}`}
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                            dir="ltr"
                            className="
                              flex
                              items-center
                              gap-1
                              text-blue-600
                              hover:text-blue-800
                              hover:underline
                              max-w-[175px]
                            "
                          >
                            <Mail className="w-3 h-3 shrink-0" />

                            <span className="truncate">
                              {donor.email}
                            </span>
                          </a>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-3 min-w-[175px]">
                        {fullAddress ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNavigationAddress(
                                fullAddress
                              );
                            }}
                            className="
                              flex
                              items-start
                              gap-1.5
                              text-right
                              group
                              max-w-[210px]
                            "
                            title="לחץ לבחירת אפליקציית ניווט"
                          >
                            <MapPin
                              className="
                                w-3.5
                                h-3.5
                                text-blue-500
                                shrink-0
                                mt-0.5
                                group-hover:text-blue-700
                              "
                            />

                            <span
                              className="
                                text-slate-600
                                group-hover:text-blue-700
                                group-hover:underline
                                transition
                              "
                            >
                              {fullAddress}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>
                      </>))}

                      <td className="px-2.5 py-3 min-w-[125px]">
                        {donor.connected_contact ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />

                            <span
                              className="
                                text-slate-600
                                truncate
                                max-w-[130px]
                              "
                              title={
                                donor.connected_contact
                              }
                            >
                              {donor.connected_contact}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-3">
                        {donor.is_recurring ? (
                          <span
                            className="
                              bg-emerald-50
                              text-emerald-700
                              text-[9px]
                              px-1.5
                              py-0.5
                              rounded
                              border
                              border-emerald-200
                              whitespace-nowrap
                            "
                          >
                            הו&quot;ק
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-3 min-w-[120px]">
                        {donor.has_yissachar_zevulun ? (
                          <div>
                            <span
                              className="
                                bg-amber-50
                                text-amber-700
                                text-[9px]
                                px-1.5
                                py-0.5
                                rounded
                                border
                                border-amber-200
                                whitespace-nowrap
                              "
                            >
                              יששכר וזבולון
                            </span>

                            {donor.yissachar_zevulun_name && (
                              <div
                                className="
                                  text-[9px]
                                  text-slate-500
                                  mt-1
                                  truncate
                                  max-w-[120px]
                                "
                                title={
                                  donor.yissachar_zevulun_name
                                }
                              >
                                {
                                  donor.yissachar_zevulun_name
                                }
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-3 min-w-[150px] max-w-[220px]">
                        {donor.notes ? (
                          <div
                            className="
                              text-slate-600
                              whitespace-pre-line
                              line-clamp-2
                              max-w-[210px]
                            "
                            title={donor.notes}
                          >
                            {donor.notes}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-3 whitespace-nowrap">
                        <Protect permId="donations_create">
                        <button
                          type="button"
                          onClick={(e) =>
                            onAddDonation(
                              donor.id,
                              e
                            )
                          }
                          className="
                            px-2.5
                            py-1.5
                            bg-emerald-50
                            text-emerald-700
                            border
                            border-emerald-200
                            hover:bg-emerald-100
                            rounded-lg
                            text-[10px]
                            font-medium
                            transition
                          "
                        >
                          + תרומה
                        </button>
                        </Protect>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="
              px-3
              py-2.5
              bg-slate-50
              border-t
              border-slate-100
              flex
              flex-col
              sm:flex-row
              items-start
              sm:items-center
              justify-between
              gap-2
              text-[11px]
              text-slate-500
            "
          >
            <span>
              מציג {filteredDonors.length} מתוך{' '}
              {donors.length} תורמים
            </span>

            {hasPermission('donors_export') ? (
              <span>
                ייצוא לאקסל יכלול רק את התורמים
                המוצגים לאחר הסינון
              </span>
            ) : (
              <span>
                אין הרשאה לייצוא נתוני תורמים
              </span>
            )}
          </div>
        </div>
      )}

    </>
  );
}
