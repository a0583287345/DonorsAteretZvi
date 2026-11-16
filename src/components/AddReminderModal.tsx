'use client';

import { useState, useEffect, useRef } from 'react';
import DateInput from './DateInput';
import { supabase } from '@/lib/supabase';
import { toStorageRef, openSecureFile } from '@/lib/storage';
import { useAuth } from '@/components/AuthContext';
import {
  X, Save, Loader2, Calendar, FileText, User, Type,
  Repeat, Bell, Paperclip, Trash2, Upload, Mail, Sparkles,
} from 'lucide-react';
import { logActivity } from '@/lib/logger';
import { toast } from '@/components/Toaster';
import type { Reminder, ReminderAttachment } from '@/types/donor';
import type { Json, TablesInsert } from '@/types/database';
import { todayISO } from '@/lib/reminders/dates';
import { formatHebrewParts, hebrewToISO, toHebrewParts } from '@/lib/reminders/hebrew';
import type { RepeatEndType, RepeatUnit } from '@/lib/reminders/recurrence';
import HebrewDateInput, { type HebrewValue } from './reminders/HebrewDateInput';
import RepeatInput, { type RepeatValue } from './reminders/RepeatInput';
import { DONOR_MESSAGE_LABELS } from './reminders/reminderUi';

type DonorOption = { id: string; first_name_he: string | null; last_name_he: string | null };

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDonorId?: string | null;
  editingReminder?: Reminder | null;
}

const LEAD_OPTIONS = [
  { value: 0, label: 'ביום עצמו' },
  { value: 1, label: 'יום לפני' },
  { value: 2, label: 'יומיים לפני' },
  { value: 3, label: '3 ימים לפני' },
  { value: 7, label: 'שבוע לפני' },
  { value: 14, label: 'שבועיים לפני' },
  { value: 30, label: 'חודש לפני' },
];

const fieldClass =
  'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition disabled:bg-slate-100';

function initialHebrew(r: Reminder | null | undefined): HebrewValue {
  if (r?.date_type === 'hebrew' && r.hebrew_day && r.hebrew_month && r.hebrew_year) {
    return { day: r.hebrew_day, month: r.hebrew_month, year: r.hebrew_year };
  }
  return toHebrewParts(r?.gregorian_date?.slice(0, 10) || todayISO());
}

function initialRepeat(r: Reminder | null | undefined): RepeatValue {
  return {
    unit: (r?.repeat_unit as RepeatUnit) || 'none',
    interval: r?.repeat_interval || 1,
    endType: (r?.repeat_end_type as RepeatEndType) || 'never',
    until: r?.repeat_until || '',
    count: r?.repeat_count || 10,
  };
}

