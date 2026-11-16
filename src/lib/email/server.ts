// =====================================================================
// מיילים – צד שרת בלבד (Gmail עם סיסמת אפליקציה, דרך nodemailer)
// אסור לייבא את הקובץ הזה לקוד 'use client' (משתמש ב-service_role).
//
// runDailyEmails():
//   1. עובר על התזכורות ומכין מיילים לתור (email_outbox):
//      - למנהל: כשהתזכורת נעשית פעילה (X ימים לפני) → מאושר אוטומטית
//      - לתורם: מזל טוב / עילוי נשמה / חופשי → ממתין לאישור מנהל, נשלח ביום המועד
//   2. שולח את כל המיילים המאושרים שהגיע זמנם
// =====================================================================

import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Reminder } from '@/types/donor';
import type { TablesInsert } from '@/types/database';
import { reminderState } from '@/lib/reminders/recurrence';
import { formatHebrewDate } from '@/lib/reminders/hebrew';
import { formatGregorian } from '@/lib/reminders/dates';
import {
  isValidEmail,
  mergeTemplates,
  renderTemplate,
  type EmailTemplate,
  type EmailTemplates,
} from './templates';

export type EmailConfig = {
  enabled: boolean;
  gmailUser: string | null;
  password: string | null;
  fromName: string;
  managerEmails: string[];
  templates: EmailTemplates;
};

/** "היום" לפי שעון ישראל (השרת רץ ב-UTC) */
export function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const [{ data: settings }, { data: secret }] = await Promise.all([
    supabaseAdmin.from('email_settings').select('*').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('email_secrets').select('gmail_app_password').eq('id', 1).maybeSingle(),
  ]);
  return {
    enabled: !!settings?.enabled,
    gmailUser: settings?.gmail_user?.trim() || null,
    password: secret?.gmail_app_password || null,
    fromName: settings?.from_name || 'עטרת צבי אשדוד',
    managerEmails: (settings?.manager_emails ?? []).filter(isValidEmail),
    templates: mergeTemplates(settings?.templates),
  };
}

