-- =====================================================================
-- הפיכת ה-buckets לפרטיים.
-- להפעיל רק אחרי שהקוד עם createSignedUrl (src/lib/storage.ts) עלה לפרודקשן,
-- אחרת קישורי הקבצים במערכת הישנה יפסיקו לעבוד.
-- הגישה לקבצים נאכפת ע"י המדיניות attachments_select / reminder_docs_select
-- (documents_view / reminders_view) שהוגדרה ב-20261114205754_rls_permissions.sql
-- =====================================================================
update storage.buckets
set public = false
where id in ('attachments', 'reminder_docs', 'reminders_files');
