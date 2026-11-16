'use client';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { Donor } from '@/types/donor';
import { supabase } from '@/lib/supabase';
import { openSecureFile } from '@/lib/storage';
import { Donation, Attachment, SpecialDate } from '@/types/donor';
import { usePermissions } from '@/hooks/usePermissions';
import { Protect, LockedText } from '@/components/Protect';
import type { Reminder } from '@/types/donor';
import ReminderCardModal from './reminders/ReminderCardModal';
import DonorRecurringSection from './recurring/DonorRecurringSection';
import { STATUS_STYLES } from './reminders/reminderUi';
import { formatGregorian, todayISO } from '@/lib/reminders/dates';
import { formatHebrewDate, formatHebrewParts, toHebrewParts } from '@/lib/reminders/hebrew';
import { loadDonorYahrzeits, type SavedYahrzeit } from '@/lib/reminders/donorAuto';
import { describeRepeat, reminderState } from '@/lib/reminders/recurrence';

import {
  Phone,
  MapPin,
  Calendar,
  User,
  Mail,
  Navigation,
  PlusCircle,
  CreditCard,
  FileText,
  Globe,
  BookOpen,
  Paperclip,
  Download,
  HeartHandshake,
  Home,
  Cake,
  Clock,
  Receipt,
  Loader2,
  Bell,
  CalendarClock
} from 'lucide-react';
import { toast } from '@/components/Toaster';

/* =========================================================
   סוג תרומה מקומי
========================================================= */

export interface DonationRecord {
  id: string;
  donor_id?: string | null;
  amount: number;
  currency?: string | null;
  payment_method?: string | null;
  donation_date?: string | null;
  receipt_number?: string | null;
  file_url?: string | null;
  notes?: string | null;
  created_at?: string | null;
  external_source?: string | null;
}

/* =========================================================
   סוג תזכורת מקומי
========================================================= */

export type ReminderRecord = Reminder;

/* =========================================================
   סוגי נתונים משולבים
========================================================= */

export interface ExtendedDonor extends Donor {
  donations?: Donation[];
  files?: Attachment[];
  reminders?: ReminderRecord[];
}

export interface DonorCardProps {
  donor: ExtendedDonor;

  onAddDonation?: (e: React.MouseEvent) => void;
  onAddReminder?: (e: React.MouseEvent) => void; // הוספת תזכורת

  /*
   * נפתח כרטיס תרומה עבור תרומה ספציפית
   */
  onViewDonation?: (
    donation: DonationRecord,
    e?: React.MouseEvent
  ) => void;

  onOpenDonationById?: (
    donationId: string,
    e?: React.MouseEvent
  ) => void | Promise<void>;

  /** עריכת תזכורת (נפתח טופס התזכורת בדשבורד) */
  onEditReminder?: (reminder: Reminder) => void;

  /** משתנה אחרי שמירת תזכורת – טוען מחדש את התזכורות בכרטיס */
  remindersRefreshKey?: number;

  userRole?: 'admin' | 'manager' | 'viewer';
}

/* =========================================================
   עיצוב תאריך
========================================================= */

export function formatDate(date?: string | null) {
  if (!date) return 'לא צוין';

  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('he-IL');
  } catch {
    return date;
  }
}

/* =========================================================
   סימן מטבע
========================================================= */

function getCurrencySymbol(currency?: string | null) {
  if (!currency) return '₪';

  const value = currency.toString().trim().toUpperCase();

  switch (value) {
    case 'ILS':
    case 'NIS':
    case 'ש"ח':
    case 'שח':
    case '₪':
      return '₪';
    case 'USD':
    case '$':
      return '$';
    case 'EUR':
    case '€':
      return '€';
    case 'GBP':
    case '£':
      return '£';
    default:
      return currency;
  }
}

/* =========================================================
   תרגום אופן תשלום לעברית
========================================================= */