/** האם אפשר לשלוח (חשבון + סיסמה). enabled נבדק בנפרד */
export function canSend(cfg: EmailConfig): string | null {
  if (!cfg.gmailUser) return 'לא הוגדרה כתובת Gmail';
  if (!cfg.password) return 'לא הוגדרה סיסמת אפליקציה';
  return null;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendEmail(cfg: EmailConfig, to: string, subject: string, body: string) {
  const problem = canSend(cfg);
  if (problem) throw new Error(problem);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.gmailUser!, pass: cfg.password! },
  });

  try {
    await transporter.sendMail({
      from: `"${cfg.fromName.replace(/"/g, '')}" <${cfg.gmailUser}>`,
      to,
      subject,
      text: body,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</div>`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 535 = גוגל דחה את שם המשתמש / הסיסמה
    if (/535|Username and Password not accepted|BadCredentials|Invalid login/i.test(msg)) {
      throw new Error(
        'גוגל דחה את ההתחברות: יש לוודא שהכתובת היא בדיוק החשבון שבו נוצרה סיסמת האפליקציה, ' +
          'שאימות דו-שלבי פעיל בחשבון, ושהודבקה סיסמת אפליקציה (16 אותיות) ולא הסיסמה הרגילה'
      );
    }
    throw err;
  }
}

type DonorRow = { id: string; first_name_he: string | null; last_name_he: string | null; email: string | null };

/** שלב 1: הכנת מיילים לתור לפי התזכורות */
export async function queueDueEmails(cfg: EmailConfig, today: string) {
  const counts = { manager: 0, donor: 0 };

  const { data: reminders, error } = await supabaseAdmin
    .from('reminders')
    .select('*')
    .or('notify_email.eq.true,donor_message_type.neq.none');
  if (error) throw new Error(error.message);
  if (!reminders?.length) return counts;

  const donorIds = [...new Set(reminders.map((r) => r.donor_id).filter(Boolean) as string[])];
  const yahrzeitIds = [...new Set(reminders.map((r) => r.yahrzeit_id).filter(Boolean) as string[])];

  const [{ data: donors }, { data: yahrzeits }] = await Promise.all([
    donorIds.length
      ? supabaseAdmin.from('donors').select('id, first_name_he, last_name_he, email').in('id', donorIds)
      : Promise.resolve({ data: [] as DonorRow[] }),
    yahrzeitIds.length
      ? supabaseAdmin.from('donor_yahrzeits').select('id, name').in('id', yahrzeitIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
  ]);

  const donorMap = new Map((donors ?? []).map((d) => [d.id, d as DonorRow]));
  const yahrzeitNames = new Map((yahrzeits ?? []).map((y) => [y.id, y.name ?? '']));

  for (const raw of reminders) {
    const r = raw as unknown as Reminder & { yahrzeit_id: string | null };
    const state = reminderState(r, today);
    if (!state.occurrence || !state.effectiveDate || state.daysUntil === null) continue;

    // רק בחלון הפעיל: מ-X ימים לפני ועד היום עצמו
    const lead = Math.max(0, r.lead_days ?? 0);
    if (state.daysUntil < 0 || state.daysUntil > lead) continue;

    const donor = r.donor_id ? donorMap.get(r.donor_id) : undefined;
    const donorName = donor ? `${donor.first_name_he || ''} ${donor.last_name_he || ''}`.trim() : '';
    const values = {
      name: donorName || 'ללא תורם',
      title: r.title,
      hebrewDate: formatHebrewDate(state.effectiveDate),
      date: formatGregorian(state.effectiveDate),
      memorialName: (r.yahrzeit_id && yahrzeitNames.get(r.yahrzeit_id)) || '',
      description: r.description ?? '',
    };

    const rows: TablesInsert<'email_outbox'>[] = [];

    // למנהל – מאושר אוטומטית
    if (r.notify_email) {
      const t = cfg.templates.manager;
      for (const to of cfg.managerEmails) {
        rows.push({
          kind: 'manager',
          status: 'approved',
          reminder_id: r.id,
          donor_id: r.donor_id,
          occurrence_date: state.occurrence,
          to_email: to,
          subject: renderTemplate(t.subject, values),
          body: renderTemplate(t.body, values),
          send_on: today,
        });
      }
    }

    // לתורם – ממתין לאישור, נשלח ביום המועד
    const type = r.donor_message_type;
    if (type && type !== 'none' && donor?.email && isValidEmail(donor.email)) {
      let t: EmailTemplate | null = null;
      if (type === 'birthday') t = cfg.templates.birthday;
      else if (type === 'memorial') t = cfg.templates.memorial;
      else if (type === 'custom' && r.donor_message_custom?.trim()) {
        t = { subject: r.title, body: r.donor_message_custom };
      }
      if (t) {
        rows.push({
          kind: 'donor',
          status: 'pending_approval',
          reminder_id: r.id,
          donor_id: r.donor_id,
          occurrence_date: state.occurrence,
          to_email: donor.email.trim(),
          subject: renderTemplate(t.subject, values),
          body: renderTemplate(t.body, values),
          send_on: state.effectiveDate,
        });
      }
    }

    for (const row of rows) {
      const { error: e } = await supabaseAdmin.from('email_outbox').insert([row]);
      // 23505 = כבר הוכן מייל לאותו מופע – מדלגים
      if (e && e.code !== '23505') throw new Error(e.message);
      if (!e) counts[row.kind as 'manager' | 'donor'] += 1;
    }
  }

  return counts;
}

/** שלב 2: שליחת מיילים מאושרים שהגיע זמנם */
export async function sendApprovedEmails(cfg: EmailConfig, today: string) {
  const result = { sent: 0, failed: 0, waiting: 0, reason: null as string | null };

  const { data: queue, error } = await supabaseAdmin
    .from('email_outbox')
    .select('id, to_email, subject, body')
    .eq('status', 'approved')
    .lte('send_on', today)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  if (!queue?.length) return result;

  const problem = !cfg.enabled ? 'שליחת מיילים כבויה בהגדרות' : canSend(cfg);
  if (problem) {
    result.waiting = queue.length;
    result.reason = problem;
    return result;
  }

  for (const m of queue) {
    // ייתכן שבינתיים השהו / ביטלו / מחקו את המייל – בודקים שוב רגע לפני השליחה
    const { data: still } = await supabaseAdmin
      .from('email_outbox')
      .select('id')
      .eq('id', m.id)
      .eq('status', 'approved')
      .maybeSingle();
    if (!still) continue;
    try {
      await sendEmail(cfg, m.to_email, m.subject, m.body);
      await supabaseAdmin
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', m.id);
      result.sent += 1;
    } catch (err) {
      await supabaseAdmin
        .from('email_outbox')
        .update({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
        .eq('id', m.id);
      result.failed += 1;
    }
  }
  return result;
}

/** ההרצה היומית: הכנה + שליחה */
export async function runDailyEmails() {
  const today = israelToday();
  const cfg = await getEmailConfig();
  const queued = await queueDueEmails(cfg, today);
  const sending = await sendApprovedEmails(cfg, today);
  return { today, queued, ...sending };
}
