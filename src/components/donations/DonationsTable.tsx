'use client';

import {
  FileSpreadsheet,
  RefreshCw,
  CreditCard,
  Calendar,
  Receipt,
  Paperclip,
  StickyNote,
  ExternalLink,
  Repeat,
} from 'lucide-react';
import type { Donation, Donor } from '@/types/donor';
import type { PermissionAccess } from '@/lib/permissions';
import { LockedText } from '@/components/Protect';
import { openSecureFile } from '@/lib/storage';
import {
  formatAmount,
  formatDate,
  getPaymentMethodLabel,
  type DonationDocument,
} from './donationUtils';

type Props = {
  filteredDonations: Donation[];
  donorMap: Map<string, Donor>;
  loading: boolean;
  getDonorName: (donorId: string | null) => string;
  onViewDonation: (donation: Donation, e?: React.MouseEvent) => void;
  onViewDonor: (donor: Donor) => void;
  /** לחיצה על התגית "הו"ק" – פתיחת הוראת הקבע של החיוב */
  onOpenRecurring?: (donation: Donation) => void;
  amountAccess: PermissionAccess;
  canViewAmount: boolean;
  canViewContact: boolean;
  donationDocuments: Record<string, DonationDocument[]>;
  loadingDonationDocuments: boolean;
};

