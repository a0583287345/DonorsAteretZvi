# תוכנית שדרוג – סטטוס

עודכן לאחרונה: 2026-11-15

## ✅ הושלם
- **RLS על כל הטבלאות** לפי הרשאות התפקיד (`supabase/migrations/20261114205754_rls_permissions.sql`).
  נבדק: כל תפקיד רואה רק מה שמותר לו, משתמש לא יכול להפוך את עצמו למנהל, anon חסום.
- **קבצים פרטיים** – `src/lib/storage.ts` + buckets פרטיים (`20261114220000_private_buckets.sql`).
  נבדק: קישורים ציבוריים ישנים מחזירים 400.
- **שלב 1 – השלמת אבטחה** (בפרודקשן מ-2026-11-15):
  `src/proxy.ts` מגן על כל הדפים חוץ מ-`/login` בצד השרת (session ב-cookies דרך `@supabase/ssr`);
  `api/admin/users` – הרשאה רק לפי `manage_users`, בדיקת קלט, רישום ל-audit_logs.

## ⏳ ממתין למשתמש
- [ ] להפעיל **Leaked password protection** ב-Supabase (Authentication → Password security)
- [ ] לבדוק בפרודקשן פתיחת קובץ מתרומה ומתזכורת
- [ ] לעבור על ההרשאות של התפקיד "צופה" (כרגע יכול ליצור ולמחוק תורמים ותרומות)
- [ ] לבדוק בפרודקשן: יצירת משתמש ואיפוס סיסמה (שלב 1)

## 🔜 שלב 2 – ייצוב קוד (branch `stage2-cleanup`, ממתין לבדיקה ואישור)
- [x] מקור הרשאות אחד: `AuthContext` (`Protect`/`usePermissions` קוראים ממנו)
- [x] **פיצ'ר חדש: מותר / חסום / מוסתר לכל הרשאה בכל תפקיד** (`roles.denied_display`,
  מיגרציה `20261115120000_roles_denied_display.sql` – כבר הופעלה, תואמת לקוד הישן)
- [x] רכיב toast (`src/components/Toaster.tsx`) במקום 36 קריאות `alert()`
- [x] אכיפה ב-UI שהייתה חסרה: כפתורי הוספת תורם/תרומה, פרטי התקשרות ברשימת התורמים ובייצוא,
  סכומים ברשימת התרומות ובייצוא, עריכת פרטי התקשרות (`donors_edit_contact`) בטופס תורם
- [x] רישום ליומן: שינוי תפקיד/שם משתמש, שמירת תפקיד
- [x] `any` (15 → 0), `console.log` דיבאג (→ 0), `src/types/database.ts` נוצר ממסד הנתונים
- [x] `lang="he" dir="rtl"`, metadata, README
- [~] lint: 50 → 10. הנותרים – אפקטים לאיפוס טפסים ב-`DonationFormModal`, `DonorFormModal`,
  `RemindersTab`, `page.tsx` – יטופלו בפיצול הקבצים בשלב 3
- [ ] חיבור `Database` ל-`createBrowserClient<Database>` (יחשוף אי-התאמות טיפוסים – לעשות בשלב 3)

## שלב 3 – ביצועים וסדר
- [ ] פיצול `DonationsTab` / `DonorFormModal` / `DonorsTab` (+ 10 שגיאות lint שנותרו)
- [ ] עימוד וחיפוש בצד השרת, סכומים לפי מטבע ב-RPC
- [ ] אכיפת `donations_view_amount` ו-`donors_view_contact` במסד (view). כרגע רק ב-UI –
  גם מיון/חיפוש לפי סכום עדיין עובד למי שאין לו הרשאה לראות סכומים
- [ ] ברשימת התרומות מוצגים רק 2 מטבעות ראשונים בסיכום (`slice(0,1)`, `slice(1,2)`)

## שלב 4 – פיצ'רים (לבחירה)
- [ ] תזכורות במייל (Vercel Cron + nodemailer, שדות `notify_email`/`email_sent` קיימים)
- [ ] תאריכים עבריים + התראות (`@hebcal/core`)
- [ ] דשבורד סטטיסטיקות, קבלות PDF, ייבוא מאקסל

## שלב 5 – איכות
- [ ] GitHub Action: lint + build על כל push
- [ ] בדיקות (Vitest / Playwright)

## הערות
- ביטול חירום של מיגרציית ה-RLS: לשחזר מדיניות קודמת (המצב הקודם היה ללא RLS – לא מומלץ).
- סדר בטוח לשינויים ששוברים תאימות: לפרוס קוד → לבדוק → להפעיל מיגרציה.
- `Donor` בקוד כולל `yissachar_zevulun_with` ו-`special_dates` שלא קיימים במסד (רק קריאה, לא נשמרים).
- כתובת המאגר ב-GitHub השתנתה (GitHub מפנה אוטומטית) – לעדכן `git remote` לכתובת החדשה.