function getPaymentMethodLabel(paymentMethod?: string | null) {
  if (!paymentMethod) return 'לא צוין';

  const normalized = paymentMethod
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  switch (normalized) {
    case 'credit_card':
    case 'creditcard':
    case 'card':
    case 'visa':
    case 'mastercard':
    case 'credit':
      return 'כרטיס אשראי';
    case 'bank_transfer':
    case 'banktransfer':
      return 'העברה בנקאית';
    case 'bank_transfer_israel':
    case 'bank_transfer_il':
    case 'bank_transfer_israeli':
      return 'העברה בנקאית ישראל';
    case 'bank_transfer_usa':
    case 'bank_transfer_us':
    case 'bank_transfer_usa_bank':
      return 'העברה בנקאית ארה״ב';
    case 'bank_transfer_panama':
      return 'העברה בנקאית פנמה';
    case 'bank_transfer_france':
      return 'העברה בנקאית צרפת';
    case 'bit':
    case 'bit_payment':
      return 'ביט (Bit)';
    case 'paybox':
    case 'pay_box':
    case 'paybox_payment':
      return 'פייבוקס (PayBox)';
    case 'cash':
    case 'cash_payment':
      return 'מזומן';
    case 'check':
    case 'cheque':
    case 'check_payment':
    case 'cheque_payment':
      return 'שיק';
    case 'paypal':
    case 'pay_pal':
      return 'פייפאל';
    case 'standing_order':
    case 'standingorder':
    case 'direct_debit':
    case 'directdebit':
    case 'recurring':
      return 'הוראת קבע';
    case 'transfer':
      return 'העברה בנקאית';
    case 'other':
    case 'other_payment':
      return 'אחר';
    default:
      return paymentMethod;
  }
}

/* =========================================================
   Info Item
========================================================= */

