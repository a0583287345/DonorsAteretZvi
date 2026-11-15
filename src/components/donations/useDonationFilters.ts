import { useMemo, useState } from 'react';
import type { Donation, Donor } from '@/types/donor';
import { getPaymentMethodLabel, type DonationSort, type YesNoAll } from './donationUtils';

type Options = {
  donations: Donation[];
  donorMap: Map<string, Donor>;
  getDonorName: (donorId: string | null) => string;
  donationHasDocuments: (donation: Donation) => boolean;
  /** בלי הרשאה לראות סכומים – לא מחפשים, מסננים או ממיינים לפי סכום */
  canViewAmount: boolean;
  /** בלי הרשאה לראות פרטי התקשרות – לא מחפשים לפי טלפון */
  canViewContact: boolean;
};

const time = (value: string | null) => new Date(value || 0).getTime();

/** כל מצב הסינון והמיון של רשימת התרומות, והתוצאות המחושבות */
export function useDonationFilters({
  donations,
  donorMap,
  getDonorName,
  donationHasDocuments,
  canViewAmount,
  canViewContact,
}: Options) {
  const [donationSearch, setDonationSearch] = useState('');
  const [donationCurrency, setDonationCurrency] = useState('all');
  const [donationPaymentMethod, setDonationPaymentMethod] = useState('all');
  const [donationDonorId, setDonationDonorId] = useState('all');
  const [donationMinAmount, setDonationMinAmount] = useState('');
  const [donationMaxAmount, setDonationMaxAmount] = useState('');
  const [donationDateFrom, setDonationDateFrom] = useState('');
  const [donationDateTo, setDonationDateTo] = useState('');
  const [donationHasReceipt, setDonationHasReceipt] = useState<YesNoAll>('all');
  const [donationHasFile, setDonationHasFile] = useState<YesNoAll>('all');
  const [donationHasNotes, setDonationHasNotes] = useState<YesNoAll>('all');
  // ברירת מחדל: לפי תאריך יצירת הרשומה, חדש → ישן
  const [donationSort, setDonationSort] = useState<DonationSort>('created_desc');
  const [showAdvancedDonationFilters, setShowAdvancedDonationFilters] = useState(false);

  const donationCurrencies = useMemo(
    () => Array.from(new Set(donations.map((d) => d.currency || 'ILS'))).sort(),
    [donations]
  );

  const donationPaymentMethods = useMemo(
    () =>
      Array.from(
        new Set(donations.map((d) => d.payment_method).filter(Boolean) as string[])
      ).sort(),
    [donations]
  );

  const filteredDonations = useMemo(() => {
    const query = donationSearch.trim().toLowerCase();
    const minAmount = canViewAmount && donationMinAmount !== '' ? Number(donationMinAmount) : null;
    const maxAmount = canViewAmount && donationMaxAmount !== '' ? Number(donationMaxAmount) : null;

    const matchesYesNo = (filter: YesNoAll, value: boolean) =>
      filter === 'all' || (filter === 'yes') === value;

    const result = donations.filter((donation) => {
      if (query) {
        const donor = donation.donor_id ? donorMap.get(donation.donor_id) : null;
        const fields = [
          getDonorName(donation.donor_id),
          canViewContact ? `${donor?.phone_1 || ''} ${donor?.phone_2 || ''}` : '',
          donation.receipt_number || '',
          donation.notes || '',
          donation.payment_method || '',
          getPaymentMethodLabel(donation.payment_method),
          donation.currency || 'ILS',
          canViewAmount ? String(donation.amount) : '',
        ];
        if (!fields.some((field) => field.toLowerCase().includes(query))) return false;
      }

      if (donationCurrency !== 'all' && (donation.currency || 'ILS') !== donationCurrency) return false;
      if (donationPaymentMethod !== 'all' && (donation.payment_method || '') !== donationPaymentMethod) return false;
      if (donationDonorId !== 'all' && donation.donor_id !== donationDonorId) return false;

      if (minAmount !== null && Number.isFinite(minAmount) && Number(donation.amount) < minAmount) return false;
      if (maxAmount !== null && Number.isFinite(maxAmount) && Number(donation.amount) > maxAmount) return false;

      const donationDate = donation.donation_date?.slice(0, 10);
      if (donationDateFrom && (!donationDate || donationDate < donationDateFrom)) return false;
      if (donationDateTo && (!donationDate || donationDate > donationDateTo)) return false;

      if (!matchesYesNo(donationHasReceipt, !!donation.receipt_number?.trim())) return false;
      if (!matchesYesNo(donationHasFile, donationHasDocuments(donation))) return false;
      if (!matchesYesNo(donationHasNotes, !!donation.notes?.trim())) return false;

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
    donationSearch,
    donationCurrency,
    donationPaymentMethod,
    donationDonorId,
    donationMinAmount,
    donationMaxAmount,
    donationDateFrom,
    donationDateTo,
    donationHasReceipt,
    donationHasFile,
    donationHasNotes,
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

  function clearDonationFilters() {
    setDonationSearch('');
    setDonationCurrency('all');
    setDonationPaymentMethod('all');
    setDonationDonorId('all');
    setDonationMinAmount('');
    setDonationMaxAmount('');
    setDonationDateFrom('');
    setDonationDateTo('');
    setDonationHasReceipt('all');
    setDonationHasFile('all');
    setDonationHasNotes('all');
    setDonationSort('created_desc');
  }

  const hasActiveDonationFilters =
    donationSearch !== '' ||
    donationCurrency !== 'all' ||
    donationPaymentMethod !== 'all' ||
    donationDonorId !== 'all' ||
    donationMinAmount !== '' ||
    donationMaxAmount !== '' ||
    donationDateFrom !== '' ||
    donationDateTo !== '' ||
    donationHasReceipt !== 'all' ||
    donationHasFile !== 'all' ||
    donationHasNotes !== 'all';

  return {
    donationSearch, setDonationSearch,
    donationCurrency, setDonationCurrency,
    donationPaymentMethod, setDonationPaymentMethod,
    donationDonorId, setDonationDonorId,
    donationMinAmount, setDonationMinAmount,
    donationMaxAmount, setDonationMaxAmount,
    donationDateFrom, setDonationDateFrom,
    donationDateTo, setDonationDateTo,
    donationHasReceipt, setDonationHasReceipt,
    donationHasFile, setDonationHasFile,
    donationHasNotes, setDonationHasNotes,
    donationSort, setDonationSort,
    showAdvancedDonationFilters, setShowAdvancedDonationFilters,
    donationCurrencies,
    donationPaymentMethods,
    filteredDonations,
    filteredDonationTotals,
    filteredDonationDonorCount,
    hasActiveDonationFilters,
    clearDonationFilters,
  };
}

export type DonationFilters = ReturnType<typeof useDonationFilters>;
