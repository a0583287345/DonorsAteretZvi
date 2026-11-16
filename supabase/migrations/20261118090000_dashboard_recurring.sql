-- =====================================================================
-- שלב 5ב: דשבורד + הוראות קבע
-- רק תוספות – לא משנה ולא מוחק נתונים קיימים.
--
-- recurring_donations.start_date – תאריך החיוב הראשון (להוראות ידניות)
-- reminders.recurring_id         – קישור תזכורת להוראת קבע
-- תזכורות אוטומטיות (טריגר על recurring_donations):
--   recurring_renewal – "לחדש הוראת קבע" חודש לפני החיוב האחרון
--   recurring_failed  – "הוראת קבע נכשלה" ביום שההוראה נכשלה
-- הרשאה חדשה: dashboard_view
-- =====================================================================

alter table public.recurring_donations add column if not exists start_date date;

alter table public.reminders
  add column if not exists recurring_id uuid references public.recurring_donations (id) on delete cascade;

create unique index if not exists reminders_recurring_unique
  on public.reminders (recurring_id, source)
  where recurring_id is not null;

-- סוגי תזכורת חדשים
alter table public.reminders drop constraint if exists reminders_source_check;
alter table public.reminders add constraint reminders_source_check check (
  source in ('manual', 'donor_birthday_gregorian', 'donor_birthday_hebrew', 'donor_yahrzeit',
             'recurring_renewal', 'recurring_failed')
);

-- ---------- תאריך החיוב האחרון של הוראת קבע (null = ללא הגבלה / לא ידוע) ----------
-- ידנית: תאריך התחלה + (מספר חודשים - 1)
-- מנדרים: החיוב הבא + (חודשים שנותרו - 1)
create or replace function public.recurring_last_charge(
  p_start date, p_total integer, p_next date, p_remaining integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start is not null and p_total is not null and p_total > 0
      then (p_start + make_interval(months => p_total - 1))::date
    when p_next is not null and p_remaining is not null and p_remaining > 0
      then (p_next + make_interval(months => p_remaining - 1))::date
    else null
  end;
$$;

-- ---------- תזכורות אוטומטיות להוראות קבע ----------
create or replace function public.sync_recurring_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_last date;
  v_due date;
  v_desc text;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  select coalesce(
           nullif(trim(concat_ws(' ', d.first_name_he, d.last_name_he)), ''),
           nullif(trim(concat_ws(' ', d.first_name_en, d.last_name_en)), ''),
           'ללא שם')
    into v_name
  from public.donors d
  where d.id = new.donor_id;
  v_name := coalesce(v_name, 'ללא תורם');

  v_desc := 'הוראת קבע: ' || trim(to_char(new.amount, 'FM999999990.00')) || ' ' || new.currency || ' לחודש'
    || case when new.months_total is not null then ', ' || new.months_total || ' חודשים' else '' end
    || case when new.external_source = 'nedarim' then ' (נדרים פלוס)' else '' end;

  v_last := public.recurring_last_charge(new.start_date, new.months_total, new.next_charge_date, new.months_remaining);

  -- חידוש: חודש לפני החיוב האחרון
  if v_last is not null then
    v_due := (v_last - interval '1 month')::date;
    -- הוראה שכבר הסתיימה לפני שהכרנו אותה (ייבוא היסטוריה) – לא יוצרים תזכורת חדשה
    if new.status <> 'ended'
       or exists (select 1 from public.reminders where recurring_id = new.id and source = 'recurring_renewal') then
      insert into public.reminders (
        title, description, donor_id, recurring_id, source, date_type, gregorian_date,
        repeat_unit, repeat_interval, repeat_end_type, lead_days, notify_email, is_recurring
      ) values (
        'חידוש הוראת קבע – ' || v_name,
        v_desc || '. החיוב האחרון: ' || to_char(v_last, 'DD/MM/YYYY'),
        new.donor_id, new.id, 'recurring_renewal', 'gregorian', v_due,
        'none', 1, 'never', 0, true, false
      )
      on conflict (recurring_id, source) where recurring_id is not null do update set
        title = excluded.title,
        description = excluded.description,
        donor_id = excluded.donor_id,
        -- תאריך השתנה (הוארכה / קוצרה) → מתחילים מחדש
        is_completed = case when public.reminders.gregorian_date::date <> excluded.gregorian_date::date
                            then false else public.reminders.is_completed end,
        completed_through = case when public.reminders.gregorian_date::date <> excluded.gregorian_date::date
                                 then null else public.reminders.completed_through end,
        snoozed_until = case when public.reminders.gregorian_date::date <> excluded.gregorian_date::date
                             then null else public.reminders.snoozed_until end,
        gregorian_date = excluded.gregorian_date;
    end if;
  elsif new.status <> 'ended' then
    -- הפכה ל"ללא הגבלה" – אין מה לחדש
    delete from public.reminders where recurring_id = new.id and source = 'recurring_renewal';
  end if;

  -- נכשלה: תזכורת ביום הכישלון
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from 'failed') then
    delete from public.reminders where recurring_id = new.id and source = 'recurring_failed';
    insert into public.reminders (
      title, description, donor_id, recurring_id, source, date_type, gregorian_date,
      repeat_unit, repeat_interval, repeat_end_type, lead_days, notify_email, is_recurring
    ) values (
      'הוראת קבע נכשלה – ' || v_name,
      v_desc || '. יש ליצור קשר עם התורם לעדכון אמצעי התשלום.',
      new.donor_id, new.id, 'recurring_failed', 'gregorian', v_today,
      'none', 1, 'never', 0, true, false
    );
  elsif new.status <> 'failed' then
    -- חזרה לפעילות – תזכורת כישלון שלא טופלה כבר לא רלוונטית
    delete from public.reminders
    where recurring_id = new.id and source = 'recurring_failed' and coalesce(is_completed, false) = false;
  end if;

  -- שיוך לתורם אחר (מיזוג / שיוך מתור הבדיקה)
  update public.reminders set donor_id = new.donor_id
  where recurring_id = new.id and donor_id is distinct from new.donor_id;

  return new;
end;
$$;

drop trigger if exists recurring_donations_reminders on public.recurring_donations;
create trigger recurring_donations_reminders
  after insert or update on public.recurring_donations
  for each row execute function public.sync_recurring_reminders();

-- ---------- הרשאה חדשה: צפייה בדשבורד (לתפקידים שרואים סכומים) ----------
update public.roles
set permissions = permissions || '{"dashboard_view": true}'::jsonb
where jsonb_typeof(permissions) = 'object'
  and (permissions ->> 'donations_view_amount') = 'true'
  and not (permissions ? 'dashboard_view');
