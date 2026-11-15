-- לכל הרשאה שאסורה לתפקיד: איך להציג אותה למשתמש
--   'locked' = הכפתור מוצג חסום ובלחיצה מופיעה הודעת "אין הרשאה"
--   חסר / 'hidden' = הכפתור לא מוצג בכלל (ברירת המחדל, כמו קודם)
-- זו העדפת תצוגה בלבד – האכיפה האמיתית נשארת ב-RLS לפי roles.permissions.
alter table public.roles
  add column if not exists denied_display jsonb not null default '{}'::jsonb;

alter table public.roles
  drop constraint if exists roles_denied_display_is_object;
alter table public.roles
  add constraint roles_denied_display_is_object check (jsonb_typeof(denied_display) = 'object');
