import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditFromServer, requirePermissionFromRequest } from '@/lib/server-auth';
import {
  getEmailConfig,
  israelToday,
  runDailyEmails,
  sendApprovedEmails,
  sendEmail,
} from '@/lib/email/server';
import { isValidEmail } from '@/lib/email/templates';

// =====================================================================
// פעולות מייל:
//   פאנל ניהול (manage_users):
//     status          – האם שמורה סיסמת אפליקציה
//     save_password   – שמירת סיסמת אפליקציה של Gmail (לא נחשפת לדפדפן לעולם)
//     clear_password  – מחיקת הסיסמה
//     test            – שליחת מייל בדיקה
//   לשונית תזכורות (emails_approve או manage_users):
//     send_approved   – שליחה מיידית של מיילים מאושרים
//     run_now         – הרצת הבדיקה היומית עכשיו (הכנה + שליחה)
// =====================================================================

const APPROVER_ACTIONS = new Set(['send_approved', 'run_now']);

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('בקשה לא תקינה');
  }
  const action = typeof body.action === 'string' ? body.action : '';

  const user = await requirePermissionFromRequest(
    request,
    APPROVER_ACTIONS.has(action) ? ['manage_users', 'emails_approve'] : 'manage_users'
  );
  if (user instanceof NextResponse) return user;

  try {
    switch (action) {
      case 'status': {
        const { data } = await supabaseAdmin.from('email_secrets').select('gmail_app_password').eq('id', 1).maybeSingle();
        return NextResponse.json({ hasPassword: !!data?.gmail_app_password });
      }

      case 'save_password': {
        // סיסמת אפליקציה של גוגל: 16 אותיות (לפעמים מוצגת עם רווחים)
        const password = typeof body.password === 'string' ? body.password.replace(/\s+/g, '') : '';
        if (!/^[a-zA-Z]{16}$/.test(password)) {
          return fail('סיסמת אפליקציה של Gmail היא 16 אותיות באנגלית (אפשר להדביק עם רווחים)');
        }
        const { error } = await supabaseAdmin
          .from('email_secrets')
          .update({ gmail_app_password: password, updated_at: new Date().toISOString() })
          .eq('id', 1);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'email_settings', 'עודכנה סיסמת האפליקציה של Gmail');
        return NextResponse.json({ success: true });
      }

      case 'clear_password': {
        const { error } = await supabaseAdmin
          .from('email_secrets')
          .update({ gmail_app_password: null, updated_at: new Date().toISOString() })
          .eq('id', 1);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'email_settings', 'נמחקה סיסמת האפליקציה של Gmail');
        return NextResponse.json({ success: true });
      }

      case 'test': {
        const to = typeof body.to === 'string' ? body.to.trim() : '';
        if (!isValidEmail(to)) return fail('כתובת מייל לא תקינה');
        const cfg = await getEmailConfig();
        const subject = 'מייל בדיקה – מערכת ניהול התורמים';
        const text = 'זהו מייל בדיקה ממערכת ניהול התורמים של עטרת צבי.\nאם קיבלת אותו – החיבור ל-Gmail עובד.';
        let status: 'sent' | 'failed' = 'sent';
        let errorText: string | null = null;
        try {
          await sendEmail(cfg, to, subject, text);
        } catch (err) {
          status = 'failed';
          errorText = err instanceof Error ? err.message : String(err);
        }
        await supabaseAdmin.from('email_outbox').insert([
          {
            kind: 'test',
            status,
            to_email: to,
            subject,
            body: text,
            send_on: israelToday(),
            error: errorText,
            sent_at: status === 'sent' ? new Date().toISOString() : null,
            decided_by: user.id,
          },
        ]);
        await auditFromServer(user, 'EMAIL_TEST', 'email_outbox', `מייל בדיקה ל-${to}: ${status === 'sent' ? 'נשלח' : 'נכשל'}`);
        if (status === 'failed') return fail(`השליחה נכשלה: ${errorText}`, 502);
        return NextResponse.json({ success: true });
      }

      case 'send_approved': {
        const result = await sendApprovedEmails(await getEmailConfig(), israelToday());
        if (result.sent || result.failed) {
          await auditFromServer(user, 'EMAIL_SEND', 'email_outbox', `נשלחו ${result.sent} מיילים, נכשלו ${result.failed}`);
        }
        return NextResponse.json(result);
      }

      case 'run_now': {
        const result = await runDailyEmails();
        await auditFromServer(
          user,
          'EMAIL_RUN',
          'email_outbox',
          `הרצת בדיקת מיילים: הוכנו ${result.queued.manager} למנהל ו-${result.queued.donor} לתורמים, נשלחו ${result.sent}`
        );
        return NextResponse.json(result);
      }

      default:
        return fail('פעולה לא חוקית');
    }
  } catch (err) {
    console.error('Email API error:', err);
    return fail(err instanceof Error ? err.message : 'שגיאת שרת', 500);
  }
}
