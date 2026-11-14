@AGENTS.md
@docs/ROADMAP.md

# עטרת צבי אשדוד – מערכת ניהול תורמים

מערכת פנימית לניהול תורמים, תרומות, מסמכים ותזכורות עבור עמותת עטרת צבי.
ממשק בעברית (RTL), משתמשים מרובים עם הרשאות לפי תפקיד ויומן פעולות (audit log).
סטטוס העבודה והשלבים הבאים: `docs/ROADMAP.md` – לעדכן אותו בסוף כל שלב.

## Stack
- Next.js 16.3 (App Router) + React 19.2 + TypeScript 5
- Tailwind CSS 4 (דרך `@tailwindcss/postcss`), אייקונים: `lucide-react`
- Supabase (פרויקט `AtertZvi2`, id `ievxzfsdaszgvplyqdmh`): Auth, Postgres + RLS, Storage פרטי, Realtime Presence
- `xlsx` לייצוא לאקסל; `@hebcal/core` ו-`nodemailer` מותקנים אבל עדיין לא בשימוש
- פריסה: Vercel – כל push ל-main עולה אוטומטית לפרודקשן. פיתוח: VS Code, Windows

## פקודות
- `npm run dev` – שרת פיתוח (http://localhost:3000)
- `npm run build` – חייב לעבור לפני push ל-main
- `npm run lint` – ESLint (יש שגיאות ישנות; אסור להוסיף חדשות)

## מבנה
- `src/app/page.tsx` – הדשבורד הראשי: לשוניות תורמים/תרומות/תזכורות (`?tab=`), presence
- `src/app/login/page.tsx` – התחברות
- `src/app/admin/` – פאנל ניהול: `UsersTab`, `RolesTab`, `AuditLogTab` (דורש `manage_users`)
- `src/app/api/admin/users/route.ts` – API בצד השרת ליצירת משתמשים/איפוס סיסמה (service role)
- `src/components/` – הלשוניות, המודאלים (`*FormModal`, `*CardModal`) ו-`DonorCard`
- `src/components/AuthContext.tsx` – session + פרופיל + תפקיד (`useAuth`)
- `src/hooks/usePermissions.ts` + `src/components/Protect.tsx` – הסתרת UI לפי הרשאות
- `src/lib/supabase.ts` (דפדפן), `src/lib/supabase-admin.ts` (service role, **צד שרת בלבד**)
- `src/lib/storage.ts` – `toStorageRef` / `getFileUrl` / `openSecureFile` לקבצים פרטיים
- `src/lib/logger.ts` – `logActivity(action, table, description)` כותב ל-`audit_logs`
- `src/types/donor.ts` – `Donor`, `Donation`, `Attachment`, `SpecialDate`
- `supabase/migrations/` – כל שינוי במסד הנתונים, לפי סדר

## מסד נתונים ואבטחה
- טבלאות: `donors`, `donations`, `donor_documents`, `reminders`, `user_profiles` (id = auth.users.id, role_id),
  `roles` (name, permissions JSONB), `audit_logs`.
- **RLS פעיל על כל הטבלאות.** כל מדיניות משתמשת ב-`public.has_permission('<perm>')`, שקוראת את
  `roles.permissions` של המשתמש המחובר. `anon` חסום לגמרי.
- `user_profiles`/`roles` – כתיבה רק עם `manage_users`. `audit_logs` – הוספה בשם המשתמש עצמו בלבד, אין עריכה/מחיקה.
- Storage: ה-buckets `attachments`, `reminder_docs` **פרטיים**. במסד שומרים `"bucket/path"` (לא קישור),
  ופותחים עם `openSecureFile` (signed URL ל-10 דקות). רשומות ישנות עם קישור ציבורי מלא נתמכות.
- שינוי סכמה/מדיניות: קובץ חדש ב-`supabase/migrations/<timestamp>_<name>.sql`, מופעל עם `apply_migration`,
  ואחר כך בדיקה עם `get_advisors`. כשהשינוי שובר קוד קיים: קודם לפרוס את הקוד, ורק אחר כך להפעיל את המיגרציה.

## הרשאות (מפתחות ב-`roles.permissions`)
view_dashboard, manage_users, manage_roles,
donors_view / donors_create / donors_edit / donors_edit_contact / donors_delete / donors_export / donors_view_contact,
donations_view / donations_create / donations_edit / donations_delete / donations_export / donations_view_amount,
documents_view / documents_upload / documents_delete,
reminders_view / reminders_create / reminders_edit / reminders_delete.
הרשאה חדשה = להוסיף אותה ב-`RolesTab.tsx` + `<Protect permId>` ב-UI + **מדיניות RLS במסד**.
`donations_view_amount` נאכף כרגע רק ב-UI.

## כללים
- כל הטקסטים למשתמש בעברית, `dir="rtl"`. הערות בקוד בעברית זה בסדר.
- כל פעולה שמשנה נתונים קוראת ל-`logActivity`.
- אסור לייבא את `supabase-admin` או את `SUPABASE_SERVICE_ROLE_KEY` לקוד `'use client'`.
- לא עושים commit ל-`.env.local`.
- סכומים תמיד לפי מטבע (`currency`, ברירת מחדל ILS). לא מחברים מטבעות שונים.
- לא מוסיפים `any` חדש ולא `console.log` של דיבאג.
- שינויי קוד: עובדים ב-branch, מראים diff למשתמש, ורק אחרי אישור עושים merge ל-main ו-push.
- הודעות commit בעברית, קצרות ותיאוריות.
