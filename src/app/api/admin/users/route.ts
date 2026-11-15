import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PASSWORD = 6;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// רישום ליומן הפעולות בשם המנהל שביצע את הפעולה
async function audit(userId: string, userName: string, action: string, description: string) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    user_name: userName,
    action,
    table_name: 'user_profiles',
    description,
  });
  if (error) console.error('שגיאה ברישום ליומן:', error.message);
}

export async function POST(request: Request) {
  try {
    // --- 1. זיהוי המשתמש לפי הטוקן ---
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return fail('חסר טוקן התחברות', 401);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return fail('משתמש לא מזוהה', 401);

    // --- 2. בדיקת הרשאה manage_users (רק לפי ההרשאה, לא לפי שם התפקיד) ---
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, role:roles(permissions)')
      .eq('id', user.id)
      .single();

    const role = profile?.role as { permissions?: Record<string, unknown> } | null | undefined;
    if (role?.permissions?.manage_users !== true) {
      return fail('אין לך הרשאת מנהל לביצוע פעולה זו.', 403);
    }
    const adminName = profile?.full_name || user.email || 'מנהל';

    // --- 3. בדיקת הקלט ---
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail('בקשה לא תקינה', 400);
    }
    const action = asString(body.action);
    const password = typeof body.password === 'string' ? body.password : '';

    if (password.length < MIN_PASSWORD) {
      return fail(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD} תווים`, 400);
    }

    // --- 4. ביצוע הפעולה ---
    if (action === 'create') {
      const email = asString(body.email).toLowerCase();
      const fullName = asString(body.fullName);
      if (!EMAIL_RE.test(email)) return fail('כתובת אימייל לא תקינה', 400);
      if (!fullName) return fail('יש להזין שם מלא', 400);

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) return fail(createError.message, 400);

      if (created.user) {
        await supabaseAdmin
          .from('user_profiles')
          .update({ full_name: fullName })
          .eq('id', created.user.id);
      }

      await audit(user.id, adminName, 'create', `נוצר משתמש חדש: ${fullName} (${email})`);
      return NextResponse.json({ success: true });
    }

    if (action === 'update_password') {
      const userId = asString(body.userId);
      if (!UUID_RE.test(userId)) return fail('מזהה משתמש לא תקין', 400);

      const { data: target } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();
      if (!target) return fail('המשתמש לא נמצא', 404);

      const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (passError) return fail(passError.message, 400);

      await audit(
        user.id,
        adminName,
        'update',
        `אופסה סיסמה למשתמש: ${target.full_name || target.email || userId}`
      );
      return NextResponse.json({ success: true });
    }

    return fail('פעולה לא חוקית', 400);
  } catch (error) {
    console.error('Admin API Error:', error);
    return fail('שגיאת שרת פנימית', 500);
  }
}
