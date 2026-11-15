'use client';

import { FileText } from 'lucide-react';
import type { DonorFormSectionProps } from './donorFormData';

/** הערות כלליות */
export default function DonorNotesSection({ formData, updateField }: DonorFormSectionProps) {
  return (
    <>
            {/* --------------------------------------------- */}
            {/* הערות */}
            {/* --------------------------------------------- */}

            <section>
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
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                הערות כלליות
              </label>

              <textarea
                rows={4}
                value={
                  formData.notes
                }
                onChange={(e) =>
                  updateField(
                    'notes',
                    e.target.value
                  )
                }
                placeholder="הערות לגבי התורם..."
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
                  resize-none
                "
              />
            </section>
    </>
  );
}
