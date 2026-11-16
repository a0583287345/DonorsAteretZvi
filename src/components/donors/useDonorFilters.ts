import { useMemo, useState } from 'react';
import type { Donation, Donor } from '@/types/donor';

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

const time = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0);
const compareHe = (a: string | null | undefined, b: string | null | undefined) => {
  // ריקים תמיד בסוף
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he');
};

const uniqueSorted = (values: (string | null)[]) =>
  Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'he'));

const has = (value: string | null | undefined, query: string) =>
  (value || '').toLowerCase().includes(query);

/**
 * כל מצב החיפוש והסינון של רשימת התורמים.
 * בלי הרשאה לראות פרטי התקשרות – לא מחפשים ולא מסננים לפי טלפון, אימייל וכתובת.
 */
export function useDonorFilters(donors: Donor[], donations: Donation[], canViewContact: boolean) {
  const [sort, setSort] = useState<DonorSort>('created_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [recurringFilter, setRecurringFilter] = useState('');
  const [yissacharFilter, setYissacharFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [notesFilter, setNotesFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const countries = useMemo(() => uniqueSorted(donors.map((d) => d.country)), [donors]);
  const cities = useMemo(() => uniqueSorted(donors.map((d) => d.city)), [donors]);
  const streets = useMemo(() => uniqueSorted(donors.map((d) => d.street)), [donors]);
  const contacts = useMemo(() => uniqueSorted(donors.map((d) => d.connected_contact)), [donors]);

  const resetFilters = () => {
    setSearchQuery('');
    setCountryFilter('');
    setCityFilter('');
    setStreetFilter('');
    setContactFilter('');
    setRecurringFilter('');
    setYissacharFilter('');
    setEmailFilter('');
    setPhoneFilter('');
    setNotesFilter('');
  };

  const filteredDonors = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return donors.filter((donor) => {
      if (query) {
        const fields: (string | null)[] = [
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
            donor.country,
            donor.city,
            donor.street,
            donor.house_number
          );
        }
        if (!fields.some((field) => has(field, query))) return false;
      }

      if (canViewContact) {
        if (countryFilter && donor.country !== countryFilter) return false;
        if (cityFilter && donor.city !== cityFilter) return false;
        if (streetFilter && donor.street !== streetFilter) return false;
        if (emailFilter && !has(donor.email, emailFilter.toLowerCase())) return false;
        if (phoneFilter && !has(`${donor.phone_1 || ''} ${donor.phone_2 || ''}`, phoneFilter.toLowerCase()))
          return false;
      }

      if (contactFilter && donor.connected_contact !== contactFilter) return false;
      if (notesFilter && !has(donor.notes, notesFilter.toLowerCase())) return false;

      if (recurringFilter === 'yes' && !donor.is_recurring) return false;
      if (recurringFilter === 'no' && donor.is_recurring) return false;
      if (yissacharFilter === 'yes' && !donor.has_yissachar_zevulun) return false;
      if (yissacharFilter === 'no' && donor.has_yissachar_zevulun) return false;

      return true;
    });
  }, [
    donors,
    canViewContact,
    searchQuery,
    countryFilter,
    cityFilter,
    streetFilter,
    contactFilter,
    recurringFilter,
    yissacharFilter,
    emailFilter,
    phoneFilter,
    notesFilter,
  ]);

  // מספר תרומות ותאריך התרומה האחרונה לכל תורם (למיון ולסיכום)
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

  const hasActiveFilters =
    searchQuery !== '' ||
    countryFilter !== '' ||
    cityFilter !== '' ||
    streetFilter !== '' ||
    contactFilter !== '' ||
    recurringFilter !== '' ||
    yissacharFilter !== '' ||
    emailFilter !== '' ||
    phoneFilter !== '' ||
    notesFilter !== '';

  const filteredRecurringCount = useMemo(
    () => filteredDonors.filter((d) => d.is_recurring).length,
    [filteredDonors]
  );

  const filteredYissacharZevulunCount = useMemo(
    () => filteredDonors.filter((d) => d.has_yissachar_zevulun).length,
    [filteredDonors]
  );

  return {
    searchQuery, setSearchQuery,
    countryFilter, setCountryFilter,
    cityFilter, setCityFilter,
    streetFilter, setStreetFilter,
    contactFilter, setContactFilter,
    recurringFilter, setRecurringFilter,
    yissacharFilter, setYissacharFilter,
    emailFilter, setEmailFilter,
    phoneFilter, setPhoneFilter,
    notesFilter, setNotesFilter,
    showFilters, setShowFilters,
    countries,
    cities,
    streets,
    contacts,
    resetFilters,
    hasActiveFilters,
    sort, setSort,
    /** התוצאות אחרי סינון ומיון */
    filteredDonors: sortedDonors,
    filteredDonorsWithDonations,
    filteredRecurringCount,
    filteredYissacharZevulunCount,
  };
}

export type DonorFilters = ReturnType<typeof useDonorFilters>;
