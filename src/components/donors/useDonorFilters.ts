import { useMemo, useState } from 'react';
import type { Donation, Donor } from '@/types/donor';
import { usePersistentObject, usePersistentState } from '@/hooks/usePersistentState';
import {
  buildOptions,
  inDateRange,
  inNumberRange,
  matchesTokens,
  matchesYesNo,
  type YesNoAll,
} from '@/lib/filters';

export type DonorSort =
  | 'created_desc'
  | 'created_asc'
  | 'last_name_asc'
  | 'last_name_desc'
  | 'first_name_asc'
  | 'last_donation_desc'
  | 'last_donation_asc'
  | 'donation_count_desc'
  | 'city_asc';

/** אפשרויות המיון. בלי הרשאה לפרטי התקשרות – בלי מיון לפי עיר */
export function getDonorSortOptions(canViewContact: boolean): { value: DonorSort; label: string }[] {
  return [
    { value: 'created_desc', label: 'נוסף למערכת: מהחדש לישן' },
    { value: 'created_asc', label: 'נוסף למערכת: מהישן לחדש' },
    { value: 'last_name_asc', label: 'שם משפחה: א → ת' },
    { value: 'last_name_desc', label: 'שם משפחה: ת → א' },
    { value: 'first_name_asc', label: 'שם פרטי: א → ת' },
    { value: 'last_donation_desc', label: 'תרומה אחרונה: מהחדש לישן' },
    { value: 'last_donation_asc', label: 'תרומה אחרונה: מהישן לחדש' },
    { value: 'donation_count_desc', label: 'מספר תרומות: מהרב למעט' },
    ...(canViewContact ? [{ value: 'city_asc' as const, label: 'עיר: א → ת' }] : []),
  ];
}

const DONOR_SORTS = getDonorSortOptions(true).map((o) => o.value);

/** כל הסינונים של לשונית התורמים – נשמרים יחד בדפדפן */
const DEFAULT_DONOR_FILTERS = {
  search: '',
  // סינון רגיל
  country: [] as string[],
  city: [] as string[],
  contact: [] as string[],
  recurring: 'all' as YesNoAll,
  hasDonations: 'all' as YesNoAll,
  // סינון מתקדם
  street: [] as string[],
  phone: [] as string[],
  email: [] as string[],
  zeout: [] as string[],
  yissachar: 'all' as YesNoAll,
  notes: '',
  createdFrom: '',
  createdTo: '',
  lastDonationFrom: '',
  lastDonationTo: '',
  countMin: '',
  countMax: '',
};

export type DonorFilterState = typeof DEFAULT_DONOR_FILTERS;

/** שדות שדורשים הרשאה לפרטי התקשרות – בלעדיה לא מסננים לפיהם ולא מציגים אותם */
const CONTACT_FIELDS: (keyof DonorFilterState)[] = ['country', 'city', 'street', 'phone', 'email', 'zeout'];
const ADVANCED_FIELDS: (keyof DonorFilterState)[] = [
  'street', 'phone', 'email', 'zeout', 'yissachar', 'notes',
  'createdFrom', 'createdTo', 'lastDonationFrom', 'lastDonationTo', 'countMin', 'countMax',
];

const isFieldActive = (v: string | string[]) => (Array.isArray(v) ? v.length > 0 : v.trim() !== '' && v !== 'all');

const time = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0);
const compareHe = (a: string | null | undefined, b: string | null | undefined) => {
  // ריקים תמיד בסוף
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he');
};

const has = (value: string | null | undefined, query: string) =>
  (value || '').toLowerCase().includes(query);

