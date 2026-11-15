-- =====================================================================
-- מספר ימי יארצייט לכל תורם
-- donor_yahrzeits – רשימת יארצייטים (יום + חודש עבריים + לעילוי נשמת)
-- לכל יארצייט תזכורת אוטומטית משלה (reminders.yahrzeit_id)
-- העמודות הישנות donors.yahrzeit_hebrew_* נשארות לתאימות ומועברות לטבלה.
-- =====================================================================

create table if not exists public.donor_yahrzeits (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.donors (id) on delete cascade,
  hebrew_day smallint not null check (hebrew_day between 1 and 30),
  hebrew_month smallint not null check (hebrew_month between 1 and 13),
  -- לעילוי נשמת (שם הנפטר)
  name text,
  created_at timestamptz not null default now()
);

create index if not exists donor_yahrzeits_donor_id_idx on public.donor_yahrzeits (donor_id);

alter table public.donor_yahrzeits enable row level security;

drop policy if exists donor_yahrzeits_select on public.donor_yahrzeits;
create policy donor_yahrzeits_select on public.donor_yahrzeits for select to authenticated
  using ((select public.has_permission('donors_view')));

drop policy if exists donor_yahrzeits_insert on public.donor_yahrzeits;
create policy donor_yahrzeits_insert on public.donor_yahrzeits for insert to authenticated
  with check ((select public.has_permission('donors_create')) or (select public.has_permission('donors_edit')));

drop policy if exists donor_yahrzeits_update on public.donor_yahrzeits;
create policy donor_yahrzeits_update on public.donor_yahrzeits for update to authenticated
  using ((select public.has_permission('donors_edit')))
  with check ((select public.has_permission('donors_edit')));

drop policy if exists donor_yahrzeits_delete on public.donor_yahrzeits;
create policy donor_yahrzeits_delete on public.donor_yahrzeits for delete to authenticated
  using ((select public.has_permission('donors_edit')));

-- העברת היארצייט הבודד הקיים לטבלה
insert into public.donor_yahrzeits (donor_id, hebrew_day, hebrew_month, name)
select d.id, d.yahrzeit_hebrew_day, d.yahrzeit_hebrew_month, d.yahrzeit_of
from public.donors d
where d.yahrzeit_hebrew_day is not null
  and d.yahrzeit_hebrew_month is not null
  and not exists (select 1 from public.donor_yahrzeits y where y.donor_id = d.id);

-- קישור תזכורת ליארצייט מסוים
alter table public.reminders
  add column if not exists yahrzeit_id uuid references public.donor_yahrzeits (id) on delete cascade;

-- יום הולדת: תזכורת אחת לכל סוג לתורם. יארצייט: תזכורת אחת לכל יארצייט.
drop index if exists public.reminders_donor_source_unique;
create unique index if not exists reminders_donor_birthday_unique
  on public.reminders (donor_id, source)
  where source in ('donor_birthday_gregorian', 'donor_birthday_hebrew');
create unique index if not exists reminders_yahrzeit_unique
  on public.reminders (yahrzeit_id)
  where yahrzeit_id is not null;

update public.reminders r
set yahrzeit_id = y.id
from public.donor_yahrzeits y
where r.source = 'donor_yahrzeit' and r.yahrzeit_id is null and r.donor_id = y.donor_id;
