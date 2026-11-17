import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditFromServer, requirePermissionFromRequest } from '@/lib/server-auth';
import {
  NEDARIM_SOURCE,
  generateWebhookSecret,
  getWebhooks,
  setWebhook,
  setWebhookSecret,
  type WebhookType,
} from '@/lib/nedarim/adapter';
import { getNedarimConfig, runNedarimSync } from '@/lib/nedarim/importer';
import { parseManualImportOptions, runManualImport } from '@/lib/nedarim/manualImport';

// =====================================================================
// הגדרות נדרים פלוס מפאנל הניהול (דורש manage_users):
//   status         – הגדרות + האם שמורה סיסמה + מפתח ה-Callback
//   save_settings  – הפעלה/כיבוי + מספר מוסד
//   save_password  – סיסמת API (נשמרת רק בשרת, לא חוזרת לדפדפן לעולם)
//   clear_password – מחיקת הסיסמה
//   new_key        – מפתח Callback חדש (הכתובת הישנה מפסיקה לעבוד)
//   test           – בדיקת חיבור: אילו כתובות עדכון מוגדרות בנדרים (GetWebhook – לא נספר במכסת ההיסטוריה)
//   setup_webhooks – רישום הכתובת שלנו בנדרים לשלושת סוגי העדכונים + הפעלת חתימת HMAC
//   sync_now       – ייבוא עכשיו
//   reset_history  – ייבוא ההיסטוריה מההתחלה (עסקאות קיימות לא נכנסות פעמיים)
//   manual_import  – ייבוא ידני: הוראות קבע / עסקאות בטווח תאריכים ולפי סוג, עם תצוגה מקדימה (dryRun)
// =====================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const user = await requirePermissionFromRequest(request, 'manage_users');
  if (user instanceof NextResponse) return user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('בקשה לא תקינה');
  }
  const action = typeof body.action === 'string' ? body.action : '';
  const now = new Date().toISOString();

  try {
    switch (action) {
      case 'status': {
        const cfg = await getNedarimConfig();
        const { data: settings } = await supabaseAdmin
          .from('integration_settings')
          .select('last_sync_at, last_sync_result')
          .eq('provider', NEDARIM_SOURCE)
          .maybeSingle();
        return NextResponse.json({
          enabled: cfg.enabled,
          mosadId: cfg.mosadId,
          hasPassword: !!cfg.apiPassword,
          callbackKey: cfg.callbackKey,
          lastHistoryId: cfg.lastHistoryId,
          importFrom: cfg.importFrom,
          lastSyncAt: settings?.last_sync_at ?? null,
          lastSyncResult: settings?.last_sync_result ?? null,
        });
      }

      case 'save_settings': {
        const mosadId = typeof body.mosadId === 'string' ? body.mosadId.trim() : '';
        if (mosadId && !/^[0-9]{1,12}$/.test(mosadId)) return fail('מספר מוסד – ספרות בלבד');
        const enabled = body.enabled === true;
        const importFrom = typeof body.importFrom === 'string' ? body.importFrom : '';
        if (importFrom && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(importFrom)) return fail('תאריך התחלה לא תקין');
        const { error } = await supabaseAdmin
          .from('integration_settings')
          .update({ enabled, mosad_id: mosadId || null, import_from: importFrom || null, updated_at: now, updated_by: user.id })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(
          user,
          'update',
          'integration_settings',
          `נדרים פלוס: ${enabled ? 'מופעל' : 'כבוי'}${importFrom ? `, ייבוא מ-${importFrom.split('-').reverse().join('/')}` : ', ייבוא כל ההיסטוריה'}`
        );
        return NextResponse.json({ success: true });
      }

      case 'save_password': {
        const password = typeof body.password === 'string' ? body.password.trim() : '';
        if (password.length < 6 || password.length > 200 || /\s/.test(password)) {
          return fail('סיסמת API לא תקינה');
        }
        if (!password.startsWith('npk_')) {
          return fail('מפתח API של נדרים פלוס מתחיל ב-npk_ (נוצר בנדרים: הגדרות > API > מפתחות API)');
        }
        const { error } = await supabaseAdmin
          .from('integration_secrets')
          .update({ api_password: password, updated_at: now })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'integration_settings', 'עודכנה סיסמת ה-API של נדרים פלוס');
        return NextResponse.json({ success: true });
      }

      case 'clear_password': {
        const { error } = await supabaseAdmin
          .from('integration_secrets')
          .update({ api_password: null, updated_at: now })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'integration_settings', 'נמחקה סיסמת ה-API של נדרים פלוס');
        return NextResponse.json({ success: true });
      }

      case 'new_key': {
        // אחרי מפתח חדש צריך להריץ שוב "הגדרה אוטומטית" כדי שנדרים ישלחו לכתובת החדשה
        const key = randomBytes(24).toString('hex');
        const { error } = await supabaseAdmin
          .from('integration_secrets')
          .update({ callback_key: key, updated_at: now })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'integration_settings', 'נוצרה כתובת Callback חדשה לנדרים פלוס');
        return NextResponse.json({ callbackKey: key });
      }

      case 'test': {
        const cfg = await getNedarimConfig();
        if (!cfg.mosadId || !cfg.apiPassword) return fail('יש לשמור קודם מספר מוסד וסיסמת API');
        try {
          const webhooks = await getWebhooks({ mosadId: cfg.mosadId, apiPassword: cfg.apiPassword });
          return NextResponse.json({ success: true, webhooks, hasLocalSecret: !!cfg.webhookSecret });
        } catch (err) {
          return fail(err instanceof Error ? err.message : 'החיבור נכשל', 502);
        }
      }

      case 'setup_webhooks': {
        const cfg = await getNedarimConfig();
        if (!cfg.mosadId || !cfg.apiPassword) return fail('יש לשמור קודם מספר מוסד וסיסמת API');
        if (!cfg.callbackKey) return fail('חסר מפתח Callback');
        const origin = typeof body.origin === 'string' ? body.origin.replace(/\/+$/, '') : '';
        if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) {
          return fail('אפשר להגדיר עדכונים רק מהאתר המפורסם (כתובת https), לא מהשרת המקומי');
        }
        const creds = { mosadId: cfg.mosadId, apiPassword: cfg.apiPassword };
        const url = `${origin}/api/nedarim/callback?key=${cfg.callbackKey}`;
        const force = body.force === true;

        // 1. כתובות העדכון (עסקאות, הקמת הוראת קבע, סירובים)
        const conflicts: { type: WebhookType; existing: string }[] = [];
        for (const type of ['Transaction', 'Keva', 'Siruv'] as WebhookType[]) {
          const r = await setWebhook(creds, type, url, force);
          if (!r.ok) {
            if (r.existing) conflicts.push({ type, existing: r.existing });
            else return fail(`נדרים פלוס (${type}): ${r.message}`, 502);
          }
        }
        if (conflicts.length) {
          return NextResponse.json({ success: false, conflicts });
        }

        // 2. חתימה: קודם שומרים אצלנו, ורק אז מפעילים בנדרים (כמו שהתיעוד מורה)
        const secret = generateWebhookSecret();
        const { error } = await supabaseAdmin
          .from('integration_secrets')
          .update({ webhook_secret: secret, updated_at: now })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        try {
          await setWebhookSecret(creds, secret);
        } catch (err) {
          // ההפעלה בנדרים נכשלה – מבטלים אצלנו כדי שעדכונים לא חתומים ימשיכו להתקבל
          await supabaseAdmin.from('integration_secrets').update({ webhook_secret: null }).eq('provider', NEDARIM_SOURCE);
          return fail(`הכתובות הוגדרו, אבל הפעלת החתימה נכשלה: ${err instanceof Error ? err.message : 'שגיאה'}`, 502);
        }

        await auditFromServer(user, 'update', 'integration_settings', 'נדרים פלוס: הוגדרו כתובות העדכון והחתימה');
        return NextResponse.json({ success: true, webhooks: await getWebhooks(creds) });
      }

      case 'sync_now': {
        const summary = await runNedarimSync({ force: true });
        const d = summary.donations;
        await auditFromServer(
          user,
          'IMPORT',
          'donations',
          `ייבוא מנדרים פלוס: ${d.imported + d.new_donor + d.no_donor} תרומות (${d.no_donor} ללא תורם), ${d.new_donor} תורמים חדשים, ${d.review + summary.recurring.review} לבדיקה`
        );
        return NextResponse.json(summary);
      }

      case 'manual_import': {
        const opts = parseManualImportOptions(body);
        if (typeof opts === 'string') return fail(opts);
        const r = await runManualImport(opts);
        if (!opts.dryRun && r.result) {
          const c = r.result;
          const range =
            opts.kind === 'recurring'
              ? opts.recurringScope === 'all' ? 'כל הוראות הקבע' : 'הוראות קבע פעילות'
              : `עסקאות ${opts.from ? `מ-${opts.from.split('-').reverse().join('/')}` : 'מההתחלה'}${
                  opts.to ? ` עד ${opts.to.split('-').reverse().join('/')}` : ''
                }${
                  opts.types.length && opts.types.length < 3
                    ? ` (${opts.types.map((t) => ({ regular: 'רגילות', installments: 'תשלומים', keva: 'חיובי הוראות קבע' })[t]).join(', ')})`
                    : ''
                }`;
          await auditFromServer(
            user,
            'IMPORT',
            opts.kind === 'recurring' ? 'recurring_donations' : 'donations',
            `ייבוא ידני מנדרים פלוס – ${range}${opts.includeIgnored ? ', כולל מסומנים "לא לייבא"' : ''}: ` +
              `${c.imported + c.new_donor + c.no_donor} חדשים, ${c.new_donor} תורמים חדשים, ${c.updated} עודכנו, ${c.review} לבדיקה, ${c.skipped} קיימים`
          );
        }
        return NextResponse.json(r);
      }

      case 'reset_history': {
        const { error } = await supabaseAdmin
          .from('integration_settings')
          .update({ last_history_id: null, updated_at: now, updated_by: user.id })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'integration_settings', 'נדרים פלוס: ייבוא ההיסטוריה יתחיל מההתחלה');
        return NextResponse.json({ success: true });
      }

      default:
        return fail('פעולה לא חוקית');
    }
  } catch (err) {
    console.error('Nedarim API error:', err);
    return fail(err instanceof Error ? err.message : 'שגיאת שרת', 500);
  }
}
