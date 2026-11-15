'use client';

import { Phone, MapPin, Mail, Globe } from 'lucide-react';
import type { DonorFormSectionProps } from './donorFormData';

/** פרטי התקשרות וכתובת מגורים */
export default function DonorContactSection({ formData, updateField }: DonorFormSectionProps) {
  return (
    <>
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
                פרטי התקשרות
              </h3>

              <div
                className="
                  grid
                  grid-cols-1
                  md:grid-cols-3
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
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    טלפון ראשי
                  </label>

                  <input
                    type="tel"
                    dir="ltr"
                    value={
                      formData.phone_1
                    }
                    onChange={(e) =>
                      updateField(
                        'phone_1',
                        e.target.value
                      )
                    }
                    placeholder="050-0000000"
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
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    טלפון משני
                  </label>

                  <input
                    type="tel"
                    dir="ltr"
                    value={
                      formData.phone_2
                    }
                    onChange={(e) =>
                      updateField(
                        'phone_2',
                        e.target.value
                      )
                    }
                    placeholder="02-0000000"
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
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    אימייל
                  </label>

                  <input
                    type="email"
                    dir="ltr"
                    value={
                      formData.email
                    }
                    onChange={(e) =>
                      updateField(
                        'email',
                        e.target.value
                      )
                    }
                    placeholder="email@example.com"
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
              </div>
            </section>

            {/* --------------------------------------------- */}
            {/* כתובת מגורים */}
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
                כתובת מגורים
              </h3>

              <div
                className="
                  grid
                  grid-cols-2
                  md:grid-cols-4
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
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    ארץ
                  </label>

                  <input
                    type="text"
                    value={
                      formData.country
                    }
                    onChange={(e) =>
                      updateField(
                        'country',
                        e.target.value
                      )
                    }
                    placeholder="ישראל"
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
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    עיר
                  </label>

                  <input
                    type="text"
                    value={
                      formData.city
                    }
                    onChange={(e) =>
                      updateField(
                        'city',
                        e.target.value
                      )
                    }
                    placeholder="ירושלים"
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
                    רחוב
                  </label>

                  <input
                    type="text"
                    value={
                      formData.street
                    }
                    onChange={(e) =>
                      updateField(
                        'street',
                        e.target.value
                      )
                    }
                    placeholder="יפו"
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
                    מספר בית
                  </label>

                  <input
                    type="text"
                    value={
                      formData.house_number
                    }
                    onChange={(e) =>
                      updateField(
                        'house_number',
                        e.target.value
                      )
                    }
                    placeholder="12"
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
