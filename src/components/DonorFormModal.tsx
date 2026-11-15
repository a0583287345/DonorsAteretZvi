'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Donor } from '@/types/donor';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/AuthContext';
import { loadDonorYahrzeits, saveDonorYahrzeits, syncDonorAutoReminders } from '@/lib/reminders/donorAuto';
import { Protect, LockedText } from '@/components/Protect';
import { logActivity } from '@/lib/logger';

import { X, Save, User, Loader2, Trash2 } from 'lucide-react';
import {
  donorToFormData,
  formDataToPayload,
  newYahrzeitKey,
  validYahrzeits,
  type DonorFormData,
} from './donors/form/donorFormData';
import DonorIdentitySection from './donors/form/DonorIdentitySection';
import DonorDatesSection from './donors/form/DonorDatesSection';
import DonorContactSection from './donors/form/DonorContactSection';
import DonorManagementSection from './donors/form/DonorManagementSection';
import DonorRecurringSection from './donors/form/DonorRecurringSection';
import DonorNotesSection from './donors/form/DonorNotesSection';
import { toast } from '@/components/Toaster';

interface DonorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  donorToEdit?: Donor | null;
}

export default function DonorFormModal({
  isOpen,
  onClose,
  onSuccess,
  donorToEdit,
}: DonorFormModalProps) {
  // =====================================================
  // הרשאות
  // =====================================================

  const {
    hasPermission,
    access,
    loadingPerms,
  } = usePermissions();
  const { user } = useAuth();

  const isEditMode = Boolean(donorToEdit?.id);

  // פרטי התקשרות וכתובת: בעריכה – לפי ההרשאות; בתורם חדש – תמיד אפשר למלא
  const contactViewAccess = isEditMode ? access('donors_view_contact') : 'allowed';
  const canEditContact = !isEditMode || hasPermission('donors_edit_contact');

  // חשוב:
  // ההרשאה במסד הנתונים נקראת donors_create
  const canCreate = hasPermission('donors_create');
  const canEdit = hasPermission('donors_edit');

  const canSave = isEditMode
    ? canEdit
    : canCreate;

  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // הטופס מאותחל מהתורם בעת הפתיחה (הקומפוננטה נטענת מחדש בכל פתיחה)
  const [formData, setFormData] = useState<DonorFormData>(() =>
    donorToFormData(donorToEdit)
  );

  // ימי היארצייט נשמרים בטבלה נפרדת – נטענים אחרי הפתיחה
  const editId = donorToEdit?.id;
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    loadDonorYahrzeits(editId).then((list) => {
      if (cancelled) return;
      setFormData((prev) => ({
        ...prev,
        yahrzeits: list.map((y) => ({ key: newYahrzeitKey(), id: y.id, day: y.day, month: y.month, name: y.name ?? '' })),
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // =====================================================
  // בזמן טעינת הרשאות
  // =====================================================

  if (!isOpen) return null;

  if (loadingPerms) {
    return (
      <div
        className="
          fixed inset-0
          z-50
          flex items-center justify-center
          bg-slate-900/50
          backdrop-blur-sm
          p-4
        "
        dir="rtl"
      >
        <div
          className="
            bg-white
            rounded-2xl
            shadow-xl
            border border-slate-200
            p-8
            flex
            flex-col
            items-center
            gap-3
          "
        >
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />

          <div className="text-sm font-medium text-slate-700">
            טוען הרשאות...
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // שינוי שדה בטופס
  // =====================================================

  function updateField<K extends keyof DonorFormData>(
    field: K,
    value: DonorFormData[K]
  ) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // =====================================================
  // שמירת תורם
  // =====================================================

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    // ===================================================
    // בדיקת הרשאה
    // ===================================================

    if (isEditMode) {
      if (!hasPermission('donors_edit')) {
        toast.denied('אין לך הרשאה לערוך תורם.');
        return;
      }
    } else {
      // ההרשאה הנכונה היא donors_create
      if (!hasPermission('donors_create')) {
        toast.denied('אין לך הרשאה ליצור תורם חדש.');
        return;
      }
    }

    // ===================================================
    // בדיקת שם
    // ===================================================

    if (
      !formData.first_name_he.trim() &&
      !formData.last_name_he.trim()
    ) {
      toast.warning(
        'נא להזין לפחות שם פרטי או שם משפחה בעברית'
      );

      return;
    }

    setLoading(true);

    try {
      // =================================================
      // payload תואם לסכמת donors
      // =================================================

      const payload = formDataToPayload(formData);

      let error = null;
      let savedDonorId: string | null = donorToEdit?.id ?? null;

      const donorFullName =
        `${formData.first_name_he || ''} ${
          formData.last_name_he || ''
        }`.trim() || 'תורם';

      // =================================================
      // עדכון תורם קיים
      // =================================================

      if (donorToEdit?.id) {
        // בדיקת הרשאה נוספת ממש לפני UPDATE
        if (!hasPermission('donors_edit')) {
          toast.denied('אין לך הרשאה לערוך תורם.');
          return;
        }

        const res = await supabase
          .from('donors')
          .update(payload)
          .eq('id', donorToEdit.id);

        error = res.error;

        // =================================================
        // Audit Log - UPDATE
        // =================================================

        if (!error) {
          await logActivity(
            'UPDATE',
            'donors',
            `ערך תורם קיים בשם ${donorFullName}`
          );
        }
      }

      // =================================================
      // יצירת תורם חדש
      // =================================================

      else {
        // בדיקת הרשאה נוספת ממש לפני INSERT
        if (!hasPermission('donors_create')) {
          toast.denied(
            'אין לך הרשאה ליצור תורם חדש.'
          );

          return;
        }

        const res = await supabase
          .from('donors')
          .insert([payload])
          .select('id')
          .single();

        error = res.error;
        savedDonorId = res.data?.id ?? null;

        // =================================================
        // Audit Log - INSERT
        // =================================================

        if (!error) {
          await logActivity(
            'INSERT',
            'donors',
            `יצר תורם חדש בשם ${donorFullName}`
          );
        }
      }

      // =================================================
      // טיפול בשגיאה
      // =================================================

      if (error) {
        console.error(
          'Error saving donor:',
          error
        );

        toast.error(
          'שגיאה בשמירת נתוני התורם:\n\n' +
            error.message
        );

        return;
      }

      // ימי יארצייט + תזכורות אוטומטיות (יום הולדת לועזי + עברי, יארצייטים)
      if (savedDonorId) {
        const yz = await saveDonorYahrzeits(savedDonorId, validYahrzeits(formData.yahrzeits));
        if (yz.error) toast.warning(`התורם נשמר, אבל שמירת ימי היארצייט נכשלה: ${yz.error}`);

        const sync = await syncDonorAutoReminders(
          {
            id: savedDonorId,
            name: donorFullName,
            birthday: payload.birthday,
            birthday_after_sunset: payload.birthday_after_sunset,
            // אם השמירה נכשלה באמצע – מסנכרנים לפי מה שבאמת שמור במסד
            yahrzeits: yz.error ? await loadDonorYahrzeits(savedDonorId) : yz.saved,
          },
          user?.id
        );
        if (sync.error) {
          toast.warning(`התורם נשמר, אבל עדכון התזכורות האוטומטיות נכשל: ${sync.error}`);
        } else if (sync.created + sync.updated + sync.deleted > 0) {
          await logActivity(
            'UPDATE',
            'reminders',
            `תזכורות אוטומטיות לתורם ${donorFullName}: נוצרו ${sync.created}, עודכנו ${sync.updated}, נמחקו ${sync.deleted}`
          );
          toast.info('התזכורות האוטומטיות של התורם עודכנו');
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(
        'Unexpected save error:',
        error
      );

      toast.error(
        'אירעה שגיאה בלתי צפויה בעת שמירת התורם.'
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // מחיקת תורם
  // =====================================================

  async function handleDeleteDonor() {
    if (!donorToEdit?.id) return;

    // ===================================================
    // בדיקת הרשאה למחיקה
    // ===================================================

    if (!hasPermission('donors_delete')) {
      toast.denied('אין לך הרשאה למחוק תורם.');
      return;
    }

    if (isDeleting || loading) return;

    const donorName =
      `${donorToEdit.first_name_he || ''} ${
        donorToEdit.last_name_he || ''
      }`.trim() || 'התורם';

    // ===================================================
    // בדיקה כמה תרומות קיימות לתורם
    // ===================================================

    const {
      count,
      error: countError,
    } = await supabase
      .from('donations')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq(
        'donor_id',
        donorToEdit.id
      );

    if (countError) {
      console.error(
        'Error checking donations:',
        countError
      );

      toast.error(
        'לא ניתן לבדוק את מספר התרומות של התורם.'
      );

      return;
    }

    const donationCount = count || 0;

    // ===================================================
    // הודעת אישור
    // ===================================================

    let confirmationMessage = '';

    if (donationCount > 0) {
      confirmationMessage =
        `⚠️ מחיקת תורם\n\n` +
        `האם אתה בטוח שברצונך למחוק את ${donorName}?\n\n` +
        `לתורם זה קיימות ${donationCount} תרומות במערכת.\n\n` +
        `מחיקת התורם תמחק גם את כל התרומות ` +
        `המקושרות אליו.\n\n` +
        `הפעולה אינה ניתנת לביטול.`;
    } else {
      confirmationMessage =
        `⚠️ מחיקת תורם\n\n` +
        `האם אתה בטוח שברצונך למחוק את ${donorName}?\n\n` +
        `לתורם זה אין תרומות רשומות.\n\n` +
        `הפעולה אינה ניתנת לביטול.`;
    }

    const confirmed =
      window.confirm(
        confirmationMessage
      );

    if (!confirmed) return;

    // ===================================================
    // ביצוע המחיקה
    // ===================================================

    setIsDeleting(true);

    try {
      // בדיקת הרשאה נוספת ממש לפני DELETE
      if (!hasPermission('donors_delete')) {
        toast.denied(
          'אין לך הרשאה למחוק תורם.'
        );

        return;
      }

      const { error } =
        await supabase
          .from('donors')
          .delete()
          .eq(
            'id',
            donorToEdit.id
          );

      if (error) {
        console.error(
          'Error deleting donor:',
          error
        );

        toast.error(
          'לא ניתן למחוק את התורם.\n\n' +
            error.message
        );

        return;
      }

      // =================================================
      // Audit Log - DELETE
      // =================================================

      await logActivity(
        'DELETE',
        'donors',
        `מחק את התורם ${donorName} (כולל ${donationCount} תרומות)`
      );

      onClose();
      onSuccess();
    } catch (error) {
      console.error(
        'Unexpected delete error:',
        error
      );

      toast.error(
        'אירעה שגיאה בלתי צפויה בעת מחיקת התורם.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  // =====================================================
  // חסימת חלון לפי הרשאה
  // =====================================================

  if (!canSave) {
    return (
      <div
        className="
          fixed inset-0
          z-50
          flex items-center justify-center
          bg-slate-900/50
          backdrop-blur-sm
          p-4
        "
        dir="rtl"
      >
        <div
          className="
            bg-white
            w-full
            max-w-md
            rounded-2xl
            shadow-xl
            border border-slate-200
            overflow-hidden
          "
        >
          {/* כותרת */}

          <div
            className="
              flex items-center justify-between
              p-5
              border-b border-slate-100
              bg-slate-50
            "
          >
            <h2
              className="
                text-lg
                font-bold
                text-slate-800
                flex
                items-center
                gap-2
              "
            >
              <User className="w-5 h-5 text-blue-600" />

              {isEditMode
                ? 'עריכת פרטי תורם'
                : 'הוספת תורם חדש'}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="
                p-1
                text-slate-400
                hover:text-slate-600
                rounded-lg
                hover:bg-slate-200/50
                transition
              "
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* הודעת חסימה */}

          <div className="p-6 text-center">
            <div
              className="
                mx-auto
                w-12
                h-12
                rounded-full
                bg-red-50
                text-red-500
                flex
                items-center
                justify-center
                mb-4
              "
            >
              <X className="w-6 h-6" />
            </div>

            <h3
              className="
                text-base
                font-bold
                text-slate-800
                mb-2
              "
            >
              אין הרשאה לביצוע פעולה זו
            </h3>

            <p
              className="
                text-sm
                text-slate-500
                leading-6
              "
            >
              {isEditMode
                ? 'אין לך הרשאה לערוך תורמים.'
                : 'אין לך הרשאה ליצור תורמים חדשים.'}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="
                mt-5
                px-5
                py-2
                bg-slate-800
                hover:bg-slate-900
                text-white
                rounded-xl
                text-sm
                font-medium
                transition
              "
            >
              סגור
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div
      className="
        fixed inset-0
        z-50
        flex items-center justify-center
        bg-slate-900/50
        backdrop-blur-sm
        p-4
        overflow-y-auto
      "
      dir="rtl"
    >
      <div
        className="
          bg-white
          w-full
          max-w-2xl
          rounded-2xl
          shadow-xl
          border border-slate-200
          overflow-hidden
          my-8
          max-h-[90vh]
          flex flex-col
        "
      >
        {/* ================================================= */}
        {/* כותרת החלון */}
        {/* ================================================= */}

        <div
          className="
            flex items-center justify-between
            p-5
            border-b border-slate-100
            bg-slate-50
            shrink-0
          "
        >
          <h2
            className="
              text-lg
              font-bold
              text-slate-800
              flex items-center gap-2
            "
          >
            <User className="w-5 h-5 text-blue-600" />

            {donorToEdit
              ? 'עריכת פרטי תורם'
              : 'הוספת תורם חדש'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={
              loading ||
              isDeleting
            }
            className="
              p-1
              text-slate-400
              hover:text-slate-600
              rounded-lg
              hover:bg-slate-200/50
              transition
              disabled:opacity-50
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================= */}
        {/* תוכן נגלל */}
        {/* ================================================= */}

        <div className="overflow-y-auto p-6">
          <form
            id="donor-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <DonorIdentitySection formData={formData} updateField={updateField} />
            <DonorDatesSection formData={formData} updateField={updateField} />
            {/* --------------------------------------------- */}
            {/* פרטי התקשרות */}
            {/* --------------------------------------------- */}

            {contactViewAccess === 'locked' && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <LockedText text="פרטי התקשרות וכתובת: אין הרשאה" />
              </div>
            )}

            {contactViewAccess === 'allowed' && (
            <fieldset disabled={!canEditContact} className="contents">
            {!canEditContact && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <LockedText text="אין לך הרשאה לערוך פרטי התקשרות – השדות לקריאה בלבד" />
              </div>
            )}

            <DonorContactSection formData={formData} updateField={updateField} />

            </fieldset>
            )}

            <DonorManagementSection formData={formData} updateField={updateField} />
            <DonorRecurringSection formData={formData} updateField={updateField} />
            <DonorNotesSection formData={formData} updateField={updateField} />
          </form>
        </div>

        {/* ================================================= */}
        {/* כפתורי פעולה */}
        {/* ================================================= */}

        <div
          className="
            flex
            items-center
            justify-between
            gap-3
            p-5
            border-t
            border-slate-100
            bg-slate-50
            shrink-0
          "
        >
          {/* מחיקה */}

          {donorToEdit ? (
            <div><Protect permId="donors_delete">
            <button
              type="button"
              onClick={
                handleDeleteDonor
              }
              disabled={
                loading ||
                isDeleting
              }
              className="
                px-4
                py-2
                rounded-xl
                border
                border-red-200
                bg-red-50
                text-red-600
                hover:bg-red-100
                hover:border-red-300
                disabled:opacity-50
                disabled:cursor-not-allowed
                text-sm
                font-medium
                flex
                items-center
                gap-2
                transition
              "
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מוחק...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  מחיקת תורם
                </>
              )}
            </button>
            </Protect></div>
          ) : (
            <div />
          )}

          {/* ביטול + שמירה */}

          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <button
              type="button"
              onClick={onClose}
              disabled={
                loading ||
                isDeleting
              }
              className="
                px-4
                py-2
                border
                rounded-xl
                text-sm
                font-medium
                text-slate-600
                hover:bg-slate-100
                transition
                disabled:opacity-50
              "
            >
              ביטול
            </button>

            {canSave && (
              <button
                type="submit"
                form="donor-form"
                disabled={
                  loading ||
                  isDeleting
                }
                className="
                  px-6
                  py-2
                  bg-blue-600
                  hover:bg-blue-700
                  text-white
                  rounded-xl
                  text-sm
                  font-medium
                  flex
                  items-center
                  gap-2
                  transition
                  shadow-sm
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {donorToEdit
                      ? 'עדכן תורם'
                      : 'שמור תורם'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}