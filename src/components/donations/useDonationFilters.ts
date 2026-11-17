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
import { getDonationSortOptions, getPaymentMethodLabel, type DonationSort } from './donationUtils';

const DONATION_SORTS = getDonationSortOptions(true).map((o) => o.value);

/** הוראת קבע / רגילה – המתג שמעל הסינון */
export type DonationKind = 'all' | 'recurring' | 'regular';

/** תרומה שהיא חיוב של הוראת קבע */
export const isRecurringDonation = (d: Donation) => !!d.recurring_external_id;

export const SOURCE_LABELS: Record<string, string> = { nedarim: 'נדרים פלוס', manual: 'הוזן ידנית', excel: 'ייבוא מאקסל' };

/** כל הסינונים של לשונית התרומות – נשמרים יחד בדפדפן */
const DEFAULT_DONATION_FILTERS = {
  search: '',
  kind: 'all' as DonationKind,
  // סינון רגיל
  donor: [] as string[],
  dateFrom: '',
  dateTo: '',
  method: [] as string[],
  currency: [] as string[],
  // סינון מתקדם
  amountMin: '',
  amountMax: '',
  source: [] as string[],
  category: [] as string[],
  city: [] as string[],
  country: [] as string[],
  createdFrom: '',
  createdTo: '',
  hasReceipt: 'all' as YesNoAll,
  hasFile: 'all' as YesNoAll,
  hasNotes: 'all' as YesNoAll,
};

export type DonationFilterState = typeof DEFAULT_DONATION_FILTERS;

const AMOUNT_FIELDS: (keyof DonationFilterState)[] = ['amountMin', 'amountMax'];
const CONTACT_FIELDS: (keyof DonationFilterState)[] = ['city', 'country'];
const ADVANCED_FIELDS: (keyof DonationFilterState)[] = [
  'amountMin', 'amountMax', 'source', 'category', 'city', 'country',
  'createdFrom', 'createdTo', 'hasReceipt', 'hasFile', 'hasNotes',
];

const isFieldActive = (v: string | string[]) => (Array.isArray(v) ? v.length > 0 : v.trim() !== '' && v !== 'all');

type Options = {
  donations: Donation[];
  donorMap: Map<string, Donor>;
  getDonorName: (donorId: string | null) => string;
  donationHasDocuments: (donation: Donation) => boolean;
  /** בלי הרשאה לראות סכומים – לא מחפשים, מסננים או ממיינים לפי סכום */
  canViewAmount: boolean;
  /** בלי הרשאה לראות פרטי התקשרות – לא מחפשים לפי טלפון ולא מסננים לפי עיר/מדינה */
  canViewContact: boolean;
};

const time = (value: string | null) => new Date(value || 0).getTime();
const sourceOf = (d: Donation) => d.external_source || 'manual';

