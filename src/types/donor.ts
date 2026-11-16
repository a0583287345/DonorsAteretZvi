export interface SpecialDate {
  id?: string;
  title: string;
  date: string;
  notes?: string;
}

export interface Attachment {
  id?: string;
  donation_id?: string;
  donor_id?: string;
  file_name?: string;
  name?: string;
  file_url?: string;
  url?: string;
  file_type?: string;
  created_at?: string | null;
}

export interface Donor {
  id: string;
  first_name_he: string | null;
  last_name_he: string | null;
  first_name_en: string | null;
  last_name_en: string | null;
  /** תעודת זהות (9 ספרות) – לזיהוי בייבוא */
  zeout?: string | null;
  phone_1: string | null;
  phone_2: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  street: string | null;
  house_number: string | null;
  is_recurring: boolean;
  has_yissachar_zevulun: boolean;
  yissachar_zevulun_name: string | null;
  birthday: string | null;
  birthday_after_sunset?: boolean;
  /** ישן – לא בשימוש. יארצייט נשמר כתאריך עברי בשדות הבאים */
  yahrzeit_date: string | null;
  yahrzeit_hebrew_day?: number | null;
  yahrzeit_hebrew_month?: number | null;
  /** לעילוי נשמת (שם הנפטר) */
  yahrzeit_of?: string | null;
  connected_contact: string | null;
  special_dates?: SpecialDate[] | null;
  notes: string | null;
  created_at: string | null;
}

export interface Donation {
  id: string;
  donor_id: string | null;
  amount: number;
  currency: string | null;
  payment_method: string | null;
  donation_date: string | null;
  receipt_number: string | null;
  notes: string | null;
  file_url: string | null;
  /** מקור חיצוני (nedarim) ומספר העסקה שם – לתרומות מיובאות */
  external_source?: string | null;
  external_id?: string | null;
  installments?: number | null;
  category?: string | null;
  /** מספר הוראת הקבע בנדרים פלוס (חיוב חודשי) */
  recurring_external_id?: string | null;
  attachments?: Attachment[];
  created_at: string | null;
}

export interface ExtendedDonor extends Donor {
  total_donations?: number;
  donations?: Donation[];
  files?: Attachment[];
}
export interface ReminderAttachment {
  name: string;
  url: string;
  path?: string;
  uploaded_at?: string;
}

export interface Reminder {
  id: string;
  donor_id: string | null;
  title: string;
  description?: string | null;
  gregorian_date: string;
  hebrew_date?: string | null;
  is_recurring?: boolean | null;
  recurring_type?: string | null;
  notify_email?: boolean | null;
  is_completed?: boolean | null;
  attachments?: ReminderAttachment[] | null;
  created_at: string | null;
  created_by?: string | null;
  // מנוע התזכורות (שלב 4)
  date_type?: string;
  hebrew_day?: number | null;
  hebrew_month?: number | null;
  hebrew_year?: number | null;
  repeat_unit?: string;
  repeat_interval?: number;
  repeat_end_type?: string;
  repeat_until?: string | null;
  repeat_count?: number | null;
  lead_days?: number;
  completed_through?: string | null;
  snoozed_until?: string | null;
  /** manual / donor_birthday_gregorian / donor_birthday_hebrew / donor_yahrzeit */
  source?: string;
  /** none / birthday / memorial / custom */
  donor_message_type?: string;
  donor_message_custom?: string | null;
}
