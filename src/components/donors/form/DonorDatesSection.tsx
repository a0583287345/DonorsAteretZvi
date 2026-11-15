'use client';

import { Calendar } from 'lucide-react';
import type { DonorFormSectionProps } from './donorFormData';

/** תאריכים: יום הולדת ויארצייט */
export default function DonorDatesSection({ formData, updateField }: DonorFormSectionProps) {
  return (
    <>
            {/* --------------------------------------------- */}
            {/* תאריכים */}
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
                תאריכים
              </h3>

              <div
                className="
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  gap-3
                "
              >
                <div>
                  <label
                    className="
                      block
                      text-xs
                      font-medium
                      text-slate-700
                      mb-1
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    תאריך לידה
                  </label>

                  <input
                    type="date"
                    value={
                      formData.birthday
                    }
                    onChange={(e) =>
                      updateField(
                        'birthday',
                        e.target.value
                      )
                    }
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
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    תאריך יארצייט
                  </label>

                  <input
                    type="date"
                    value={
                      formData.yahrzeit_date
                    }
                    onChange={(e) =>
                      updateField(
                        'yahrzeit_date',
                        e.target.value
                      )
                    }
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
              </div>
            </section>

    </>
  );
}
