import type { Donor } from '@/types/donor';

export interface DonorFormData {
  first_name_he: string;
  last_name_he: string;
  first_name_en: string;
  last_name_en: string;
  phone_1: string;
  phone_2: string;
  email: string;
  country: string;
  city: string;
  street: string;
  house_number: string;
  is_recurring: boolean;
  has_yissachar_zevulun: boolean;
  yissachar_zevulun_name: string;
  connected_contact: string;
  birthday: string;
  birthday_after_sunset: boolean;
  /** יארצייט – תאריך עברי בלבד (0 = לא הוגדר) */
  yahrzeit_hebrew_day: number;
  yahrzeit_hebrew_month: number;
  yahrzeit_of: string;
  notes: string;
}

export type UpdateDonorField = <K extends keyof DonorFormData>(field: K, value: DonorFormData[K]) => void;

export type DonorFormSectionProps = {
  formData: DonorFormData;
  updateField: UpdateDonorField;
};

export const emptyDonorFormData: DonorFormData = {
  first_name_he: '',
  last_name_he: '',
  first_name_en: '',
  last_name_en: '',
  phone_1: '',
  phone_2: '',
  email: '',
  country: 'ישראל',
  city: '',
  street: '',
  house_number: '',
  is_recurring: false,
  has_yissachar_zevulun: false,
  yissachar_zevulun_name: '',
  connected_contact: '',
  birthday: '',
  birthday_after_sunset: false,
  yahrzeit_hebrew_day: 0,
  yahrzeit_hebrew_month: 0,
  yahrzeit_of: '',
  notes: '',
};

/** נתוני הטופס מתורם קיים (או טופס ריק לתורם חדש) */
export function donorToFormData(donor: Donor | null | undefined): DonorFormData {
  if (!donor) return { ...emptyDonorFormData };
  return {
    first_name_he: donor.first_name_he || '',
    last_name_he: donor.last_name_he || '',
    first_name_en: donor.first_name_en || '',
    last_name_en: donor.last_name_en || '',
    phone_1: donor.phone_1 || '',
    phone_2: donor.phone_2 || '',
    email: donor.email || '',
    country: donor.country || 'ישראל',
    city: donor.city || '',
    street: donor.street || '',
    house_number: donor.house_number || '',
    is_recurring: Boolean(donor.is_recurring),
    has_yissachar_zevulun: Boolean(donor.has_yissachar_zevulun),
    yissachar_zevulun_name: donor.yissachar_zevulun_name || '',
    connected_contact: donor.connected_contact || '',
    birthday: donor.birthday ? String(donor.birthday).slice(0, 10) : '',
    birthday_after_sunset: Boolean(donor.birthday_after_sunset),
    yahrzeit_hebrew_day: donor.yahrzeit_hebrew_day || 0,
    yahrzeit_hebrew_month: donor.yahrzeit_hebrew_month || 0,
    yahrzeit_of: donor.yahrzeit_of || '',
    notes: donor.notes || '',
  };
}

/** המרת הטופס לשורה בטבלת donors (שדות ריקים → null) */
export function formDataToPayload(formData: DonorFormData) {
  const text = (value: string) => value.trim() || null;
  const hasYahrzeit = formData.yahrzeit_hebrew_day > 0 && formData.yahrzeit_hebrew_month > 0;
  return {
    first_name_he: text(formData.first_name_he),
    last_name_he: text(formData.last_name_he),
    first_name_en: text(formData.first_name_en),
    last_name_en: text(formData.last_name_en),
    phone_1: text(formData.phone_1),
    phone_2: text(formData.phone_2),
    email: text(formData.email),
    country: text(formData.country),
    city: text(formData.city),
    street: text(formData.street),
    house_number: text(formData.house_number),
    is_recurring: Boolean(formData.is_recurring),
    has_yissachar_zevulun: Boolean(formData.has_yissachar_zevulun),
    yissachar_zevulun_name:
      formData.has_yissachar_zevulun && formData.yissachar_zevulun_name.trim()
        ? formData.yissachar_zevulun_name.trim()
        : null,
    connected_contact: text(formData.connected_contact),
    birthday: formData.birthday || null,
    birthday_after_sunset: Boolean(formData.birthday && formData.birthday_after_sunset),
    // יארצייט נשמר רק אם נבחרו גם יום וגם חודש
    yahrzeit_hebrew_day: hasYahrzeit ? formData.yahrzeit_hebrew_day : null,
    yahrzeit_hebrew_month: hasYahrzeit ? formData.yahrzeit_hebrew_month : null,
    yahrzeit_of: hasYahrzeit ? text(formData.yahrzeit_of) : null,
    notes: text(formData.notes),
  };
}
