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
- `xlsx` לייצוא לאקסל; `@hebcal/core` (תאריכים עבריים), `nodemailer` (Gmail)
- פריסה: Vercel – כל push ל-main עולה אוטומטית לפרודקשן. פיתוח: VS Code, Windows

## פקודות
- `npm run dev` – שרת פיתוח (http://localhost:3000)
- `npm run build` – חייב לעבור לפני push ל-main
- `npm run lint` – ESLint (נקי: 0 שגיאות/אזהרות – לשמור על זה)

## מבנה
- `src/app/page.tsx` – המסך הראשי: לשוניות דשבורד/תורמים/תרומות/תזכורות (`?tab=`; בלי tab → דשבורד למורשים), presence
- `src/components/dashboard/` – `DashboardTab` (סיכומים, מה מחכה לי, הוראות קבע, גרפים) + `Charts.tsx` (גרפי HTML בצבע אחד)
- `src/components/recurring/` – רשימה/טופס הוראות קבע + `DonorRecurringSection` בכרטיס התורם;
  `src/lib/recurring/schedule.ts` – חישובי חיוב אחרון/נותרו/צפי (זהה ל-`recurring_last_charge` במסד)
- `src/app/login/page.tsx` – התחברות
- `src/app/admin/` – פאנל ניהול: `UsersTab`, `RolesTab`, `AuditLogTab` (דורש `manage_users`)
- `src/app/api/admin/users/route.ts` – API בצד השרת ליצירת משתמשים/איפוס סיסמה (service role)
- `src/components/` – הלשוניות, המודאלים (`*FormModal`, `*CardModal`) ו-`DonorCard`
  - `donations/` – חלקי לשונית התרומות: `useDonationFilters`, `useDonationDocuments`, `donationUtils` (תוויות, CSV), פילטרים/סיכום/טבלה
  - `donors/` – חלקי לשונית התורמים: `useDonorFilters`, `donorUtils` (ייצוא, ניווט), פילטרים/טבלה/`NavigationPicker`
  - `donors/form/` – חלקי טופס התורם + `donorFormData.ts` (המרה תורם ↔ טופס ↔ payload)
- מודאלים נטענים רק כשהם פתוחים ומקבלים `key`, לכן הטופס מאותחל מה-props ב-`useState` (לא באפקט)
- `src/proxy.ts` – בצד השרת: משתמש לא מחובר מועבר ל-`/login` (session ב-cookies דרך `@supabase/ssr`)
- `src/components/AuthContext.tsx` – **מקור יחיד** ל-session, פרופיל, תפקיד והרשאות (`useAuth`):
  `hasPermission`, `access(perm)` → `allowed`/`locked`/`hidden`, `requirePermission(perm)` (מציג הודעה אם אסור)
- `src/hooks/usePermissions.ts` – עטיפה דקה ל-`useAuth`
- `src/components/Protect.tsx` – `<Protect permId>`: מותר → מוצג; חסום → אפור עם מנעול והודעה בלחיצה
  (בהרשאת צפייה: "🔒 אין הרשאה"); מוסתר → לא מוצג. `LockedText` לטקסט חסום
- `src/lib/permissions.ts` – רשימת כל ההרשאות (id, תווית, `kind: action|view`) – מקור יחיד
- `src/components/Toaster.tsx` – הודעות: `toast.success/error/info/warning/denied`. **לא משתמשים ב-`alert()`**
- `src/lib/supabase.ts` (דפדפן, `createBrowserClient<Database>` – מוקלד), `src/lib/supabase-admin.ts` (service role, **צד שרת בלבד**)
- `src/lib/storage.ts` – `toStorageRef` / `getFileUrl` / `openSecureFile` לקבצים פרטיים
- `src/lib/reminders/` – מנוע תזכורות: `recurrence.ts` (מופעים/מצב), `hebrew.ts`, `dates.ts`, `actions.ts`, `donorAuto.ts` (תזכורות אוטומטיות + `donor_yahrzeits`)
- `src/lib/email/` – `templates.ts` (משותף), `server.ts` (**צד שרת בלבד**, Gmail/nodemailer); `src/lib/server-auth.ts` – בדיקת הרשאה ב-API
- `src/lib/import/donorMatch.ts` – נרמול טלפון/ת"ז/מייל, התאמת תורם מיובא, מציאת כפילויות (קוד טהור, דפדפן + שרת)
- `src/lib/nedarim/` – `adapter.ts` (**המקום היחיד** עם שמות השדות וה-API של נדרים פלוס, אומת מול `docs/NedarimPlus-API.md`;
  GetHistoryJson/GetKevaJson מוגבלים ל-20 פניות בשעה; Webhook אחד לעסקאות/הוראות/סירובים + חתימת HMAC),
  `importer.ts` (**צד שרת בלבד**: ייבוא עסקאות/הוראות קבע, תור "לבדיקה", `runNedarimSync`)
- API: `/api/admin/nedarim` (manage_users), `/api/nedarim/callback?key=` (נדרים שולחים עסקאות; מוגן במפתח סודי),
  `/api/import-review` (donors_merge); `src/lib/apiClient.ts` – `callServerApi` מהדפדפן עם הטוקן
- `src/components/donors/duplicates/` – חלון "בירור כפילויות" בלשונית התורמים (מיזוג = `rpc('merge_donors')`)
- `src/components/DateInput.tsx` – שדה תאריך DD/MM/YYYY. **לא משתמשים ב-`type="date"`**
- `src/lib/logger.ts` – `logActivity(action, table, description)` כותב ל-`audit_logs`
- `src/types/donor.ts` – `Donor`, `Donation`, `Attachment`, `SpecialDate`, `Reminder`
- `src/types/database.ts` – טיפוסים שנוצרו ממסד הנתונים (לייצר מחדש אחרי שינוי סכמה)
- `supabase/migrations/` – כל שינוי במסד הנתונים, לפי סדר

## מסד נתונים ואבטחה
- טבלאות: `donors` (כולל `zeout`), `donations` (כולל `external_source/external_id` – ייחודי), `donor_documents`, `donor_yahrzeits`, `reminders`, `email_settings`, `email_secrets` (רק service_role), `email_outbox`,
  `recurring_donations` (הוראות קבע), `import_review` (תור לבדיקה), `donor_duplicate_dismissals`, `integration_settings`, `integration_secrets` (רק service_role), `user_profiles` (id = auth.users.id, role_id),
  `roles` (name, permissions JSONB, denied_display JSONB), `audit_logs`.
- `roles.denied_display` = `{perm: 'locked'}` להרשאות אסורות שמוצגות חסומות; חסר = מוסתר. תצוגה בלבד, לא אבטחה.
- תזכורות הוראות קבע (`recurring_renewal` חודש לפני החיוב האחרון, `recurring_failed` ביום הכישלון) נוצרות ע"י **טריגר במסד**
  על `recurring_donations` (`sync_recurring_reminders`) – לא בקוד. `reminders.recurring_id` מקשר.
- מחיקת תורם מוחקת את התרומות שלו (cascade) – מיזוג רק דרך הפונקציה `merge_donors` (פעולה אחת שלמה).
- **RLS פעיל על כל הטבלאות.** כל מדיניות משתמשת ב-`public.has_permission('<perm>')`, שקוראת את
  `roles.permissions` של המשתמש המחובר. `anon` חסום לגמרי.
- `user_profiles`/`roles` – כתיבה רק עם `manage_users`. `audit_logs` – הוספה בשם המשתמש עצמו בלבד, אין עריכה/מחיקה.
- Storage: ה-buckets `attachments`, `reminder_docs` **פרטיים**. במסד שומרים `"bucket/path"` (לא קישור),
  ופותחים עם `openSecureFile` (signed URL ל-10 דקות). רשומות ישנות עם קישור ציבורי מלא נתמכות.
- שינוי סכמה/מדיניות: קובץ חדש ב-`supabase/migrations/<timestamp>_<name>.sql`, מופעל עם `apply_migration`,
  ואחר כך בדיקה עם `get_advisors`. כשהשינוי שובר קוד קיים: קודם לפרוס את הקוד, ורק אחר כך להפעיל את המיגרציה.

## הרשאות (מפתחות ב-`roles.permissions`)
view_dashboard, dashboard_view, manage_users, manage_roles,
donors_view / donors_create / donors_edit / donors_edit_contact / donors_delete / donors_export / donors_view_contact / donors_merge,
donations_view / donations_create / donations_edit / donations_delete / donations_export / donations_view_amount,
documents_view / documents_upload / documents_delete,
reminders_view / reminders_create / reminders_edit / reminders_delete.
הרשאה חדשה = להוסיף אותה ב-`src/lib/permissions.ts` + `<Protect permId>` ב-UI + **מדיניות RLS במסד**.
`donations_view_amount` ו-`donors_view_contact` נאכפים רק ב-UI (החלטה – לא לאכוף במסד).

## כללים
- כל הטקסטים למשתמש בעברית, `dir="rtl"`. הערות בקוד בעברית זה בסדר.
- כל פעולה שמשנה נתונים קוראת ל-`logActivity`.
- אסור לייבא את `supabase-admin` או את `SUPABASE_SERVICE_ROLE_KEY` לקוד `'use client'`.
- לא עושים commit ל-`.env.local`.
- סכומים תמיד לפי מטבע (`currency`, ברירת מחדל ILS). לא מחברים מטבעות שונים.
- לא מוסיפים `any` חדש ולא `console.log` של דיבאג.
- שינויי קוד: עובדים ב-branch, מראים diff למשתמש, ורק אחרי אישור עושים merge ל-main ו-push.
- הודעות commit בעברית, קצרות ותיאוריות.
