import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Donation } from '@/types/donor';
import type { DonationDocument } from './donationUtils';

/** טעינת המסמכים של כל התרומות ברשימה, מקובצים לפי מזהה תרומה */
export function useDonationDocuments(donations: Donation[]) {
  const [result, setResult] = useState<{
    forKey: string;
    docs: Record<string, DonationDocument[]>;
  }>({ forKey: '', docs: {} });

  const key = donations.map((d) => d.id).join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    (async () => {
      const grouped: Record<string, DonationDocument[]> = {};
      try {
        const { data, error } = await supabase
          .from('donor_documents')
          .select('id, donor_id, donation_id, file_name, file_url, file_type, created_at')
          .in('donation_id', key.split(','))
          .order('created_at', { ascending: false });

        if (error) {
          console.error('שגיאה בטעינת מסמכי תרומות:', error.message);
        } else {
          for (const doc of (data || []) as DonationDocument[]) {
            if (!doc.donation_id) continue;
            (grouped[doc.donation_id] ||= []).push(doc);
          }
        }
      } catch (error) {
        console.error('שגיאה בטעינת מסמכי תרומות:', error);
      }
      if (!cancelled) setResult({ forKey: key, docs: grouped });
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // אין תרומות – אין מסמכים; טוען – עד שהתוצאה מתאימה לרשימה הנוכחית
  const donationDocuments = useMemo(() => (key ? result.docs : {}), [key, result.docs]);
  const loadingDonationDocuments = !!key && result.forKey !== key;

  const donationHasDocuments = useCallback(
    (donation: Donation) =>
      !!donation.file_url?.trim() ||
      (donationDocuments[donation.id] || []).some((doc) => !!doc.file_url?.trim()),
    [donationDocuments]
  );

  return { donationDocuments, loadingDonationDocuments, donationHasDocuments };
}
