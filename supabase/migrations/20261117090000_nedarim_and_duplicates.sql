-- =====================================================================
-- שלב 5א: חיבור לנדרים פלוס + בירור כפילויות
-- רק תוספות – לא משנה ולא מוחק נתונים קיימים.
--
-- donors.zeout                 – ת"ז (לזיהוי תורם בייבוא)
-- donations.external_*         – מקור התרומה (nedarim) ומספר העסקה – מונע כפילויות
-- recurring_donations          – הוראות קבע (מנדרים או ידניות) – בסיס לדשבורד
-- import_review                – תור "לבדיקה": תורם מיובא שלא ברור למי הוא שייך
-- integration_settings/secrets – הגדרות נדרים פלוס (הסיסמה – רק לשרת)
-- donor_duplicate_dismissals   – זוגות תורמים שסומנו "לא כפילות"
-- הרשאה חדשה: donors_merge (בירור כפילויות ומיזוג תורמים)
-- =====================================================================

-- ---------- תורמים: ת"ז ----------
alter table public.donors add column if not exists zeout text;
create index if not exists donors_zeout_idx on public.donors (zeout) where zeout is not null;
create index if not exists donors_phone_1_idx on public.donors (phone_1) where phone_1 is not null;
create index if not exists donors_email_idx on public.donors (lower(email)) where email is not null;

-- ---------- תרומות: מקור חיצוני ----------
alter table public.donations
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists installments integer,
  add column if not exists category text,
  add column if not exists recurring_external_id text,
  add column if not exists imported_at timestamptz;

create unique index if not exists donations_external_unique
  on public.donations (external_source, external_id)
  where external_source is not null and external_id is not null;

-- ---------- הוראות קבע ----------
create table if not exists public.recurring_donations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  donor_id uuid references public.donors (id) on delete set null,
  external_source text,
  external_id text,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'ILS',
  charge_day smallint check (charge_day between 1 and 31),
  -- null = ללא הגבלה
  months_total integer,
  months_remaining integer,
  next_charge_date date,
  -- active / failed / ended / frozen
  status text not null default 'active' check (status in ('active', 'failed', 'ended', 'frozen')),
  payment_method text,
  notes text,
  last_synced_at timestamptz
);

create unique index if not exists recurring_donations_external_unique
  on public.recurring_donations (external_source, external_id)
  where external_source is not null and external_id is not null;
create index if not exists recurring_donations_donor_idx on public.recurring_donations (donor_id);

alter table public.recurring_donations enable row level security;

drop policy if exists recurring_donations_select on public.recurring_donations;
create policy recurring_donations_select on public.recurring_donations for select to authenticated
  using ((select public.has_permission('donations_view')));
drop policy if exists recurring_donations_insert on public.recurring_donations;
create policy recurring_donations_insert on public.recurring_donations for insert to authenticated
  with check ((select public.has_permission('donations_create')));
drop policy if exists recurring_donations_update on public.recurring_donations;
create policy recurring_donations_update on public.recurring_donations for update to authenticated
  using ((select public.has_permission('donations_edit')))
  with check ((select public.has_permission('donations_edit')));
drop policy if exists recurring_donations_delete on public.recurring_donations;
create policy recurring_donations_delete on public.recurring_donations for delete to authenticated
  using ((select public.has_permission('donations_delete')));

