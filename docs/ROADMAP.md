# תוכנית שדרוג – סטטוס

עודכן לאחרונה: 2026-11-14

## ✅ הושלם
- **RLS על כל הטבלאות** לפי הרשאות התפקיד (`supabase/migrations/20261114205754_rls_permissions.sql`).
  נבדק: כל תפקיד רואה רק מה שמותר לו, משתמש לא יכול להפוך את עצמו למנהל, anon חסום.
- **קבצים פרטיים** – `src/lib/storage.ts` + buckets פרטיים (`20261114220000_private_buckets.sql`).
  נבדק: קישורים ציבוריים ישנים מחזירים 400.
- **CLAUDE.md** מעודכן ומיגרציות בגיט.

## ⏳ ממתין למשתמש
- [ ] להפעיל **Leaked password protection** ב-Supabase (Authentication → Password security)
- [ ] לבדוק בפרודקשן פתיחת קובץ מתרומה ומתזכורת
- [ ] לעבור על ההרשאות של התפקיד "צופה" (כרגע יכול ליצור ולמחוק תורמים ותרומות)

## 🔜 שלב 1 – השלמת אבטחה (branch `security-proxy`, ממתין לאישור merge)
- [x] `src/proxy.ts` עם `@supabase/ssr` שמגן על כל הדפים חוץ מ-`/login` בצד השרת.
  הלקוח בדפדפן (`src/lib/supabase.ts`) עבר ל-`createBrowserClient` – ה-session נשמר ב-cookies.
  נבדק מקומית: `/` ו-`/admin` בלי התחברות → 307 ל-`/login`.
  ⚠️ אחרי הפריסה כל המשתמשים יצטרכו להתחבר מחדש פעם אחת.
- [x] `api/admin/users`: הרשאה רק לפי `manage_users`, בדיקת קלט (אימייל, סיסמה ≥ 6, UUID), רישום ל-audit_logs
- [ ] לבדוק בפרודקשן: התחברות, התנתקות, יצירת משתמש ואיפוס סיסמה

## שלב 2 – ייצוב קוד
- [ ] מקור הרשאות אחד: `AuthContext` (ש-`Protect`/`usePermissions` יקראו ממנו)
- [ ] רכיב toast במקום 35 קריאות `alert()`
- [ ] שגיאות lint (46), `any` (15), `console.log` דיבאג, טיפוסים עם `supabase gen types`
- [ ] `lang="he"`, metadata, README

## שלב 3 – ביצועים וסדר
- [ ] פיצול `DonationsTab` / `DonorFormModal` / `DonorsTab`
- [ ] עימוד וחיפוש בצד השרת, סכומים לפי מטבע ב-RPC
- [ ] אכיפת `donations_view_amount` במסד (view)

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
