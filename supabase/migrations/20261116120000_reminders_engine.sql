-- =====================================================================
-- שלב 4א: מנוע תזכורות – תאריך עברי/לועזי, חזרתיות כמו ביומן, דחייה,
-- תזכורות אוטומטיות מכרטיס התורם, והכנה למיילים.
-- תואם לקוד הקיים: רק עמודות חדשות עם ברירות מחדל. העמודות הישנות נשארות.
-- =====================================================================

-- ---------- reminders ----------
alter table public.reminders
  -- סוג התאריך: לועזי או עברי. gregorian_date נשאר תאריך ההתחלה (המופע הראשון)
  add column if not exists date_type text not null default 'gregorian',
  add column if not exists hebrew_day smallint,
  add column if not exists hebrew_month smallint,   -- לפי hebcal: ניסן=1 ... אדר ב'=13
  add column if not exists hebrew_year integer,
  -- חזרתיות: כל repeat_interval יחידות repeat_unit
  add column if not exists repeat_unit text not null default 'none',
  add column if not exists repeat_interval integer not null default 1,
  add column if not exists repeat_end_type text not null default 'never',
  add column if not exists repeat_until date,
  add column if not exists repeat_count integer,
  -- כמה ימים לפני המופע התזכורת מופיעה כ"פעילה" (ונשלח מייל למנהל)
  add column if not exists lead_days integer not null default 0,
  -- מופעים עד התאריך הזה (כולל) סומנו כבוצעו
  add column if not exists completed_through date,
  -- המופע הנוכחי נדחה לתאריך הזה
  add column if not exists snoozed_until date,
  -- manual / donor_birthday_gregorian / donor_birthday_hebrew / donor_yahrzeit
  add column if not exists source text not null default 'manual',
  -- הודעה לתורם: none / birthday / memorial / custom (נכנסת לתור אישור)
  add column if not exists donor_message_type text not null default 'none',
  add column if not exists donor_message_custom text;

alter table public.reminders drop constraint if exists reminders_date_type_check;
alter table public.reminders add constraint reminders_date_type_check
  check (date_type in ('gregorian', 'hebrew'));

alter table public.reminders drop constraint if exists reminders_hebrew_fields_check;
alter table public.reminders add constraint reminders_hebrew_fields_check
  check (date_type <> 'hebrew' or (hebrew_day between 1 and 30 and hebrew_month between 1 and 13));

alter table public.reminders drop constraint if exists reminders_repeat_unit_check;
alter table public.reminders add constraint reminders_repeat_unit_check
  check (repeat_unit in ('none', 'day', 'week', 'month', 'year'));

alter table public.reminders drop constraint if exists reminders_repeat_interval_check;
alter table public.reminders add constraint reminders_repeat_interval_check
  check (repeat_interval between 1 and 1000);

alter table public.reminders drop constraint if exists reminders_repeat_end_check;
alter table public.reminders add constraint reminders_repeat_end_check
  check (
    (repeat_end_type = 'never')
    or (repeat_end_type = 'until' and repeat_until is not null)
    or (repeat_end_type = 'count' and repeat_count >= 1)
  );

alter table public.reminders drop constraint if exists reminders_lead_days_check;
alter table public.reminders add constraint reminders_lead_days_check
  check (lead_days between 0 and 365);

alter table public.reminders drop constraint if exists reminders_source_check;
alter table public.reminders add constraint reminders_source_check
  check (source in ('manual', 'donor_birthday_gregorian', 'donor_birthday_hebrew', 'donor_yahrzeit'));

alter table public.reminders drop constraint if exists reminders_donor_message_check;
alter table public.reminders add constraint reminders_donor_message_check
  check (donor_message_type in ('none', 'birthday', 'memorial', 'custom'));

-- תזכורת אוטומטית אחת לכל סוג לכל תורם
create unique index if not exists reminders_donor_source_unique
  on public.reminders (donor_id, source)
  where source <> 'manual';

create index if not exists reminders_donor_id_idx on public.reminders (donor_id);

-- העברת הנתונים הקיימים למבנה החדש
update public.reminders
set repeat_unit = case recurring_type
                    when 'yearly' then 'year'
                    when 'monthly' then 'month'
                    when 'weekly' then 'week'
                    else 'none'
                  end
where is_recurring is true and repeat_unit = 'none';

update public.reminders
set completed_through = gregorian_date
where is_completed is true and coalesce(is_recurring, false) = false and completed_through is null;

-- ---------- donors ----------
alter table public.donors
  add column if not exists birthday_after_sunset boolean not null default false,
  -- יארצייט: תאריך עברי בלבד (יום + חודש), ולעילוי נשמת מי
  add column if not exists yahrzeit_hebrew_day smallint,
  add column if not exists yahrzeit_hebrew_month smallint,
  add column if not exists yahrzeit_of text;

alter table public.donors drop constraint if exists donors_yahrzeit_hebrew_check;
alter table public.donors add constraint donors_yahrzeit_hebrew_check
  check (
    (yahrzeit_hebrew_day is null and yahrzeit_hebrew_month is null)
    or (yahrzeit_hebrew_day between 1 and 30 and yahrzeit_hebrew_month between 1 and 13)
  );
