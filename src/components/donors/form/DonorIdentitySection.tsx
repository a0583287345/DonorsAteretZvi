'use client';

import type { DonorFormSectionProps } from './donorFormData';
import { isValidZeout } from '@/lib/import/donorMatch';

/** פרטי זיהוי: שמות בעברית ובאנגלית + ת"ז */
export default function DonorIdentitySection({ formData, updateField }: DonorFormSectionProps) {
  const zeoutWarning = formData.zeout.trim() !== '' && !isValidZeout(formData.zeout);
  return (
    <>
            {/* --------------------------------------------- */}
            {/* פרטי זיהוי */}
            {/* --------------------------------------------- */}

            <section className="space-y-3">
              <h3
                className="
                  text-sm
                  font-semibold
                  text-slate-800
                  border-b
                  pb-1
                "
              >
                פרטי זיהוי
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="
                      block
                      text-xs
                      font-medium
                      text-slate-700
                      mb-1
                    "
                  >
                    שם פרטי (עברית)

                    <span className="text-red-500">
                      {' '}*
                    </span>
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      formData.first_name_he
                    }
                    onChange={(e) =>
                      updateField(
                        'first_name_he',
                        e.target.value
                      )
                    }
                    placeholder="לדוגמה: אברהם"
                    className="
                      w-full
                      p-2.5
                      border
                      rounded-xl
                      text-sm
                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-500/20
                      focus:border-blue-500
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      block
                      text-xs
                      font-medium
                      text-slate-700
                      mb-1
                    "
                  >
                    שם משפחה (עברית)
                  </label>

                  <input
                    type="text"
                    value={
                      formData.last_name_he
                    }
                    onChange={(e) =>
                      updateField(
                        'last_name_he',
                        e.target.value
                      )
                    }
                    placeholder="לדוגמה: כהן"
                    className="
                      w-full
                      p-2.5
                      border
                      rounded-xl
                      text-sm
                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-500/20
                      focus:border-blue-500
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      block
                      text-xs
                      font-medium
                      text-slate-700
                      mb-1
                    "
                  >
                    שם פרטי (אנגלית)
                  </label>

                  <input
                    type="text"
                    dir="ltr"
                    value={
                      formData.first_name_en
                    }
                    onChange={(e) =>
                      updateField(
                        'first_name_en',
                        e.target.value
                      )
                    }
                    placeholder="Abraham"
                    className="
                      w-full
                      p-2.5
                      border
                      rounded-xl
                      text-sm
                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-500/20
                      focus:border-blue-500
                      text-left
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      block
                      text-xs
                      font-medium
                      text-slate-700
                      mb-1
                    "
                  >
                    שם משפחה (אנגלית)
                  </label>

                  <input
                    type="text"
                    dir="ltr"
                    value={
                      formData.last_name_en
                    }
                    onChange={(e) =>
                      updateField(
                        'last_name_en',
                        e.target.value
                      )
                    }
                    placeholder="Cohen"
                    className="
                      w-full
                      p-2.5
                      border
                      rounded-xl
                      text-sm
                      focus:outline-none
                      focus:ring-2
                      focus:ring-blue-500/20
                      focus:border-blue-500
                      text-left
                    "
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    תעודת זהות
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={12}
                    value={formData.zeout}
                    onChange={(e) => updateField('zeout', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9 ספרות"
                    className="w-full p-2.5 border rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {zeoutWarning && (
                    <p className="text-[11px] text-amber-600 mt-1">ספרת הביקורת לא תקינה – כדאי לבדוק את המספר</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">משמש לזיהוי התורם בייבוא מנדרים פלוס</p>
                </div>
              </div>
            </section>

    </>
  );
}