function InfoItem({
  icon,
  label,
  value,
  dir = 'rtl',
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-slate-400 leading-none mb-1">{label}</div>
        <div dir={dir} className="text-xs font-medium text-slate-700 truncate">
          {value || 'לא צוין'}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Section Title
========================================================= */

/** אזור שהמשתמש לא מורשה לראות, כשההרשאה מוגדרת "חסום" */
function LockedSection({ title, icon, className = '' }: { title: string; icon: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-slate-50 border border-dashed border-slate-200 p-3 ${className}`}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <LockedText />
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

/* =========================================================
   Donor Card
========================================================= */

export default function DonorCard({
  donor,
  onAddDonation,
  onAddReminder,
  onViewDonation,
  onOpenDonationById,
  onEditReminder,
  remindersRefreshKey = 0,
}: DonorCardProps) {
  const { hasPermission, access, loadingPerms } = usePermissions();

  // מצב תצוגה (מותר / חסום / מוסתר) לאזורים בכרטיס
  const contactAccess = access('donors_view_contact');
  const remindersAccess = access('reminders_view');
  const donationsAccess = access('donations_view');
  const amountAccess = access('donations_view_amount');
  const documentsAccess = access('documents_view');
  const createDonationAccess = access('donations_create');
  const createReminderAccess = access('reminders_create');

  /*
   * הרשאות
   */
  const canViewDonor = !loadingPerms && hasPermission('donors_view');
  const canViewContact = !loadingPerms && hasPermission('donors_view_contact');
  const canViewDonations = !loadingPerms && hasPermission('donations_view');
  const canViewDonationAmount = !loadingPerms && hasPermission('donations_view_amount');
  const canViewDocuments = !loadingPerms && hasPermission('documents_view');
  
  // הרשאות לתזכורות
  const canViewReminders = !loadingPerms && hasPermission('reminders_view');

  const [showNavOptions, setShowNavOptions] = useState(false);

  // סטייט עבור תרומות
  const [donations, setDonations] = useState<DonationRecord[]>(donor?.donations || []);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const [donationsError, setDonationsError] = useState(false);

  // סטייט עבור תזכורות
  const [reminders, setReminders] = useState<ReminderRecord[]>(donor?.reminders || []);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState(false);
  const [remindersReload, setRemindersReload] = useState(0);
  const [openReminderId, setOpenReminderId] = useState<string | null>(null);

  // ימי יארצייט (טבלה נפרדת)
  const [yahrzeits, setYahrzeits] = useState<SavedYahrzeit[]>([]);
  const donorIdForYahrzeits = donor?.id;
  useEffect(() => {
    if (!donorIdForYahrzeits) return;
    let cancelled = false;
    loadDonorYahrzeits(donorIdForYahrzeits).then((list) => {
      if (!cancelled) setYahrzeits(list);
    });
    return () => {
      cancelled = true;
    };
  }, [donorIdForYahrzeits, remindersRefreshKey]);
  const today = todayISO();

  /* =======================================================
     כתובת ושמות
  ======================================================= */

  const fullAddress = useMemo(() => {
    return [donor?.street, donor?.house_number, donor?.city, donor?.country].filter(Boolean).join(', ');
  }, [donor?.street, donor?.house_number, donor?.city, donor?.country]);

  const encodedAddress = useMemo(() => encodeURIComponent(fullAddress), [fullAddress]);

  const fullHebrewName = useMemo(() => {
    return [donor?.first_name_he, donor?.last_name_he].filter(Boolean).join(' ');
  }, [donor?.first_name_he, donor?.last_name_he]);

  const fullEnglishName = useMemo(() => {
    return [donor?.first_name_en, donor?.last_name_en].filter(Boolean).join(' ');
  }, [donor?.first_name_en, donor?.last_name_en]);

  /* =======================================================
     טעינת תרומות
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadDonations() {
      if (!donor?.id || loadingPerms || !canViewDonations) {
        if (!cancelled) {
          setDonations([]);
          setDonationsLoading(false);
          setDonationsError(false);
        }
        return;
      }

      if (!cancelled) setDonationsLoading(true);

      try {
        const donationSelect = canViewDonationAmount
          ? `id, donor_id, amount, currency, payment_method, donation_date, receipt_number, file_url, notes, created_at`
          : `id, donor_id, currency, payment_method, donation_date, receipt_number, file_url, notes, created_at`;

        const { data, error } = await supabase
          .from('donations')
          .select(donationSelect)
          .eq('donor_id', donor.id)
          .order('donation_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error('Error loading donor donations:', error);
          setDonationsError(true);
          return;
        }

        const normalizedDonations = ((data || []) as unknown as Donation[]).map((donation) => ({
          ...donation,
          amount: canViewDonationAmount ? Number(donation.amount) || 0 : 0,
        }));

        setDonations(normalizedDonations);
        setDonationsError(false);
      } catch {
        if (!cancelled) setDonationsError(true);
      } finally {
        if (!cancelled) setDonationsLoading(false);
      }
    }

    void loadDonations();
    return () => { cancelled = true; };
  }, [donor?.id, loadingPerms, canViewDonations, canViewDonationAmount]);

  /* =======================================================
     טעינת תזכורות
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadReminders() {
      if (!donor?.id || loadingPerms || !canViewReminders) {
        if (!cancelled) {
          setReminders([]);
          setRemindersLoading(false);
          setRemindersError(false);
        }
        return;
      }

      if (!cancelled) setRemindersLoading(true);

      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('donor_id', donor.id)
          .order('gregorian_date', { ascending: true }); // התזכורות הקרובות קודם

        if (cancelled) return;

        if (error) {
          console.error('Error loading donor reminders:', error);
          setRemindersError(true);
          return;
        }

        // מיון לפי המועד הבא (שבוצעו – בסוף)
        const list = (data || []) as unknown as Reminder[];
        setReminders(
          list
            .map((r) => ({ r, s: reminderState(r, todayISO()) }))
            .sort((a, b) => (a.s.effectiveDate ?? '9999').localeCompare(b.s.effectiveDate ?? '9999'))
            .map(({ r }) => r)
        );
        setRemindersError(false);
      } catch {
        if (!cancelled) setRemindersError(true);
      } finally {
        if (!cancelled) setRemindersLoading(false);
      }
    }

    void loadReminders();
    return () => { cancelled = true; };
  }, [donor?.id, loadingPerms, canViewReminders, remindersReload, remindersRefreshKey]);

  /* =======================================================
     בזמן טעינה / חסימת גישה
  ======================================================= */

  if (loadingPerms) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <div className="text-sm text-slate-500">טוען הרשאות...</div>
      </div>
    );
  }

  if (!canViewDonor) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        אין לך הרשאה לצפיה במסך תורמים.
      </div>
    );
  }

  /* =======================================================
     חישובים (סה"כ תרומות)
  ======================================================= */

  const totalDonations = donations.reduce((sum, donation) => sum + (Number(donation.amount) || 0), 0);
  const currencies = Array.from(new Set(donations.map((d) => d.currency || 'ILS')));
  const hasMultipleCurrencies = currencies.length > 1;
  const mainCurrency = donations[0]?.currency || 'ILS';
  const currencySymbol = getCurrencySymbol(mainCurrency);

  /* =======================================================
     Render
  ======================================================= */

  return (
    <div dir="rtl" className="w-full min-w-[560px] bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden text-right">
      
      {/* HEADER */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-lg shrink-0">
              {(donor.first_name_he || '?').charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 truncate">{fullHebrewName || 'ללא שם'}</h3>
              <div dir="ltr" className="text-[11px] text-slate-400 truncate">{fullEnglishName || 'No English name'}</div>
              {donor.zeout && <div className="text-[11px] text-slate-500">ת&quot;ז {donor.zeout}</div>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {donor.is_recurring && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                <CreditCard className="w-3 h-3" />
                הוראת קבע
              </span>
            )}
            {donor.has_yissachar_zevulun && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                <HeartHandshake className="w-3 h-3" />
                יששכר וזבולון
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-5 space-y-4">
        
        {/* CONTACT + ADDRESS */}
        <div className="grid grid-cols-2 gap-4">
          {contactAccess === 'locked' && (
            <LockedSection className="col-span-2" icon={<User className="w-3.5 h-3.5" />} title="פרטי קשר וכתובת" />
          )}
          {canViewContact && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <SectionTitle icon={<User className="w-3.5 h-3.5" />}>פרטי קשר</SectionTitle>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem
                  icon={<Phone className="w-3.5 h-3.5" />}
                  label="טלפון 1"
                  value={donor.phone_1 ? (<a href={`tel:${donor.phone_1}`} dir="ltr" className="hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{donor.phone_1}</a>) : undefined}
                  dir="ltr"
                />
                <InfoItem
                  icon={<Phone className="w-3.5 h-3.5" />}
                  label="טלפון 2"
                  value={donor.phone_2 ? (<a href={`tel:${donor.phone_2}`} dir="ltr" className="hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{donor.phone_2}</a>) : undefined}
                  dir="ltr"
                />
                <div className="col-span-2">
                  <InfoItem
                    icon={<Mail className="w-3.5 h-3.5" />}
                    label="אימייל"
                    value={donor.email ? (<a href={`mailto:${donor.email}`} dir="ltr" className="hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{donor.email}</a>) : undefined}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {canViewContact && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <SectionTitle icon={<MapPin className="w-3.5 h-3.5" />}>כתובת</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoItem icon={<Globe className="w-3.5 h-3.5" />} label="מדינה" value={donor.country} />
              <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="עיר" value={donor.city} />
              <InfoItem icon={<Home className="w-3.5 h-3.5" />} label="רחוב" value={donor.street} />
              <InfoItem icon={<Home className="w-3.5 h-3.5" />} label="מספר בית" value={donor.house_number} />
            </div>

            {fullAddress && (
              <div className="relative mt-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canViewDonor) return toast.denied('אין לך הרשאה לצפות בפרטי התורם!');
                    setShowNavOptions((prev) => !prev);
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" />
                  ניווט לכתובת
                </button>
                {showNavOptions && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                    <a href={`https://waze.com/ul?q=${encodedAddress}`} target="_blank" rel="noreferrer" className="block px-3 py-2 hover:bg-slate-50">Waze</a>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`} target="_blank" rel="noreferrer" className="block px-3 py-2 hover:bg-slate-50">Google Maps</a>
                    <a href={`maps://maps.apple.com/?q=${encodedAddress}`} target="_blank" rel="noreferrer" className="block px-3 py-2 hover:bg-slate-50">Apple Maps</a>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* DATES + ADDITIONAL DETAILS */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <InfoItem
              icon={<Cake className="w-3.5 h-3.5" />}
              label="תאריך לידה"
              value={
                donor.birthday
                  ? `${formatDate(donor.birthday)} · ${(() => {
                      const p = toHebrewParts(donor.birthday, !!donor.birthday_after_sunset);
                      return formatHebrewParts(p.day, p.month, p.year);
                    })()}`
                  : undefined
              }
            />
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <InfoItem
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="ימי יארצייט"
              value={
                yahrzeits.length > 0 ? (
                  <span className="flex flex-col gap-0.5">
                    {yahrzeits.map((y) => (
                      <span key={y.id}>
                        {formatHebrewParts(y.day, y.month)}
                        {y.name ? ` – ${y.name}` : ''}
                      </span>
                    ))}
                  </span>
                ) : undefined
              }
            />
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <InfoItem icon={<User className="w-3.5 h-3.5" />} label="איש קשר" value={donor.connected_contact} />
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <InfoItem icon={<Clock className="w-3.5 h-3.5" />} label="תאריך הצטרפות" value={donor.created_at ? new Date(donor.created_at).toLocaleDateString('he-IL') : 'לא צוין'} />
          </div>
        </div>

        {/* YISSACHAR ZEVULUN */}
        {donor.has_yissachar_zevulun && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <div className="text-[10px] text-amber-600">הסכם יששכר וזבולון</div>
                  <div className="text-xs font-bold text-amber-900">{donor.yissachar_zevulun_name || 'שם האברך לא צוין'}</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-700 font-semibold">פעיל</span>
            </div>
          </div>
        )}

        {/* REMINDERS AREA - אזור התזכורות החדש */}
        {remindersAccess === 'locked' && (
          <LockedSection icon={<Bell className="w-3.5 h-3.5 text-blue-500" />} title="תזכורות משויכות" />
        )}
        {canViewReminders && (
          <div className="rounded-xl border border-blue-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
              <SectionTitle icon={<Bell className="w-3.5 h-3.5 text-blue-500" />}>
                תזכורות משויכות
              </SectionTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-blue-600/70 font-medium">{reminders.length} תזכורות</span>
              </div>
            </div>

            {remindersLoading && (
              <div className="px-4 py-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> טוען תזכורות...
              </div>
            )}

            {!remindersLoading && remindersError && (
              <div className="px-4 py-4 text-[11px] text-red-500 bg-red-50">לא ניתן לטעון את התזכורות של התורם.</div>
            )}

            {!remindersLoading && !remindersError && reminders.length === 0 && (
              <div className="px-4 py-4 text-[11px] text-slate-400">אין תזכורות משויכות כרגע.</div>
            )}

            {!remindersLoading && !remindersError && reminders.length > 0 && (
              <div className="p-2 grid grid-cols-1 gap-2">
                {reminders.map((reminder) => {
                  const st = reminderState(reminder, today);
                  const style = STATUS_STYLES[st.status];
                  return (
                    <button
                      key={reminder.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenReminderId(reminder.id);
                      }}
                      className="w-full text-right bg-white rounded-lg px-3 py-2.5 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                            <CalendarClock className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-bold ${st.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {reminder.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {st.effectiveDate && (
                                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {formatHebrewDate(st.effectiveDate)} · {formatGregorian(st.effectiveDate)}
                                </span>
                              )}
                              {reminder.repeat_unit && reminder.repeat_unit !== 'none' && (
                                <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                  {describeRepeat(reminder)}
                                </span>
                              )}
                              {reminder.source && reminder.source !== 'manual' && (
                                <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">אוטומטי</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${style.badge}`}>{style.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RECURRING */}
        <DonorRecurringSection donor={donor} />

        {/* DONATIONS */}
        {donationsAccess === 'locked' && (
          <LockedSection icon={<CreditCard className="w-3.5 h-3.5" />} title="תרומות משויכות" />
        )}
        {canViewDonations && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <SectionTitle icon={<CreditCard className="w-3.5 h-3.5" />}>תרומות משויכות</SectionTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{donations.length} תרומות</span>
                {!donationsLoading && donations.length > 0 && canViewDonationAmount && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                    {hasMultipleCurrencies ? 'מספר מטבעות' : `סה"כ ${totalDonations.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`}
                  </span>
                )}
              </div>
            </div>

            {donationsLoading && (
              <div className="px-4 py-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> טוען תרומות...
              </div>
            )}

            {!donationsLoading && donationsError && (
              <div className="px-4 py-4 text-[11px] text-red-500 bg-red-50">לא ניתן לטעון את התרומות של התורם.</div>
            )}

            {!donationsLoading && !donationsError && donations.length === 0 && (
              <div className="px-4 py-4 text-[11px] text-slate-400">אין תרומות משויכות כרגע.</div>
            )}

            {!donationsLoading && !donationsError && donations.length > 0 && (
              <div className="p-2 grid grid-cols-1 gap-2">
                {donations.map((donation) => {
                  const symbol = getCurrencySymbol(donation.currency);
                  const paymentMethodLabel = getPaymentMethodLabel(donation.payment_method);
                  return (
                    <div key={donation.id} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 hover:bg-slate-100 transition">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            {canViewDonationAmount && (
                              <div className="text-sm font-bold text-slate-800">
                                {Number(donation.amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbol}
                              </div>
                            )}
                            {amountAccess === 'locked' && <LockedText text="סכום: אין הרשאה" />}
                            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                              אמצעי תשלום: <span className="text-slate-700">{paymentMethodLabel}</span>
                              {donation.external_source === 'nedarim' && (
                                <span className="mr-1.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">נדרים פלוס</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-[10px] text-slate-400 text-left">{formatDate(donation.donation_date)}</div>
                          {(onOpenDonationById || onViewDonation) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenDonationById) { void onOpenDonationById(donation.id, e); return; }
                                if (onViewDonation) { onViewDonation(donation, e); }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 text-[10px] font-semibold transition whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" /> כניסה לפרטי תרומה
                            </button>
                          )}
                        </div>
                      </div>

                      {(donation.receipt_number || donation.notes || donation.file_url) && (
                        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {donation.receipt_number && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Receipt className="w-3 h-3" /> קבלה: {donation.receipt_number}
                              </div>
                            )}
                            {donation.notes && (
                              <div className="text-[10px] text-slate-400 truncate" title={donation.notes}>{donation.notes}</div>
                            )}
                          </div>
                          {donation.file_url && (
                            <a href="#" onClick={(e) => openSecureFile(e, donation.file_url)} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 hover:underline shrink-0">
                              <Paperclip className="w-3 h-3" /> מסמך
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FILES */}
        {documentsAccess === 'locked' && donor.files && donor.files.length > 0 && (
          <LockedSection icon={<Paperclip className="w-3.5 h-3.5" />} title="קבצים ומסמכים" />
        )}
        {canViewDocuments && donor.files && donor.files.length > 0 && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <SectionTitle icon={<Paperclip className="w-3.5 h-3.5" />}>קבצים ומסמכים ({donor.files.length})</SectionTitle>
            </div>
            <div className="p-2 grid grid-cols-2 gap-2">
              {donor.files.map((file) => (
                <a key={file.id} href="#" onClick={(e) => openSecureFile(e, file.url || file.file_url)} className="bg-slate-50 hover:bg-blue-50 p-2 rounded-lg text-[11px] flex items-center justify-between gap-2 border border-slate-100 text-slate-700 hover:text-blue-700 transition">
                  <span className="truncate font-medium">{file.name}</span>
                  <Download className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* SPECIAL DATES */}
        {donor.special_dates && donor.special_dates.length > 0 && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <SectionTitle icon={<Calendar className="w-3.5 h-3.5" />}>תאריכים מיוחדים</SectionTitle>
            </div>
            <div className="p-2 grid grid-cols-2 gap-2">
              {donor.special_dates.map((sd: SpecialDate, index: number) => (
                <div key={index} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-700">{sd.title}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{sd.date}</span>
                  </div>
                  {sd.notes && <div className="text-[10px] text-slate-400 mt-1">{sd.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTES */}
        <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 mb-1">
            <FileText className="w-3.5 h-3.5" /> הערות
          </div>
          <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">
            {donor.notes || 'אין הערות'}
          </p>
        </div>
      </div>

      {/* FOOTER - כפתורי פעולות */}
      {((onAddDonation && createDonationAccess !== 'hidden') || (onAddReminder && createReminderAccess !== 'hidden')) && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
          {onAddDonation && (
            <Protect permId="donations_create" className="w-full [&>span>*]:w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddDonation(e);
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" /> רישום תרומה
            </button>
            </Protect>
          )}

          {onAddReminder && (
            <Protect permId="reminders_create" className="w-full [&>span>*]:w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // בלחיצה מפעילים את הפרופ, והקומפוננטה שעוטפת 
                // תצטרך לטפל בשיוך לתורם בעזרת ה-id שלו
                onAddReminder(e);
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Bell className="w-3.5 h-3.5" /> הוספת תזכורת
            </button>
            </Protect>
          )}
        </div>
      )}

      {openReminderId && (() => {
        const r = reminders.find((x) => x.id === openReminderId);
        if (!r) return null;
        return (
          <ReminderCardModal
            reminder={r}
            donor={donor}
            onClose={() => setOpenReminderId(null)}
            onChanged={() => setRemindersReload((k) => k + 1)}
            onEdit={(rem) => {
              setOpenReminderId(null);
              onEditReminder?.(rem);
            }}
            onViewDonor={() => setOpenReminderId(null)}
          />
        );
      })()}
    </div>
  );
}