const isoDay = (ms: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

/**
 * כל מצב החיפוש והסינון של רשימת התורמים.
 * בלי הרשאה לראות פרטי התקשרות – לא מחפשים ולא מסננים לפי טלפון, אימייל, ת"ז וכתובת.
 */
export function useDonorFilters(donors: Donor[], donations: Donation[], canViewContact: boolean) {
  const [sort, setSort] = usePersistentState<DonorSort>('donors.sort', 'created_desc', DONOR_SORTS);
  const [filters, setFilter, resetFilters] = usePersistentObject('donors.filters', DEFAULT_DONOR_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // מספר תרומות ותאריך התרומה האחרונה לכל תורם (לסינון, למיון ולסיכום)
  const donationStats = useMemo(() => {
    const stats = new Map<string, { count: number; last: number }>();
    for (const d of donations) {
      if (!d.donor_id) continue;
      const s = stats.get(d.donor_id) || { count: 0, last: 0 };
      s.count += 1;
      s.last = Math.max(s.last, time(d.donation_date));
      stats.set(d.donor_id, s);
    }
    return stats;
  }, [donations]);

  // האפשרויות לכל תיבת בחירה, עם מספר התורמים לכל ערך
  const options = useMemo(
    () => ({
      country: buildOptions(donors, (d) => [d.country]),
      city: buildOptions(donors, (d) => [d.city]),
      street: buildOptions(donors, (d) => [d.street]),
      contact: buildOptions(donors, (d) => [d.connected_contact]),
      phone: buildOptions(donors, (d) => [d.phone_1, d.phone_2]),
      email: buildOptions(donors, (d) => [d.email]),
      zeout: buildOptions(donors, (d) => [d.zeout]),
    }),
    [donors]
  );

  const filteredDonors = useMemo(() => {
    const f = filters;
    const query = f.search.toLowerCase().trim();
    const notesQuery = f.notes.toLowerCase().trim();

    return donors.filter((donor) => {
      if (query) {
        const fields: (string | null | undefined)[] = [
          `${donor.first_name_he || ''} ${donor.last_name_he || ''}`,
          `${donor.first_name_en || ''} ${donor.last_name_en || ''}`,
          donor.connected_contact,
          donor.yissachar_zevulun_name,
          donor.notes,
          donor.birthday ? String(donor.birthday) : '',
          donor.yahrzeit_date ? String(donor.yahrzeit_date) : '',
        ];
        if (canViewContact) {
          fields.push(
            donor.phone_1,
            donor.phone_2,
            donor.email,
            donor.zeout,
            donor.country,
            donor.city,
            donor.street,
            donor.house_number
          );
        }
        if (!fields.some((field) => has(field, query))) return false;
      }

      if (canViewContact) {
        if (!matchesTokens(f.country, [donor.country])) return false;
        if (!matchesTokens(f.city, [donor.city])) return false;
        if (!matchesTokens(f.street, [donor.street])) return false;
        if (!matchesTokens(f.phone, [donor.phone_1, donor.phone_2])) return false;
        if (!matchesTokens(f.email, [donor.email])) return false;
        if (!matchesTokens(f.zeout, [donor.zeout])) return false;
      }

      if (!matchesTokens(f.contact, [donor.connected_contact])) return false;
      if (notesQuery && !has(donor.notes, notesQuery)) return false;

      if (!matchesYesNo(f.recurring, !!donor.is_recurring)) return false;
      if (!matchesYesNo(f.yissachar, !!donor.has_yissachar_zevulun)) return false;

      const stats = donationStats.get(donor.id);
      if (!matchesYesNo(f.hasDonations, !!stats)) return false;
      if (!inDateRange(donor.created_at, f.createdFrom, f.createdTo)) return false;
      if (!inDateRange(isoDay(stats?.last ?? 0), f.lastDonationFrom, f.lastDonationTo)) return false;
      if (!inNumberRange(stats?.count ?? 0, f.countMin, f.countMax)) return false;

      return true;
    });
  }, [donors, donationStats, canViewContact, filters]);

  const sortedDonors = useMemo(() => {
    const effective = !canViewContact && sort === 'city_asc' ? 'created_desc' : sort;
    const lastOf = (d: Donor) => donationStats.get(d.id)?.last || 0;
    const countOf = (d: Donor) => donationStats.get(d.id)?.count || 0;

    return [...filteredDonors].sort((a, b) => {
      switch (effective) {
        case 'created_asc':
          return time(a.created_at) - time(b.created_at);
        case 'last_name_asc':
          return compareHe(a.last_name_he, b.last_name_he) || compareHe(a.first_name_he, b.first_name_he);
        case 'last_name_desc':
          return compareHe(b.last_name_he, a.last_name_he) || compareHe(b.first_name_he, a.first_name_he);
        case 'first_name_asc':
          return compareHe(a.first_name_he, b.first_name_he) || compareHe(a.last_name_he, b.last_name_he);
        case 'last_donation_desc':
          return lastOf(b) - lastOf(a);
        case 'last_donation_asc': {
          // מי שלא תרם בכלל – בסוף
          const la = lastOf(a) || Infinity;
          const lb = lastOf(b) || Infinity;
          return la === lb ? 0 : la < lb ? -1 : 1;
        }
        case 'donation_count_desc':
          return countOf(b) - countOf(a);
        case 'city_asc':
          return compareHe(a.city, b.city);
        case 'created_desc':
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
  }, [filteredDonors, donationStats, sort, canViewContact]);

  const filteredDonorsWithDonations = useMemo(
    () => filteredDonors.filter((d) => donationStats.has(d.id)).length,
    [filteredDonors, donationStats]
  );

  // סינון שנשמר מהפעם הקודמת – חשוב לסמן שהוא פעיל.
  // סינוני פרטי התקשרות נחשבים רק כשיש הרשאה (בלעדיה הם לא מופעלים)
  const counts = (fields: (keyof DonorFilterState)[]) =>
    fields.filter((k) => (canViewContact || !CONTACT_FIELDS.includes(k)) && isFieldActive(filters[k])).length;
  const allFields = Object.keys(DEFAULT_DONOR_FILTERS) as (keyof DonorFilterState)[];
  const hasActiveFilters = counts(allFields) > 0;
  const advancedActiveCount = counts(ADVANCED_FIELDS);

  const filteredRecurringCount = useMemo(
    () => filteredDonors.filter((d) => d.is_recurring).length,
    [filteredDonors]
  );

  const filteredYissacharZevulunCount = useMemo(
    () => filteredDonors.filter((d) => d.has_yissachar_zevulun).length,
    [filteredDonors]
  );

  return {
    filters,
    setFilter,
    options,
    showFilters,
    setShowFilters,
    resetFilters,
    hasActiveFilters,
    advancedActiveCount,
    sort,
    setSort,
    /** התוצאות אחרי סינון ומיון */
    filteredDonors: sortedDonors,
    filteredDonorsWithDonations,
    filteredRecurringCount,
    filteredYissacharZevulunCount,
  };
}

export type DonorFilters = ReturnType<typeof useDonorFilters>;