/** יצירה ועריכה של תזכורת: תאריך לועזי/עברי, חזרתיות, התראה מראש, מיילים וקבצים */
export default function AddReminderModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedDonorId,
  editingReminder,
}: AddReminderModalProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [uploadingText, setUploadingText] = useState('');
  const [donors, setDonors] = useState<DonorOption[]>([]);

  // תזכורת אוטומטית מכרטיס התורם – התאריך והחזרתיות מנוהלים משם
  const isAuto = !!editingReminder && !!editingReminder.source && editingReminder.source !== 'manual';

  // שדות הטופס – מאותחלים מהתזכורת לעריכה (הקומפוננטה נטענת מחדש בכל פתיחה)
  const [title, setTitle] = useState(editingReminder?.title || '');
  const [description, setDescription] = useState(editingReminder?.description || '');
  const [dateType, setDateType] = useState<'gregorian' | 'hebrew'>(
    editingReminder?.date_type === 'hebrew' ? 'hebrew' : 'gregorian'
  );
  const [gregorianDate, setGregorianDate] = useState(
    editingReminder?.gregorian_date?.slice(0, 10) || todayISO()
  );
  const [hebrew, setHebrew] = useState<HebrewValue>(() => initialHebrew(editingReminder));
  const [repeat, setRepeat] = useState<RepeatValue>(() => initialRepeat(editingReminder));
  const [leadDays, setLeadDays] = useState(editingReminder?.lead_days ?? 0);
  const [donorId, setDonorId] = useState<string>(
    editingReminder ? editingReminder.donor_id || '' : preselectedDonorId || ''
  );
  // תזכורת חדשה – מייל למנהל מסומן כברירת מחדל
  const [notifyEmail, setNotifyEmail] = useState(editingReminder ? !!editingReminder.notify_email : true);
  const [donorMessageType, setDonorMessageType] = useState(editingReminder?.donor_message_type || 'none');
  const [donorMessageCustom, setDonorMessageCustom] = useState(editingReminder?.donor_message_custom || '');

  // ניהול קבצים
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ReminderAttachment[]>(
    editingReminder?.attachments || []
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    supabase
      .from('donors')
      .select('id, first_name_he, last_name_he')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active && data) setDonors(data as DonorOption[]);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const getDonorNameForLog = (selectedDonorId: string) => {
    if (!selectedDonorId) return 'ללא תורם';
    const found = donors.find((d) => d.id === selectedDonorId);
    if (found) return `${found.first_name_he || ''} ${found.last_name_he || ''}`.trim() || 'תורם ללא שם';
    return 'תורם לא ידוע';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) setNewFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning('נא למלא נושא לתזכורת.');
      return;
    }
    if (repeat.unit !== 'none' && repeat.endType === 'until' && !repeat.until) {
      toast.warning('נא לבחור תאריך סיום לחזרה.');
      return;
    }

    setLoading(true);

    try {
      const finalAttachments = [...existingAttachments];
      const currentDonorName = getDonorNameForLog(donorId);

      if (newFiles.length > 0) {
        setUploadingText('מעלה קבצים...');
        for (const file of newFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${user?.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('reminder_docs').upload(filePath, file);
          if (uploadError) throw uploadError;

          finalAttachments.push({
            name: file.name,
            path: filePath,
            url: toStorageRef('reminder_docs', filePath),
            uploaded_at: new Date().toISOString(),
          });

          await logActivity(
            'FILE_UPLOAD',
            'reminders',
            `העלה מסמך לתזכורת "${title.trim()}" (תורם: ${currentDonorName}) - ${file.name}`
          );
        }
      }

      setUploadingText('שומר נתונים...');

      const isHebrew = dateType === 'hebrew';
      const anchor = isHebrew ? hebrewToISO(hebrew.day, hebrew.month, hebrew.year) : gregorianDate;
      const hebrewParts = isHebrew ? hebrew : toHebrewParts(anchor);

      const schedule = isAuto
        ? {}
        : {
            date_type: dateType,
            gregorian_date: anchor,
            hebrew_day: isHebrew ? hebrew.day : null,
            hebrew_month: isHebrew ? hebrew.month : null,
            hebrew_year: isHebrew ? hebrew.year : null,
            hebrew_date: formatHebrewParts(hebrewParts.day, hebrewParts.month, hebrewParts.year),
            repeat_unit: repeat.unit,
            repeat_interval: repeat.interval,
            repeat_end_type: repeat.unit === 'none' ? 'never' : repeat.endType,
            repeat_until: repeat.unit !== 'none' && repeat.endType === 'until' ? repeat.until : null,
            repeat_count: repeat.unit !== 'none' && repeat.endType === 'count' ? repeat.count : null,
            // שדות ישנים – לתאימות
            is_recurring: repeat.unit !== 'none',
            recurring_type:
              repeat.unit === 'year' ? 'yearly' : repeat.unit === 'month' ? 'monthly' : repeat.unit === 'week' ? 'weekly' : null,
          };

      const reminderData = {
        ...schedule,
        title: title.trim(),
        description: description.trim() || null,
        donor_id: donorId || null,
        lead_days: leadDays,
        notify_email: notifyEmail,
        donor_message_type: donorId ? donorMessageType : 'none',
        donor_message_custom: donorId && donorMessageType === 'custom' ? donorMessageCustom.trim() || null : null,
        attachments: finalAttachments as unknown as Json, // עמודת JSON – רשימת הקבצים כמו שהיא
      };

      if (editingReminder) {
        const { error } = await supabase.from('reminders').update(reminderData).eq('id', editingReminder.id);
        if (error) throw error;
        await logActivity('UPDATE', 'reminders', `ערך תזכורת "${title.trim()}" (תורם: ${currentDonorName})`);
      } else {
        const insert = { ...reminderData, gregorian_date: anchor, created_by: user?.id } as TablesInsert<'reminders'>;
        const { error } = await supabase.from('reminders').insert([insert]);
        if (error) throw error;
        await logActivity('CREATE', 'reminders', `יצר תזכורת "${title.trim()}" (תורם: ${currentDonorName})`);
      }

      toast.success('התזכורת נשמרה');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('שגיאה בשמירת התזכורת:', err);
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(`שגיאה בשמירת התזכורת: ${message || 'שגיאת שרת'}`);
    } finally {
      setLoading(false);
      setUploadingText('');
    }
  };

  if (!isOpen) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-800">
            {editingReminder ? 'עריכת תזכורת' : 'הוספת תזכורת חדשה'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          {/* נושא */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Type className="w-4 h-4 text-purple-600" />
              נושא התזכורת <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: יום השנה / חידוש הוראת קבע..."
              className={fieldClass}
            />
          </div>

          {/* תאריך וחזרתיות */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            {isAuto && (
              <div className="flex items-center gap-2 text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                <Sparkles className="w-4 h-4" />
                תזכורת אוטומטית מכרטיס התורם – התאריך והחזרתיות מתעדכנים משם.
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-purple-600" />
                תאריך <span className="text-red-500">*</span>
              </label>

              <div className="inline-flex rounded-xl border border-slate-300 bg-white overflow-hidden">
                {(['gregorian', 'hebrew'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={isAuto}
                    onClick={() => {
                      // מעבר בין סוגי תאריך שומר על אותו יום
                      if (t === 'hebrew' && dateType === 'gregorian') setHebrew(toHebrewParts(gregorianDate));
                      if (t === 'gregorian' && dateType === 'hebrew')
                        setGregorianDate(hebrewToISO(hebrew.day, hebrew.month, hebrew.year));
                      setDateType(t);
                    }}
                    className={`px-4 py-2 text-sm font-bold transition ${
                      dateType === t ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'gregorian' ? 'תאריך לועזי' : 'תאריך עברי'}
                  </button>
                ))}
              </div>

              {dateType === 'gregorian' ? (
                <div className="space-y-1">
                  <DateInput
                    required
                    value={gregorianDate}
                    onChange={setGregorianDate}
                    disabled={isAuto}
                    className="max-w-xs"
                  />
                  {gregorianDate && (
                    <p className="text-xs text-slate-500">
                      {(() => {
                        const p = toHebrewParts(gregorianDate);
                        return formatHebrewParts(p.day, p.month, p.year);
                      })()}
                    </p>
                  )}
                </div>
              ) : (
                <HebrewDateInput value={hebrew} onChange={setHebrew} disabled={isAuto} />
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Repeat className="w-4 h-4 text-purple-600" />
                חזרתיות
              </label>
              <RepeatInput value={repeat} onChange={setRepeat} hebrew={dateType === 'hebrew'} disabled={isAuto} />
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Bell className="w-4 h-4 text-purple-600" />
                הצג כתזכורת פעילה
              </label>
              <select
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className={`${fieldClass} max-w-xs`}
              >
                {LEAD_OPTIONS.some((o) => o.value === leadDays) ? null : (
                  <option value={leadDays}>{leadDays} ימים לפני</option>
                )}
                {LEAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* תורם */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <User className="w-4 h-4 text-purple-600" />
              שיוך לתורם (אופציונלי)
            </label>
            <select value={donorId} onChange={(e) => setDonorId(e.target.value)} disabled={isAuto} className={fieldClass}>
              <option value="">-- ללא תורם מקושר --</option>
              {donors.map((donor) => (
                <option key={donor.id} value={donor.id}>
                  {donor.first_name_he} {donor.last_name_he}
                </option>
              ))}
            </select>
          </div>

          {/* פירוט */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <FileText className="w-4 h-4 text-purple-600" />
              פירוט (אופציונלי)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="הערות ופרטים נוספים..."
              rows={3}
              className={`${fieldClass} resize-none`}
            />
          </div>

          {/* מיילים */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Mail className="w-4 h-4 text-purple-600" />
              הודעות במייל
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              שלח תזכורת למנהל העמותה (כשהתזכורת נעשית פעילה)
            </label>

            {donorId ? (
              <div className="space-y-2">
                <select
                  value={donorMessageType}
                  onChange={(e) => setDonorMessageType(e.target.value)}
                  className={`${fieldClass} max-w-sm`}
                >
                  {Object.entries(DONOR_MESSAGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {donorMessageType === 'custom' && (
                  <textarea
                    value={donorMessageCustom}
                    onChange={(e) => setDonorMessageCustom(e.target.value)}
                    rows={3}
                    placeholder="תוכן ההודעה לתורם. אפשר להשתמש ב-{שם} ו-{תאריך עברי}"
                    className={`${fieldClass} resize-none`}
                  />
                )}
                {donorMessageType !== 'none' && (
                  <p className="text-xs text-slate-500">
                    ההודעה לתורם תוכן ביום המועד ותמתין לאישור מנהל לפני השליחה.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">כדי לשלוח הודעה לתורם יש לשייך תורם לתזכורת.</p>
            )}
          </div>

          {/* קבצים */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Paperclip className="w-4 h-4 text-purple-600" />
              מסמכים מצורפים
            </label>

            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium transition"
            >
              <Upload className="w-4 h-4" />
              בחר קבצים להעלאה...
            </button>

            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-slate-500 font-bold">קבצים שמורים:</span>
                {existingAttachments.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg">
                    <a
                      href="#"
                      onClick={(e) => openSecureFile(e, file.url)}
                      className="text-sm text-blue-600 hover:underline truncate max-w-[80%]"
                    >
                      {file.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => setExistingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {newFiles.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-slate-500 font-bold">קבצים להעלאה:</span>
                {newFiles.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-white border border-purple-100 rounded-lg">
                    <span className="text-sm text-slate-700 truncate max-w-[80%]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:bg-red-50 p-1 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl transition shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadingText || 'שומר...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingReminder ? 'שמור שינויים' : 'צור תזכורת'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
