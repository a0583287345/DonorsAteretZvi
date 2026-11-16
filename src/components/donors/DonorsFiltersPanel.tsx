'use client';

import { Search, RotateCcw } from 'lucide-react';
import type { DonorFilters } from './useDonorFilters';

type Props = {
  filters: DonorFilters;
  /** בלי הרשאה לראות פרטי התקשרות – לא מציגים סינון לפי טלפון, אימייל וכתובת */
  canViewContact: boolean;
};

/** חיפוש וסינון של רשימת התורמים */
export default function DonorsFiltersPanel({ filters, canViewContact }: Props) {
  const {
    searchQuery,
    setSearchQuery,
    countryFilter,
    setCountryFilter,
    cityFilter,
    setCityFilter,
    streetFilter,
    setStreetFilter,
    contactFilter,
    setContactFilter,
    recurringFilter,
    setRecurringFilter,
    yissacharFilter,
    setYissacharFilter,
    emailFilter,
    setEmailFilter,
    phoneFilter,
    setPhoneFilter,
    notesFilter,
    setNotesFilter,
    showFilters,
    setShowFilters,
    countries,
    cities,
    streets,
    contacts,
    resetFilters,
  } = filters;

  return (
    <>
      {/* חיפוש וסינון */}

      <div
        className="
          bg-slate-50
          p-3
          rounded-2xl
          border
          border-slate-200
          space-y-3
        "
      >
        <div className="flex flex-col xl:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="
                w-4
                h-4
                text-slate-400
                absolute
                right-3
                top-1/2
                -translate-y-1/2
              "
            />

            <input
              type="text"
              placeholder="חיפוש בכל פרטי התורם..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              className="
                w-full
                pr-9
                pl-4
                py-2.5
                border
                border-slate-200
                bg-white
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
              setShowFilters(!showFilters)
            }
            className="
              px-4
              py-2
              rounded-xl
              bg-white
              border
              border-slate-200
              text-xs
              font-medium
              text-slate-600
              hover:bg-slate-100
              whitespace-nowrap
            "
          >
            {showFilters
              ? 'הסתר סינון מתקדם'
              : 'סינון מתקדם'}
          </button>

          <button
            onClick={resetFilters}
            className="
              px-3
              py-2
              rounded-xl
              bg-white
              border
              border-slate-200
              text-slate-500
              hover:bg-slate-100
              flex
              items-center
              justify-center
            "
            title="איפוס סינונים"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div
          className="
            grid
            grid-cols-2
            sm:grid-cols-4
            lg:grid-cols-4
            xl:grid-cols-4
            gap-2
          "
        >
          {canViewContact && (<>
          <select
            value={countryFilter}
            onChange={(e) =>
              setCountryFilter(e.target.value)
            }
            className="
              w-full
              px-3
              py-2
              bg-white
              border
              border-slate-200
              rounded-xl
              text-xs
              text-slate-600
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500/20
            "
          >
            <option value="">כל המדינות</option>

            {countries.map((country) => (
              <option
                key={country}
                value={country || ''}
              >
                {country}
              </option>
            ))}
          </select>

          <select
            value={cityFilter}
            onChange={(e) =>
              setCityFilter(e.target.value)
            }
            className="
              w-full
              px-3
              py-2
              bg-white
              border
              border-slate-200
              rounded-xl
              text-xs
              text-slate-600
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500/20
            "
          >
            <option value="">כל הערים</option>

            {cities.map((city) => (
              <option
                key={city}
                value={city || ''}
              >
                {city}
              </option>
            ))}
          </select>
          </>)}

          <select
            value={recurringFilter}
            onChange={(e) =>
              setRecurringFilter(e.target.value)
            }
            className="
              w-full
              px-3
              py-2
              bg-white
              border
              border-slate-200
              rounded-xl
              text-xs
              text-slate-600
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500/20
            "
          >
            <option value="">כל התורמים</option>
            <option value="yes">עם הוראת קבע</option>
            <option value="no">ללא הוראת קבע</option>
          </select>

          <select
            value={yissacharFilter}
            onChange={(e) =>
              setYissacharFilter(e.target.value)
            }
            className="
              w-full
              px-3
              py-2
              bg-white
              border
              border-slate-200
              rounded-xl
              text-xs
              text-slate-600
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500/20
            "
          >
            <option value="">כל התורמים</option>
            <option value="yes">יששכר וזבולון</option>
            <option value="no">ללא יששכר וזבולון</option>
          </select>
        </div>

        {showFilters && (
          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              lg:grid-cols-3
              gap-2.5
              pt-3
              border-t
              border-slate-200
            "
          >
            {canViewContact && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                רחוב
              </label>

              <select
                value={streetFilter}
                onChange={(e) =>
                  setStreetFilter(e.target.value)
                }
                className="
                  w-full
                  px-3
                  py-2
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  text-xs
                "
              >
                <option value="">כל הרחובות</option>

                {streets.map((street) => (
                  <option
                    key={street}
                    value={street || ''}
                  >
                    {street}
                  </option>
                ))}
              </select>
            </div>
            )}

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                איש קשר
              </label>

              <select
                value={contactFilter}
                onChange={(e) =>
                  setContactFilter(e.target.value)
                }
                className="
                  w-full
                  px-3
                  py-2
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  text-xs
                "
              >
                <option value="">כל אנשי הקשר</option>

                {contacts.map((contact) => (
                  <option
                    key={contact}
                    value={contact || ''}
                  >
                    {contact}
                  </option>
                ))}
              </select>
            </div>

            {canViewContact && (<>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                טלפון
              </label>

              <input
                value={phoneFilter}
                onChange={(e) =>
                  setPhoneFilter(e.target.value)
                }
                placeholder="חיפוש טלפון..."
                className="
                  w-full
                  px-3
                  py-2
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  text-xs
                "
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                אימייל
              </label>

              <input
                value={emailFilter}
                onChange={(e) =>
                  setEmailFilter(e.target.value)
                }
                placeholder="חיפוש אימייל..."
                className="
                  w-full
                  px-3
                  py-2
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  text-xs
                "
                dir="ltr"
              />
            </div>
            </>)}

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">
                הערות
              </label>

              <input
                value={notesFilter}
                onChange={(e) =>
                  setNotesFilter(e.target.value)
                }
                placeholder="חיפוש בתוך הערות התורם..."
                className="
                  w-full
                  px-3
                  py-2
                  bg-white
                  border
                  border-slate-200
                  rounded-xl
                  text-xs
                "
              />
            </div>
          </div>
        )}
      </div>

    </>
  );
}
