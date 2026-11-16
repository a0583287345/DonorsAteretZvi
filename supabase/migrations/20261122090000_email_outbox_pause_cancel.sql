-- =====================================================================
-- תור המיילים: השהיה / ביטול / מחיקה של מייל שעוד לא נשלח
--   paused    – מושהה: לא נשלח עד שממשיכים
--   cancelled – בוטל (נשאר בהיסטוריה)
--   deleted   – נמחק: מוסתר מהתצוגה. השורה נשארת כדי שהבדיקה היומית
--               לא תכין שוב את אותו מייל (האינדקס הייחודי למופע)
-- להריץ לפני פריסת הקוד (הקוד הישן לא משתמש בסטטוסים החדשים).
-- =====================================================================

alter table public.email_outbox drop constraint if exists email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check
  check (status in ('pending_approval', 'approved', 'sent', 'failed', 'rejected', 'paused', 'cancelled', 'deleted'));