/** כל מצב הסינון והמיון של רשימת התרומות, והתוצאות המחושבות */
export function useDonationFilters({
  donations,
  donorMap,
  getDonorName,
  donationHasDocuments,
  canViewAmount,
  canViewContact,
}: Options) {
  const [filters, setFilter, clearAll] = usePersistentObject('donations.filters', DEFAULT_DONATION_FILTERS);
  // ברירת מחדל: לפי תאריך יצירת הרשומה, חדש → ישן
  const [donationSort, setDonationSort] = usePersistentState<DonationSort>('donations.sort', 'created_desc', DONATION_SORTS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // האפשרויות לכל תיבת בחירה, עם מספר התרומות לכל ערך
  const options = useMemo(
    () => ({
      donor: buildOptions(donations, (d) => [d.donor_id], (id) => getDonorName(id)),
      method: buildOptions(donations, (d) => [d.payment_method], (m) => getPaymentMethodLabel(m)),
      currency: buildOptions(donations, (d) => [d.currency || 'ILS']),
      source: buildOptions(donations, (d) => [sourceOf(d)], (s) => SOURCE_LABELS[s] ?? s),
      category: buildOptions(donations, (d) => [d.category]),
      city: buildOptions(donations, (d) => [d.donor_id ? donorMap.get(d.donor_id)?.city : null]),
      country: buildOptions(donations, (d) => [d.donor_id ? donorMap.get(d.donor_id)?.country : null]),
    }),
    [donations, donorMap, getDonorName]
  );

  // כמה תרומות מכל סוג (למתג הוראות קבע)
  const kindCounts = useMemo(() => {
    const recurring = donations.filter(isRecurringDonation).length;
    return { all: donations.length, recurring, regular: donations.length - recurring };
  }, [donations]);

  const filteredDonations = useMemo(() => {
    const f = filters;
    const query = f.search.trim().toLowerCase();

    const result = donations.filter((donation) => {
      const donor = donation.donor_id ? donorMap.get(donation.donor_id) : undefined;

      if (query) {
        const fields = [
          getDonorName(donation.donor_id),
          canViewContact ? `${donor?.phone_1 || ''} ${donor?.phone_2 || ''}` : '',
          donation.receipt_number || '',
          donation.notes || '',
          donation.payment_method || '',
          getPaymentMethodLabel(donation.payment_method),
          donation.currency || 'ILS',
          donation.category || '',
          donation.external_id || '',
          canViewAmount ? String(donation.amount) : '',
        ];
        if (!fields.some((field) => field.toLowerCase().includes(query))) return false;
      }

      if (f.kind === 'recurring' && !isRecurringDonation(donation)) return false;
      if (f.kind === 'regular' && isRecurringDonation(donation)) return false;

      if (!matchesTokens(f.donor, [donation.donor_id])) return false;
      if (!matchesTokens(f.method, [donation.payment_method])) return false;
      if (!matchesTokens(f.currency, [donation.currency || 'ILS'])) return false;
      if (!matchesTokens(f.source, [sourceOf(donation)])) return false;
      if (!matchesTokens(f.category, [donation.category])) return false;
      if (canViewContact) {
        if (!matchesTokens(f.city, [donor?.city])) return false;
        if (!matchesTokens(f.country, [donor?.country])) return false;
      }

      if (canViewAmount && !inNumberRange(Number(donation.amount), f.amountMin, f.amountMax)) return false;
      if (!inDateRange(donation.donation_date, f.dateFrom, f.dateTo)) return false;
      if (!inDateRange(donation.created_at, f.createdFrom, f.createdTo)) return false;

      if (!matchesYesNo(f.hasReceipt, !!donation.receipt_number?.trim())) return false;
      if (!matchesYesNo(f.hasFile, donationHasDocuments(donation))) return false;
      if (!matchesYesNo(f.hasNotes, !!donation.notes?.trim())) return false;

      return true;
    });

    const sort =
      !canViewAmount && (donationSort === 'amount_asc' || donationSort === 'amount_desc')
        ? 'created_desc'
        : donationSort;

    result.sort((a, b) => {
      switch (sort) {
        case 'created_asc':
          return time(a.created_at) - time(b.created_at);
        case 'date_asc':
          return time(a.donation_date) - time(b.donation_date);
        case 'date_desc':
          return time(b.donation_date) - time(a.donation_date);
        case 'amount_desc':
          return Number(b.amount) - Number(a.amount);
        case 'amount_asc':
          return Number(a.amount) - Number(b.amount);
        case 'donor_asc':
          return getDonorName(a.donor_id).localeCompare(getDonorName(b.donor_id), 'he');
        case 'donor_desc':
          return getDonorName(b.donor_id).localeCompare(getDonorName(a.donor_id), 'he');
        case 'created_desc':
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });

    return result;
  }, [
    donations,
    donorMap,
    getDonorName,
    donationHasDocuments,
    canViewAmount,
    canViewContact,
    filters,
    donationSort,
  ]);

  // סכומים לפי מטבע – לא מחברים מטבעות שונים
  const filteredDonationTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const d of filteredDonations) {
      const currency = d.currency || 'ILS';
      totals[currency] = (totals[currency] || 0) + Number(d.amount || 0);
    }
    return totals;
  }, [filteredDonations]);

  const filteredDonationDonorCount = useMemo(
    () => new Set(filteredDonations.map((d) => d.donor_id).filter(Boolean)).size,
    [filteredDonations]
  );

  // שדות בלי הרשאה לא נחשבים (הם גם לא מופעלים בסינון)
  const allowedField = (k: keyof DonationFilterState) =>
    (canViewAmount || !AMOUNT_FIELDS.includes(k)) && (canViewContact || !CONTACT_FIELDS.includes(k));
  const countActive = (fields: (keyof DonationFilterState)[]) =>
    fields.filter((k) => allowedField(k) && isFieldActive(filters[k])).length;

  const hasActiveDonationFilters = countActive(Object.keys(DEFAULT_DONATION_FILTERS) as (keyof DonationFilterState)[]) > 0;
  const advancedActiveCount = countActive(ADVANCED_FIELDS);

  return {
    filters,
    setFilter,
    options,
    kindCounts,
    showAdvanced,
    setShowAdvanced,
    advancedActiveCount,
    donationSort,
    setDonationSort,
    filteredDonations,
    filteredDonationTotals,
    filteredDonationDonorCount,
    hasActiveDonationFilters,
    clearDonationFilters: clearAll,
  };
}

export type DonationFilters = ReturnType<typeof useDonationFilters>;
