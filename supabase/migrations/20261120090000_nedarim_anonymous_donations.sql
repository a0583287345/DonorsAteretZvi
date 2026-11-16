-- =====================================================================
-- ניקוי חד-פעמי: כרטיסי "תורם מנדרים פלוס" ריקים → תרומות ללא תורם
--
-- הייבוא מנדרים פתח כרטיס תורם לכל "תרומה ללא תורם" (אין שם/ת"ז/טלפון/מייל/כתובת).
-- כל הכרטיסים קיבלו אותו שם, ולכן כל זוג מהם הוצג ככפילות.
-- מכאן והלאה הקוד שומר תרומות כאלה עם donor_id = null.
--
-- נמחק רק כרטיס שעומד בכל התנאים:
--   * השם הוא "תורם מנדרים פלוס" (בשדה העברי או האנגלי) ואין שם משפחה
--   * אין ת"ז, טלפון, מייל, רחוב, עיר
--   * ההערה היא בדיוק ההערה האוטומטית (אף אחד לא כתב בו כלום)
--   * אין לו הוראות קבע, תזכורות, מסמכים או ימי יארצייט
-- כרטיסים עם ת"ז / טלפון (אנשים אמיתיים בלי שם) נשארים.
-- =====================================================================

begin;

create temp table empty_nedarim_donors on commit drop as
select d.id
from public.donors d
where coalesce(d.first_name_he, d.first_name_en) = 'תורם מנדרים פלוס'
  and d.last_name_he is null and d.last_name_en is null
  and d.zeout is null and d.phone_1 is null and d.phone_2 is null and d.email is null
  and d.street is null and d.city is null
  and d.notes = 'נוצר אוטומטית בייבוא מנדרים פלוס'
  and not exists (select 1 from public.recurring_donations r where r.donor_id = d.id)
  and not exists (select 1 from public.reminders r where r.donor_id = d.id)
  and not exists (select 1 from public.donor_documents r where r.donor_id = d.id)
  and not exists (select 1 from public.donor_yahrzeits r where r.donor_id = d.id);

-- קודם מנתקים את התרומות (מחיקת תורם מוחקת את התרומות שלו – cascade)
update public.donations
set donor_id = null
where donor_id in (select id from empty_nedarim_donors);

-- זוגות שסומנו "לא כפילות" עם הכרטיסים האלה
delete from public.donor_duplicate_dismissals
where donor_a in (select id from empty_nedarim_donors)
   or donor_b in (select id from empty_nedarim_donors);

delete from public.donors
where id in (select id from empty_nedarim_donors);

commit;
