'use client';

import { Heart, BookOpen } from 'lucide-react';
import type { DonorFormSectionProps } from './donorFormData';

/** הוראת קבע ויששכר וזבולון */
export default function DonorRecurringSection({ formData, updateField }: DonorFormSectionProps) {
  return (
    <>
            {/* --------------------------------------------- */}
            {/* הו"ק + יששכר וזבולון */}
            {/* --------------------------------------------- */}

            <section
              className="
                p-4
                bg-slate-50
                border
                rounded-xl
                space-y-4
              "
            >
              <label
                className="
                  flex
                  items-center
                  gap-2.5
                  text-sm
                  font-medium
                  text-slate-700
                  cursor-pointer
                  select-none
                "
              >
                <input
                  type="checkbox"
                  checked={
                    formData.is_recurring
                  }
                  onChange={(e) =>
                    updateField(
                      'is_recurring',
                      e.target.checked
                    )
                  }
                  className="
                    w-4
                    h-4
                    rounded
                    border-slate-300
                    text-blue-600
                    focus:ring-blue-500
                  "
                />

                <span
                  className="
                    flex
                    items-center
                    gap-1.5
                  "
                >
                  <Heart className="w-4 h-4 text-emerald-600" />
                  תורם בהוראת קבע פעילה (הו&quot;ק)
                </span>
              </label>

              <div
                className="
                  space-y-3
                  pt-3
                  border-t
                  border-slate-200/60
                "
              >
                <label
                  className="
                    flex
                    items-center
                    gap-2.5
                    text-sm
                    font-medium
                    text-slate-700
                    cursor-pointer
                    select-none
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      formData.has_yissachar_zevulun
                    }
                    onChange={(e) =>
                      updateField(
                        'has_yissachar_zevulun',
                        e.target.checked
                      )
                    }
                    className="
                      w-4
                      h-4
                      rounded
                      border-slate-300
                      text-blue-600
                      focus:ring-blue-500
                    "
                  />

                  <span
                    className="
                      flex
                      items-center
                      gap-1.5
                    "
                  >
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    קיים הסכם יששכר וזבולון
                  </span>
                </label>

                {formData.has_yissachar_zevulun && (
                  <div className="pt-1 pr-7">
                    <div>
                      <label
                        className="
                          block
                          text-xs
                          font-medium
                          text-slate-600
                          mb-1
                        "
                      >
                        שם האברך בכולל
                      </label>

                      <input
                        type="text"
                        value={
                          formData.yissachar_zevulun_name
                        }
                        onChange={(e) =>
                          updateField(
                            'yissachar_zevulun_name',
                            e.target.value
                          )
                        }
                        placeholder="שם האברך..."
                        className="
                          w-full
                          p-2.5
                          border
                          rounded-xl
                          text-sm
                          bg-white
                          focus:outline-none
                          focus:ring-2
                          focus:ring-blue-500/20
                          focus:border-blue-500
                        "
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

    </>
  );
}