-- ---------- תור "לבדיקה" (ייבוא) ----------
create table if not exists public.import_review (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'nedarim',
  -- מזהה ייחודי של הפריט במקור (למשל מספר עסקה) – לא נכנס פעמיים לתור
  external_id text,
  -- התורם כפי שהגיע מהמקור (שם, ת"ז, טלפון, מייל, כתובת)
  incoming_donor jsonb not null,
  -- התרומה / הוראת הקבע שממתינה לשיוך
  incoming_payload jsonb,
  payload_kind text check (payload_kind in ('donation', 'recurring')),
  candidate_donor_ids uuid[] not null default '{}',
  reason text,
  status text not null default 'pending' check (status in ('pending', 'linked', 'created', 'ignored')),
  resolved_donor_id uuid references public.donors (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz
);

create unique index if not exists import_review_external_unique
  on public.import_review (source, external_id)
  where external_id is not null;
create index if not exists import_review_status_idx on public.import_review (status, created_at);

alter table public.import_review enable row level security;

drop policy if exists import_review_select on public.import_review;
create policy import_review_select on public.import_review for select to authenticated
  using ((select public.has_permission('donors_merge')));
drop policy if exists import_review_update on public.import_review;
create policy import_review_update on public.import_review for update to authenticated
  using ((select public.has_permission('donors_merge')))
  with check ((select public.has_permission('donors_merge')));

-- ---------- "לא כפילות" ----------
create table if not exists public.donor_duplicate_dismissals (
  donor_a uuid not null references public.donors (id) on delete cascade,
  donor_b uuid not null references public.donors (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (donor_a, donor_b),
  check (donor_a < donor_b)
);

alter table public.donor_duplicate_dismissals enable row level security;

drop policy if exists donor_duplicate_dismissals_select on public.donor_duplicate_dismissals;
create policy donor_duplicate_dismissals_select on public.donor_duplicate_dismissals for select to authenticated
  using ((select public.has_permission('donors_merge')));
drop policy if exists donor_duplicate_dismissals_insert on public.donor_duplicate_dismissals;
create policy donor_duplicate_dismissals_insert on public.donor_duplicate_dismissals for insert to authenticated
  with check ((select public.has_permission('donors_merge')));
drop policy if exists donor_duplicate_dismissals_delete on public.donor_duplicate_dismissals;
create policy donor_duplicate_dismissals_delete on public.donor_duplicate_dismissals for delete to authenticated
  using ((select public.has_permission('donors_merge')));

-- ---------- הגדרות חיבור (נדרים פלוס) ----------
create table if not exists public.integration_settings (
  provider text primary key check (provider in ('nedarim')),
  enabled boolean not null default false,
  mosad_id text,
  -- נקודת ההמשך בייבוא ההיסטוריה (מספר העסקה האחרון שיובא)
  last_history_id text,
  last_sync_at timestamptz,
  last_sync_result jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.integration_settings (provider) values ('nedarim') on conflict (provider) do nothing;

alter table public.integration_settings enable row level security;

drop policy if exists integration_settings_select on public.integration_settings;
create policy integration_settings_select on public.integration_settings for select to authenticated
  using ((select public.has_permission('manage_users')));
drop policy if exists integration_settings_update on public.integration_settings;
create policy integration_settings_update on public.integration_settings for update to authenticated
  using ((select public.has_permission('manage_users')))
  with check ((select public.has_permission('manage_users')));

-- סיסמת API ומפתח ה-Callback – RLS בלי מדיניות: רק השרת (service_role)
create table if not exists public.integration_secrets (
  provider text primary key check (provider in ('nedarim')),
  api_password text,
  callback_key text,
  updated_at timestamptz not null default now()
);

insert into public.integration_secrets (provider, callback_key)
values ('nedarim', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (provider) do nothing;

alter table public.integration_secrets enable row level security;

-- ---------- הרשאה חדשה לתפקידים שיש להם ניהול משתמשים ----------
update public.roles
set permissions = permissions || '{"donors_merge": true}'::jsonb
where jsonb_typeof(permissions) = 'object'
  and (permissions ->> 'manage_users') = 'true'
  and not (permissions ? 'donors_merge');

-- ---------- מיזוג תורמים (פעולה אחת שלמה: הכול עובר או כלום) ----------
-- מעביר תרומות, מסמכים, תזכורות, יארצייטים, הוראות קבע ומיילים מ-p_remove ל-p_keep,
-- משלים שדות חסרים ב-p_keep מתוך p_remove, ואז מוחק את p_remove.
-- חשוב: מחיקת תורם מוחקת את התרומות שלו (cascade) – לכן ההעברה חייבת להיות באותה פעולה.
create or replace function public.merge_donors(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.donors;
  r public.donors;
begin
  if not public.has_permission('donors_merge') then
    raise exception 'אין הרשאה למיזוג תורמים' using errcode = '42501';
  end if;
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'יש לבחור שני תורמים שונים';
  end if;

  select * into k from public.donors where id = p_keep for update;
  select * into r from public.donors where id = p_remove for update;
  if k.id is null or r.id is null then
    raise exception 'תורם לא נמצא';
  end if;

  update public.donors set
    first_name_he = coalesce(nullif(k.first_name_he, ''), r.first_name_he),
    last_name_he = coalesce(nullif(k.last_name_he, ''), r.last_name_he),
    first_name_en = coalesce(nullif(k.first_name_en, ''), r.first_name_en),
    last_name_en = coalesce(nullif(k.last_name_en, ''), r.last_name_en),
    zeout = coalesce(nullif(k.zeout, ''), r.zeout),
    phone_1 = coalesce(nullif(k.phone_1, ''), r.phone_1),
    phone_2 = case
      when coalesce(k.phone_2, '') <> '' then k.phone_2
      when coalesce(k.phone_1, '') <> '' and coalesce(r.phone_1, '') <> '' and r.phone_1 <> k.phone_1 then r.phone_1
      else r.phone_2 end,
    email = coalesce(nullif(k.email, ''), r.email),
    country = coalesce(nullif(k.country, ''), r.country),
    city = coalesce(nullif(k.city, ''), r.city),
    street = coalesce(nullif(k.street, ''), r.street),
    house_number = coalesce(nullif(k.house_number, ''), r.house_number),
    connected_contact = coalesce(nullif(k.connected_contact, ''), r.connected_contact),
    yissachar_zevulun_name = coalesce(nullif(k.yissachar_zevulun_name, ''), r.yissachar_zevulun_name),
    has_yissachar_zevulun = coalesce(k.has_yissachar_zevulun, false) or coalesce(r.has_yissachar_zevulun, false),
    is_recurring = coalesce(k.is_recurring, false) or coalesce(r.is_recurring, false),
    birthday = coalesce(k.birthday, r.birthday),
    birthday_after_sunset = case when k.birthday is null then r.birthday_after_sunset else k.birthday_after_sunset end,
    notes = case
      when coalesce(k.notes, '') = '' then r.notes
      when coalesce(r.notes, '') = '' or r.notes = k.notes then k.notes
      else k.notes || chr(10) || r.notes end
  where id = p_keep;

  -- תזכורות יום הולדת אוטומטיות: אחת לכל סוג לתורם
  delete from public.reminders x
  where x.donor_id = p_remove
    and x.source in ('donor_birthday_gregorian', 'donor_birthday_hebrew')
    and (k.birthday is not null
         or exists (select 1 from public.reminders y where y.donor_id = p_keep and y.source = x.source));

  update public.reminders set donor_id = p_keep where donor_id = p_remove;
  update public.donor_yahrzeits set donor_id = p_keep where donor_id = p_remove;
  update public.donations set donor_id = p_keep where donor_id = p_remove;
  update public.donor_documents set donor_id = p_keep where donor_id = p_remove;
  update public.recurring_donations set donor_id = p_keep where donor_id = p_remove;
  update public.email_outbox set donor_id = p_keep where donor_id = p_remove;
  update public.import_review set resolved_donor_id = p_keep where resolved_donor_id = p_remove;
  update public.import_review set candidate_donor_ids = array_remove(candidate_donor_ids, p_remove)
  where p_remove = any (candidate_donor_ids);

  delete from public.donors where id = p_remove;
end;
$$;
