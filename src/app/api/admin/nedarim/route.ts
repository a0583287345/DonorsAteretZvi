import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditFromServer, requirePermissionFromRequest } from '@/lib/server-auth';
import { NEDARIM_SOURCE, fetchHistory } from '@/lib/nedarim/adapter';
import { getNedarimConfig, runNedarimSync } from '@/lib/nedarim/importer';

// =====================================================================
// הגדרות נדרים פלוס מפאנל הניהול (דורש manage_users):
//   status         – הגדרות + האם שמורה סיסמה + מפתח ה-Callback
//   save_settings  – הפעלה/כיבוי + מספר מוסד
//   save_password  – סיסמת API (נשמרת רק בשרת, לא חוזרת לדפדפן לעולם)
//   clear_password – מחיקת הסיסמה
//   new_key        – מפתח Callback חדש (הכתובת הישנה מפסיקה לעבוד)
//   test           – בדיקת חיבור (בלי לייבא)
//   sync_now       – ייבוא עכשיו
//   reset_history  – ייבוא ההיסטוריה מההתחלה (עסקאות קיימות לא נכנסות פעמיים)
// =====================================================================

export const dynamic = 'force-dynamic';

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
          lastSyncAt: settings?.last_sync_at ?? null,
          lastSyncResult: settings?.last_sync_result ?? null,
        });
      }

      case 'save_settings': {
        const mosadId = typeof body.mosadId === 'string' ? body.mosadId.trim() : '';
        if (mosadId && !/^[0-9]{1,12}$/.test(mosadId)) return fail('מספר מוסד – ספרות בלבד');
        const enabled = body.enabled === true;
        const { error } = await supabaseAdmin
          .from('integration_settings')
          .update({ enabled, mosad_id: mosadId || null, updated_at: now, updated_by: user.id })
          .eq('provider', NEDARIM_SOURCE);
        if (error) return fail(error.message, 500);
        await auditFromServer(user, 'update', 'integration_settings', `נדרים פלוס: ${enabled ? 'מופעל' : 'כבוי'}`);
        return NextResponse.json({ success: true });
      }

      case 'save_password': {
        const password = typeof body.password === 'string' ? body.password.trim() : '';
        if (password.length < 6 || password.length > 200 || /\s/.test(password)) {
          return fail('סיסמת API לא תקינה');
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
          const rows = await fetchHistory({ mosadId: cfg.mosadId, apiPassword: cfg.apiPassword }, cfg.lastHistoryId);
          return NextResponse.json({ success: true, rows: rows.length });
        } catch (err) {
          return fail(err instanceof Error ? err.message : 'החיבור נכשל', 502);
        }
      }

      case 'sync_now': {
        const summary = await runNedarimSync({ force: true });
        const d = summary.donations;
        await auditFromServer(
          user,
          'IMPORT',
          'donations',
          `ייבוא מנדרים פלוס: ${d.imported + d.new_donor} תרומות, ${d.new_donor} תורמים חדשים, ${d.review + summary.recurring.review} לבדיקה`
        );
        return NextResponse.json(summary);
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
