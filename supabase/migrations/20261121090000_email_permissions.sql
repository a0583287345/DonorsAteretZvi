-- =====================================================================
-- מיילים בלשונית התזכורות + הרשאות נפרדות
--   emails_view    – צפייה בתור המיילים ובהיסטוריה
--   emails_approve – אישור / דחייה / שליחה חוזרת והרצת הבדיקה היומית
-- manage_users ממשיך לקבל גישה מלאה (פאנל הניהול).
-- ניתנות אוטומטית לתפקידים עם manage_users.
--
-- וגם: תזכורות אוטומטיות קיימות (יום הולדת / יארצייט) שעדיין בהגדרות
-- ברירת המחדל הישנות (בלי שום מייל) → מייל למנהל + הודעה לתורם.
-- =====================================================================

drop policy if exists email_outbox_select on public.email_outbox;
create policy email_outbox_select on public.email_outbox for select to authenticated
  using ((select public.has_permission('manage_users')) or (select public.has_permission('emails_view')));

drop policy if exists email_outbox_update on public.email_outbox;
create policy email_outbox_update on public.email_outbox for update to authenticated
  using ((select public.has_permission('manage_users')) or (select public.has_permission('emails_approve')))
  with check ((select public.has_permission('manage_users')) or (select public.has_permission('emails_approve')));

update public.roles
set permissions = permissions || '{"emails_view": true, "emails_approve": true}'::jsonb
where jsonb_typeof(permissions) = 'object'
  and (permissions ->> 'manage_users') = 'true'
  and not (permissions ? 'emails_view');

update public.reminders
set notify_email = true,
    donor_message_type = case when source = 'donor_yahrzeit' then 'memorial' else 'birthday' end
where source in ('donor_birthday_gregorian', 'donor_birthday_hebrew', 'donor_yahrzeit')
  and coalesce(notify_email, false) = false
  and donor_message_type = 'none';