/** טבלת התרומות (אחרי סינון ומיון) */
export default function DonationsTable({
  filteredDonations,
  donorMap,
  loading,
  getDonorName,
  onViewDonation,
  onViewDonor,
  onOpenRecurring,
  amountAccess,
  canViewAmount,
  canViewContact,
  donationDocuments,
  loadingDonationDocuments,
}: Props) {
  return (
    <>
      {/* ======================================================
          טבלת תרומות
      ====================================================== */}

      {loading ? (
        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-16
            text-center
            text-slate-400
          "
        >
          <RefreshCw
            className="
              w-6
              h-6
              animate-spin
              mx-auto
              mb-3
            "
          />

          טוען תרומות...
        </div>
      ) : filteredDonations.length === 0 ? (
        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-16
            text-center
          "
        >
          <FileSpreadsheet
            className="
              w-10
              h-10
              mx-auto
              text-slate-300
              mb-3
            "
          />

          <div className="font-bold text-slate-600">
            לא נמצאו תרומות
          </div>

          <div className="text-xs text-slate-400 mt-1">
            נסה לשנות את תנאי החיפוש או הסינון
          </div>
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

            <table className="w-full text-right text-xs">

              <thead
                className="
                  bg-slate-50
                  border-b
                  border-slate-200
                  text-slate-500
                "
              >
                <tr>
                  <th className="p-3.5 font-medium">
                    תורם
                  </th>

                  {amountAccess !== 'hidden' && (
                  <th className="p-3.5 font-medium">
                    סכום
                  </th>
                  )}

                  <th className="p-3.5 font-medium">
                    אמצעי תשלום
                  </th>

                  <th className="p-3.5 font-medium">
                    תאריך תרומה
                  </th>

                  <th className="p-3.5 font-medium">
                    נוצרה
                  </th>

                  <th className="p-3.5 font-medium">
                    קבלה
                  </th>

                  <th className="p-3.5 font-medium">
                    קובץ
                  </th>

                  <th className="p-3.5 font-medium">
                    הערות
                  </th>

                  <th className="p-3.5 font-medium">
                    פעולות
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredDonations.map(
                  (donation) => {
                    const donor =
                      donation.donor_id
                        ? donorMap.get(
                            donation.donor_id
                          )
                        : null;

                    const documents =
                      donationDocuments[
                        donation.id
                      ] || [];

                    const validDocuments =
                      documents.filter(
                        (document) =>
                          !!document.file_url?.trim()
                      );

                    const hasDonationFile =
                      !!donation.file_url?.trim() ||
                      validDocuments.length > 0;

                    const firstDocument =
                      validDocuments[0];

                    return (
                      <tr
                        key={donation.id}
                        onClick={() =>
                          onViewDonation(
                            donation
                          )
                        }
                        className="
                          hover:bg-slate-50
                          transition
                          cursor-pointer
                        "
                      >

                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">
                            {getDonorName(
                              donation.donor_id
                            )}
                          </div>

                          {canViewContact && donor?.phone_1 && (
                            <div
                              dir="ltr"
                              className="
                                text-[10px]
                                text-slate-400
                                mt-1
                              "
                            >
                              {donor.phone_1}
                            </div>
                          )}
                        </td>

                        {amountAccess !== 'hidden' && (
                        <td className="p-3.5">
                          {canViewAmount ? (
                          <div
                            className="
                              font-bold
                              text-emerald-700
                            "
                          >
                            {formatAmount(
                              donation.amount,
                              donation.currency
                            )}
                          </div>
                          ) : (
                            <LockedText />
                          )}
                        </td>
                        )}

                        <td className="p-3.5">
                          {donation.payment_method ? (
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                bg-slate-100
                                text-slate-700
                                rounded-lg
                                px-2
                                py-1
                              "
                            >
                              <CreditCard className="w-3 h-3" />

                              {getPaymentMethodLabel(
                                donation.payment_method
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              -
                            </span>
                          )}
                          {donation.external_source === 'nedarim' && (
                            <span
                              className="inline-flex mt-1 mr-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200"
                              title={donation.external_id ? `מספר עסקה בנדרים פלוס: ${donation.external_id}` : undefined}
                            >
                              נדרים פלוס
                            </span>
                          )}
                          {donation.recurring_external_id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRecurring?.(donation);
                              }}
                              className="inline-flex items-center gap-1 mt-1 mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                              title={`חיוב של הוראת קבע מספר ${donation.recurring_external_id} – לחצו לפרטי ההוראה`}
                            >
                              <Repeat className="w-3 h-3" />
                              הו&quot;ק
                            </button>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div
                            className="
                              flex
                              items-center
                              gap-1.5
                              text-slate-600
                            "
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />

                            {formatDate(
                              donation.donation_date
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div
                            className="
                              flex
                              items-center
                              gap-1.5
                              text-slate-600
                            "
                            title={
                              donation.created_at || ''
                            }
                          >
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />

                            {formatDate(
                              donation.created_at
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          {donation.receipt_number ? (
                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1
                                bg-blue-50
                                text-blue-700
                                border
                                border-blue-200
                                rounded-lg
                                px-2
                                py-1
                              "
                            >
                              <Receipt className="w-3 h-3" />

                              {donation.receipt_number}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              אין
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {hasDonationFile ? (
                            firstDocument?.file_url ? (
                              <a
                                href="#"
                                onClick={(e) => openSecureFile(e, firstDocument.file_url)}
                                className="
                                  inline-flex
                                  items-center
                                  gap-1
                                  bg-purple-50
                                  text-purple-700
                                  border
                                  border-purple-200
                                  rounded-lg
                                  px-2
                                  py-1
                                  hover:bg-purple-100
                                "
                                title={
                                  firstDocument.file_name ||
                                  'מסמך מצורף'
                                }
                              >
                                <Paperclip className="w-3 h-3" />

                                צפייה
                              </a>
                            ) : donation.file_url ? (
                              <a
                                href="#"
                                onClick={(e) => openSecureFile(e, donation.file_url)}
                                className="
                                  inline-flex
                                  items-center
                                  gap-1
                                  bg-purple-50
                                  text-purple-700
                                  border
                                  border-purple-200
                                  rounded-lg
                                  px-2
                                  py-1
                                  hover:bg-purple-100
                                "
                              >
                                <ExternalLink className="w-3 h-3" />

                                צפייה
                              </a>
                            ) : (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-1
                                  bg-purple-50
                                  text-purple-700
                                  border
                                  border-purple-200
                                  rounded-lg
                                  px-2
                                  py-1
                                "
                              >
                                <Paperclip className="w-3 h-3" />

                                יש קובץ
                              </span>
                            )
                          ) : loadingDonationDocuments ? (
                            <span className="text-slate-400">
                              בודק...
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              אין
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 max-w-[220px]">
                          {donation.notes ? (
                            <div
                              className="
                                flex
                                items-start
                                gap-1.5
                                text-slate-600
                              "
                              title={
                                donation.notes
                              }
                            >
                              <StickyNote
                                className="
                                  w-3.5
                                  h-3.5
                                  text-slate-400
                                  shrink-0
                                  mt-0.5
                                "
                              />

                              <span className="truncate">
                                {donation.notes}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              -
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {donor ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();

                                onViewDonor(
                                  donor
                                );
                              }}
                              className="
                                px-2.5
                                py-1
                                bg-blue-50
                                text-blue-700
                                border
                                border-blue-200
                                hover:bg-blue-100
                                rounded-lg
                                text-[11px]
                              "
                            >
                              תורם
                            </button>
                          ) : (
                            <span className="text-slate-400">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}

              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
