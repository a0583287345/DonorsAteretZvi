-- =====================================================================
-- מחיקת הוראת קבע מיובאת (נדרים פלוס) מהמערכת
-- ההוראה ממשיכה להתקיים בנדרים, ולכן הסנכרון היומי היה מייבא אותה שוב.
-- הטריגר רושם אותה ב-import_review בסטטוס 'ignored' – והייבוא מדלג על כל פריט שכבר נמצא שם
-- (ראו alreadyInReview ב-src/lib/nedarim/importer.ts).
-- התזכורות של ההוראה נמחקות לבד (reminders.recurring_id ... on delete cascade).
-- התרומות (החיובים) שכבר נרשמו – לא נמחקות.
-- בטוח להריץ לפני או אחרי פריסת הקוד.
-- =====================================================================

create or replace function public.recurring_donations_remember_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.external_source is not null and old.external_id is not null then
    insert into public.import_review (
      source, external_id, incoming_donor, incoming_payload, payload_kind,
      reason, status, resolved_donor_id, resolved_by, resolved_at
    ) values (
      old.external_source,
      'recurring:' || old.external_id,
      '{}'::jsonb,
      to_jsonb(old),
      'recurring',
      'הוראת הקבע נמחקה ידנית מהמערכת – לא לייבא שוב',
      'ignored',
      old.donor_id,
      auth.uid(),
      now()
    )
    on conflict (source, external_id) where external_id is not null
    do update set status = 'ignored', reason = excluded.reason, resolved_at = excluded.resolved_at;
  end if;
  return old;
end;
$$;

revoke all on function public.recurring_donations_remember_deleted() from public, anon, authenticated;

drop trigger if exists recurring_donations_remember_deleted on public.recurring_donations;
create trigger recurring_donations_remember_deleted
  after delete on public.recurring_donations
  for each row execute function public.recurring_donations_remember_deleted();
