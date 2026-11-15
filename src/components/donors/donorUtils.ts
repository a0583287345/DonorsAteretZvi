import * as XLSX from 'xlsx';
import type { Donor } from '@/types/donor';

export type NavigationOption = 'google' | 'waze' | 'apple';

export function getFullAddress(donor: Donor) {
  return [donor.street, donor.house_number, donor.city, donor.country].filter(Boolean).join(', ');
}

/** פתיחת אפליקציית ניווט לכתובת בחלון חדש */
export function openNavigation(address: string, option: NavigationOption) {
  const encoded = encodeURIComponent(address);
  const urls: Record<NavigationOption, string> = {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    waze: `https://www.waze.com/ul?q=${encoded}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${encoded}`,
  };
  window.open(urls[option], '_blank', 'noopener,noreferrer');
}

/** ייצוא תורמים לאקסל. בלי הרשאה לפרטי התקשרות – העמודות האלה לא נכללות */
export function exportDonorsToExcel(donors: Donor[], canViewContact: boolean) {
  const rows = donors.map((donor) => ({
    'שם פרטי': donor.first_name_he || '',
    'שם משפחה': donor.last_name_he || '',
    'שם באנגלית': `${donor.first_name_en || ''} ${donor.last_name_en || ''}`.trim(),
    ...(canViewContact
      ? {
          'טלפון 1': donor.phone_1 || '',
          'טלפון 2': donor.phone_2 || '',
          'אימייל': donor.email || '',
          'מדינה': donor.country || '',
          'עיר': donor.city || '',
          'רחוב': donor.street || '',
          'מספר בית': donor.house_number || '',
        }
      : {}),
    'הוראת קבע': donor.is_recurring ? 'כן' : 'לא',
    'יששכר וזבולון': donor.has_yissachar_zevulun ? 'כן' : 'לא',
    'שם יששכר וזבולון': donor.yissachar_zevulun_name || '',
    'איש קשר': donor.connected_contact || '',
    'תאריך לידה': donor.birthday || '',
    'יארצייט': donor.yahrzeit_date || '',
    'הערות': donor.notes || '',
    'תאריך יצירה': donor.created_at ? new Date(donor.created_at).toLocaleDateString('he-IL') : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // רוחב עמודות לפי הכותרת (מינימום 11, מקסימום 40)
  const headers = Object.keys(rows[0] ?? {});
  worksheet['!cols'] = headers.map((h) => ({
    wch: h === 'הערות' ? 40 : Math.min(40, Math.max(11, h.length + 6)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'תורמים');

  const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
  XLSX.writeFile(workbook, `רשימת-תורמים-${today}.xlsx`);
}
