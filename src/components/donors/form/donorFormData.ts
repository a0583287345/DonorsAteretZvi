import type { Donor } from '@/types/donor';

/** יארצייט אחד בטופס. id קיים = שמור במסד (donor_yahrzeits) */
export interface YahrzeitEntry {
  key: string;
  id?: string;
  day: number;
  month: number;
  name: string;
}

let keyCounter = 0;
export const newYahrzeitKey = () => `new-${Date.now()}-${keyCounter++}`;

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
  /** ימי יארצייט – תאריך עברי בלבד (נטענים בנפרד מ-donor_yahrzeits) */
  yahrzeits: YahrzeitEntry[];
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
  yahrzeits: [],
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
    yahrzeits: [],
    notes: donor.notes || '',
  };
}

/** המרת הטופס לשורה בטבלת donors (שדות ריקים → null) */
export function formDataToPayload(formData: DonorFormData) {
  const text = (value: string) => value.trim() || null;
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
    notes: text(formData.notes),
  };
}

/** יארצייטים תקינים בלבד (נבחרו גם יום וגם חודש) */
export function validYahrzeits(list: YahrzeitEntry[]): YahrzeitEntry[] {
  return list.filter((y) => y.day > 0 && y.month > 0);
}
