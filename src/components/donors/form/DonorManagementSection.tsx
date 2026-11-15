'use client';

import { Users } from 'lucide-react';
import type { DonorFormSectionProps } from './donorFormData';

/** ניהול: איש קשר מקושר */
export default function DonorManagementSection({ formData, updateField }: DonorFormSectionProps) {
  return (
    <>
            {/* --------------------------------------------- */}
            {/* ניהול */}
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
                ניהול
              </h3>

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
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  איש קשר בארגון
                </label>

                <input
                  type="text"
                  value={
                    formData.connected_contact
                  }
                  onChange={(e) =>
                    updateField(
                      'connected_contact',
                      e.target.value
                    )
                  }
                  placeholder="שם איש הקשר..."
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
            </section>

    </>
  );
}
