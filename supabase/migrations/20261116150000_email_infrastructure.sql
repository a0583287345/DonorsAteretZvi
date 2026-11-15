-- =====================================================================
-- שלב 4ה: תשתית מייל (Gmail + סיסמת אפליקציה)
--
-- email_settings – שורה אחת: חשבון Gmail, נמענים (מנהלים), תבניות. (manage_users)
-- email_secrets  – סיסמת האפליקציה. RLS בלי שום מדיניות = אין גישה מהדפדפן בכלל.
--                  רק השרת (service_role) קורא/כותב, אחרי בדיקת manage_users ב-API.
-- email_outbox   – כל מייל שהוכן: למנהל (נשלח אוטומטית) או לתורם (ממתין לאישור).
--                  אין מדיניות insert – רק השרת מוסיף.
-- =====================================================================

create table if not exists public.email_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  gmail_user text,
  from_name text not null default 'עטרת צבי אשדוד',
  manager_emails text[] not null default '{}',
  templates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.email_settings (id) values (1) on conflict (id) do nothing;

alter table public.email_settings enable row level security;

drop policy if exists email_settings_select on public.email_settings;
create policy email_settings_select on public.email_settings for select to authenticated
  using ((select public.has_permission('manage_users')));

drop policy if exists email_settings_update on public.email_settings;
create policy email_settings_update on public.email_settings for update to authenticated
  using ((select public.has_permission('manage_users')))
  with check ((select public.has_permission('manage_users')));

-- ---------------------------------------------------------------------

create table if not exists public.email_secrets (
  id smallint primary key default 1 check (id = 1),
  gmail_app_password text,
  updated_at timestamptz not null default now()
);

insert into public.email_secrets (id) values (1) on conflict (id) do nothing;

-- RLS פעיל וללא מדיניות: authenticated/anon לא יכולים לקרוא או לכתוב
alter table public.email_secrets enable row level security;

-- ---------------------------------------------------------------------

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reminder_id uuid references public.reminders (id) on delete set null,
  donor_id uuid references public.donors (id) on delete set null,
  occurrence_date date,
  -- manager = תזכורת למנהל, donor = הודעה לתורם, test = מייל בדיקה
  kind text not null check (kind in ('manager', 'donor', 'test')),
  to_email text not null,
  subject text not null,
  body text not null,
  -- pending_approval → approved → sent / failed ; rejected = נדחה ע"י מנהל
  status text not null check (status in ('pending_approval', 'approved', 'sent', 'failed', 'rejected')),
  -- לא לשלוח לפני התאריך הזה (הודעה לתורם נשלחת ביום המועד)
  send_on date not null default current_date,
  error text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  sent_at timestamptz
);

-- לא מכינים פעמיים את אותו מייל לאותו מופע
create unique index if not exists email_outbox_unique_occurrence
  on public.email_outbox (reminder_id, occurrence_date, kind, to_email)
  where reminder_id is not null;

create index if not exists email_outbox_status_idx on public.email_outbox (status, send_on);

alter table public.email_outbox enable row level security;

drop policy if exists email_outbox_select on public.email_outbox;
create policy email_outbox_select on public.email_outbox for select to authenticated
  using ((select public.has_permission('manage_users')));

drop policy if exists email_outbox_update on public.email_outbox;
create policy email_outbox_update on public.email_outbox for update to authenticated
  using ((select public.has_permission('manage_users')))
  with check ((select public.has_permission('manage_users')));
