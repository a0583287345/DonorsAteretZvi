-- =====================================================================
-- אבטחת מסד הנתונים: RLS לפי הרשאות התפקיד (roles.permissions)
-- =====================================================================

-- ---------- פונקציות עזר ----------
create or replace function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case jsonb_typeof(r.permissions)
             when 'object' then (r.permissions ->> p) = 'true'
             when 'array'  then r.permissions ? p
             else false
           end
    from public.user_profiles u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
  ), false);
$$;

create or replace function public.my_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select role_id from public.user_profiles where id = auth.uid();
$$;

revoke all on function public.has_permission(text) from public, anon;
revoke all on function public.my_role_id() from public, anon;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.my_role_id() to authenticated;

-- ---------- ניקוי פונקציות ישנות ----------
drop function if exists public.is_admin();   -- הפנתה לטבלה user_roles שלא קיימת
alter function public.handle_new_user() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- חסימת גישה ללא התחברות ----------
revoke all on all tables in schema public from anon;

-- ---------- donors ----------
alter table public.donors enable row level security;
create policy donors_select on public.donors for select to authenticated
  using ((select public.has_permission('donors_view')));
create policy donors_insert on public.donors for insert to authenticated
  with check ((select public.has_permission('donors_create')));
create policy donors_update on public.donors for update to authenticated
  using ((select public.has_permission('donors_edit')) or (select public.has_permission('donors_edit_contact')))
  with check ((select public.has_permission('donors_edit')) or (select public.has_permission('donors_edit_contact')));
create policy donors_delete on public.donors for delete to authenticated
  using ((select public.has_permission('donors_delete')));

-- ---------- donations ----------
alter table public.donations enable row level security;
create policy donations_select on public.donations for select to authenticated
  using ((select public.has_permission('donations_view')));
create policy donations_insert on public.donations for insert to authenticated
  with check ((select public.has_permission('donations_create')));
create policy donations_update on public.donations for update to authenticated
  using ((select public.has_permission('donations_edit')))
  with check ((select public.has_permission('donations_edit')));
create policy donations_delete on public.donations for delete to authenticated
  using ((select public.has_permission('donations_delete')));

-- ---------- donor_documents ----------
alter table public.donor_documents enable row level security;
create policy donor_documents_select on public.donor_documents for select to authenticated
  using ((select public.has_permission('documents_view')));
create policy donor_documents_insert on public.donor_documents for insert to authenticated
  with check ((select public.has_permission('documents_upload')));
create policy donor_documents_update on public.donor_documents for update to authenticated
  using ((select public.has_permission('documents_upload')))
  with check ((select public.has_permission('documents_upload')));
create policy donor_documents_delete on public.donor_documents for delete to authenticated
  using ((select public.has_permission('documents_delete')));

-- ---------- reminders ----------
drop policy if exists "Enable delete for authenticated users" on public.reminders;
drop policy if exists "Enable insert for authenticated users" on public.reminders;
drop policy if exists "Enable read access for authenticated users" on public.reminders;
drop policy if exists "Enable update for authenticated users" on public.reminders;
create policy reminders_select on public.reminders for select to authenticated
  using ((select public.has_permission('reminders_view')) or (select public.has_permission('manage_users')));
create policy reminders_insert on public.reminders for insert to authenticated
  with check ((select public.has_permission('reminders_create')));
create policy reminders_update on public.reminders for update to authenticated
  using ((select public.has_permission('reminders_edit')))
  with check ((select public.has_permission('reminders_edit')));
create policy reminders_delete on public.reminders for delete to authenticated
  using ((select public.has_permission('reminders_delete')));

-- ---------- user_profiles ----------
-- הוספה נעשית רק ע"י הטריגר handle_new_user / ה-API בצד השרת (service role)
alter table public.user_profiles enable row level security;
create policy user_profiles_select on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('manage_users')));
create policy user_profiles_update on public.user_profiles for update to authenticated
  using ((select public.has_permission('manage_users')))
  with check ((select public.has_permission('manage_users')));
create policy user_profiles_delete on public.user_profiles for delete to authenticated
  using ((select public.has_permission('manage_users')));

-- ---------- roles ----------
alter table public.roles enable row level security;
create policy roles_select on public.roles for select to authenticated
  using (id = (select public.my_role_id()) or (select public.has_permission('manage_users')) or (select public.has_permission('manage_roles')));
create policy roles_insert on public.roles for insert to authenticated
  with check ((select public.has_permission('manage_users')) or (select public.has_permission('manage_roles')));
create policy roles_update on public.roles for update to authenticated
  using ((select public.has_permission('manage_users')) or (select public.has_permission('manage_roles')))
  with check ((select public.has_permission('manage_users')) or (select public.has_permission('manage_roles')));
create policy roles_delete on public.roles for delete to authenticated
  using ((select public.has_permission('manage_users')) or (select public.has_permission('manage_roles')));

-- ---------- audit_logs ----------
drop policy if exists "Allow authenticated users to insert logs" on public.audit_logs;
drop policy if exists "Allow users to view logs" on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select public.has_permission('manage_users')));
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
-- אין מדיניות update/delete: היומן לא ניתן לשינוי

-- ---------- storage ----------
-- הערה: ה-buckets נשארים public כרגע כי הקוד משתמש ב-getPublicUrl.
-- הפיכה לפרטי + createSignedUrl היא שלב נפרד שדורש שינוי קוד.
drop policy if exists "Allow authenticated users to delete attachments" on storage.objects;
drop policy if exists "Allow authenticated users to upload files" on storage.objects;
drop policy if exists "Allow authenticated users to upload attachments" on storage.objects;
drop policy if exists "Allow authenticated users to update attachments" on storage.objects;
drop policy if exists "Auth Delete" on storage.objects;
drop policy if exists "Auth Insert" on storage.objects;
drop policy if exists "Auth Update" on storage.objects;
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Auth Insert for reminders_files" on storage.objects;
drop policy if exists "Public Access for reminders_files" on storage.objects;

create policy attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (select public.has_permission('documents_view')));
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (select public.has_permission('documents_upload')));
create policy attachments_update on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (select public.has_permission('documents_upload')))
  with check (bucket_id = 'attachments' and (select public.has_permission('documents_upload')));
create policy attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (select public.has_permission('documents_delete')));

create policy reminder_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'reminder_docs' and (select public.has_permission('reminders_view')));
create policy reminder_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reminder_docs' and ((select public.has_permission('reminders_create')) or (select public.has_permission('reminders_edit'))));
create policy reminder_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'reminder_docs' and (select public.has_permission('reminders_edit')))
  with check (bucket_id = 'reminder_docs' and (select public.has_permission('reminders_edit')));
create policy reminder_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reminder_docs' and (select public.has_permission('reminders_delete')));
