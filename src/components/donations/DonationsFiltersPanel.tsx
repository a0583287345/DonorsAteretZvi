'use client';

import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Donor } from '@/types/donor';
import { getPaymentMethodLabel, type DonationSort } from './donationUtils';
import type { DonationFilters } from './useDonationFilters';

type Props = {
  filters: DonationFilters;
  donors: Donor[];
  getDonorName: (donorId: string | null) => string;
  /** בלי הרשאה לראות סכומים – לא מציגים סינון/מיון לפי סכום */
  canViewAmount: boolean;
};

/** חיפוש, פילטרים מהירים וסינון מתקדם של רשימת התרומות */
export default function DonationsFiltersPanel({ filters, donors, getDonorName, canViewAmount }: Props) {
  const {
    donationSearch,
    setDonationSearch,
    donationCurrency,
    setDonationCurrency,
    donationPaymentMethod,
    setDonationPaymentMethod,
    donationDonorId,
    setDonationDonorId,
    donationMinAmount,
    setDonationMinAmount,
    donationMaxAmount,
    setDonationMaxAmount,
    donationDateFrom,
    setDonationDateFrom,
    donationDateTo,
    setDonationDateTo,
    donationHasReceipt,
    setDonationHasReceipt,
    donationHasFile,
    setDonationHasFile,
    donationHasNotes,
    setDonationHasNotes,
    donationSort,
    setDonationSort,
    showAdvancedDonationFilters,
    setShowAdvancedDonationFilters,
    donationCurrencies,
    donationPaymentMethods,
    hasActiveDonationFilters,
    clearDonationFilters,
  } = filters;

  return (
    <>
      {/* ======================================================
          סינון
      ====================================================== */}

      <div
        className="
          bg-slate-50
          rounded-2xl
          border
          border-slate-200
          p-4
          space-y-3
        "
      >
        <div
          className="
            flex
            flex-col
            lg:flex-row
            gap-3
          "
        >
          <div className="relative flex-1">

            <Search
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                w-4
                h-4
                text-slate-400
              "
            />

            <input
              type="text"
              value={donationSearch}
              onChange={(e) =>
                setDonationSearch(
                  e.target.value
                )
              }
              placeholder="חפש לפי שם תורם, טלפון, סכום, קבלה, אמצעי תשלום, הערות..."
              className="
                w-full
                pr-9
                pl-4
                py-2.5
                bg-white
                border
                border-slate-200
                rounded-xl
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500/20
                focus:border-blue-500
              "
            />
          </div>

          <button
            onClick={() =>
              setShowAdvancedDonationFilters(
                !showAdvancedDonationFilters
              )
            }
            className="
              bg-white
              border
              border-slate-200
              text-slate-700
              rounded-xl
              px-4
              py-2.5
              text-xs
              font-medium
              flex
              items-center
              justify-center
              gap-2
            "
          >
            <Filter className="w-4 h-4" />

            סינון מתקדם

            {showAdvancedDonationFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {hasActiveDonationFilters && (
            <button
              onClick={clearDonationFilters}
              className="
                bg-white
                border
                border-red-200
                text-red-600
                rounded-xl
                px-4
                py-2.5
                text-xs
                font-medium
                flex
                items-center
                justify-center
                gap-2
              "
            >
              <X className="w-4 h-4" />
              נקה סינון
            </button>
          )}
        </div>

        {/* פילטרים מהירים */}

        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-4
            lg:grid-cols-6
            gap-2
          "
        >
          <select
            value={donationCurrency}
            onChange={(e) =>
              setDonationCurrency(
                e.target.value
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="all">
              כל המטבעות
            </option>

            {donationCurrencies.map(
              (currency) => (
                <option
                  key={currency}
                  value={currency}
                >
                  {currency}
                </option>
              )
            )}
          </select>

          <select
            value={donationPaymentMethod}
            onChange={(e) =>
              setDonationPaymentMethod(
                e.target.value
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="all">
              כל אמצעי התשלום
            </option>

            {donationPaymentMethods.map(
              (method) => (
                <option
                  key={method}
                  value={method}
                >
                  {getPaymentMethodLabel(method)}
                </option>
              )
            )}
          </select>

          <select
            value={donationDonorId}
            onChange={(e) =>
              setDonationDonorId(
                e.target.value
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="all">
              כל התורמים
            </option>

            {donors
              .slice()
              .sort((a, b) =>
                getDonorName(
                  a.id
                ).localeCompare(
                  getDonorName(
                    b.id
                  ),
                  'he'
                )
              )
              .map((donor) => (
                <option
                  key={donor.id}
                  value={donor.id}
                >
                  {getDonorName(
                    donor.id
                  )}
                </option>
              ))}
          </select>

          <select
            value={donationSort}
            onChange={(e) =>
              setDonationSort(
                e.target.value as DonationSort
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="created_desc">
              נוצרה: חדש → ישן
            </option>

            <option value="created_asc">
              נוצרה: ישן → חדש
            </option>

            <option value="date_desc">
              תאריך תרומה: חדש → ישן
            </option>

            <option value="date_asc">
              תאריך תרומה: ישן → חדש
            </option>

            {canViewAmount && (
              <>
                <option value="amount_desc">
                  סכום: גבוה → נמוך
                </option>

                <option value="amount_asc">
                  סכום: נמוך → גבוה
                </option>
              </>
            )}

            <option value="donor_asc">
              תורם: א → ת
            </option>

            <option value="donor_desc">
              תורם: ת → א
            </option>
          </select>

          <select
            value={donationHasReceipt}
            onChange={(e) =>
              setDonationHasReceipt(
                e.target.value as
                  | 'all'
                  | 'yes'
                  | 'no'
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="all">
              כל הקבלות
            </option>

            <option value="yes">
              יש מספר קבלה
            </option>

            <option value="no">
              אין מספר קבלה
            </option>
          </select>

          <select
            value={donationHasFile}
            onChange={(e) =>
              setDonationHasFile(
                e.target.value as
                  | 'all'
                  | 'yes'
                  | 'no'
              )
            }
            className="
              bg-white
              border
              border-slate-200
              rounded-xl
              px-3
              py-2
              text-xs
              text-slate-700
            "
          >
            <option value="all">
              כל הקבצים
            </option>

            <option value="yes">
              יש קובץ
            </option>

            <option value="no">
              אין קובץ
            </option>
          </select>
        </div>

        {/* סינון מתקדם */}

        {showAdvancedDonationFilters && (
          <div
            className="
              border-t
              border-slate-200
              pt-3
              grid
              grid-cols-1
              md:grid-cols-2
              lg:grid-cols-4
              gap-3
            "
          >
            {canViewAmount && (<>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                סכום מינימום
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={donationMinAmount}
                onChange={(e) =>
                  setDonationMinAmount(
                    e.target.value
                  )
                }
                placeholder="ללא הגבלה"
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                סכום מקסימום
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={donationMaxAmount}
                onChange={(e) =>
                  setDonationMaxAmount(
                    e.target.value
                  )
                }
                placeholder="ללא הגבלה"
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              />
            </div>
            </>)}

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                מתאריך
              </label>

              <input
                type="date"
                value={donationDateFrom}
                onChange={(e) =>
                  setDonationDateFrom(
                    e.target.value
                  )
                }
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                עד תאריך
              </label>

              <input
                type="date"
                value={donationDateTo}
                onChange={(e) =>
                  setDonationDateTo(
                    e.target.value
                  )
                }
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                הערות
              </label>

              <select
                value={donationHasNotes}
                onChange={(e) =>
                  setDonationHasNotes(
                    e.target.value as
                      | 'all'
                      | 'yes'
                      | 'no'
                  )
                }
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              >
                <option value="all">
                  עם ובלי הערות
                </option>

                <option value="yes">
                  יש הערות
                </option>

                <option value="no">
                  אין הערות
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                קובץ מצורף
              </label>

              <select
                value={donationHasFile}
                onChange={(e) =>
                  setDonationHasFile(
                    e.target.value as
                      | 'all'
                      | 'yes'
                      | 'no'
                  )
                }
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              >
                <option value="all">
                  עם ובלי קובץ
                </option>

                <option value="yes">
                  יש קובץ
                </option>

                <option value="no">
                  אין קובץ
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                מספר קבלה
              </label>

              <select
                value={donationHasReceipt}
                onChange={(e) =>
                  setDonationHasReceipt(
                    e.target.value as
                      | 'all'
                      | 'yes'
                      | 'no'
                  )
                }
                className="
                  w-full
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  px-3
                  py-2
                  text-xs
                "
              >
                <option value="all">
                  עם ובלי קבלה
                </option>

                <option value="yes">
                  יש מספר קבלה
                </option>

                <option value="no">
                  אין מספר קבלה
                </option>
              </select>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
