// =====================================================================
// בדיקת הרשאה ב-API (צד שרת): מזהה את המשתמש לפי הטוקן ובודק הרשאה בתפקיד
// =====================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type AuthorizedUser = { id: string; name: string };

/** מחזיר את המשתמש אם יש לו את ההרשאה, אחרת תשובת שגיאה מוכנה */
export async function requirePermissionFromRequest(
  request: Request,
  permission: string
): Promise<AuthorizedUser | NextResponse> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'חסר טוקן התחברות' }, { status: 401 });

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'משתמש לא מזוהה' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, role:roles(permissions)')
    .eq('id', user.id)
    .single();

  const role = profile?.role as { permissions?: Record<string, unknown> } | null | undefined;
  if (role?.permissions?.[permission] !== true) {
    return NextResponse.json({ error: 'אין לך הרשאה לפעולה זו.' }, { status: 403 });
  }

  return { id: user.id, name: profile?.full_name || user.email || 'מנהל' };
}

/** רישום ליומן הפעולות בשם המשתמש (מהשרת) */
export async function auditFromServer(
  user: AuthorizedUser,
  action: string,
  table: string,
  description: string
) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: user.id,
    user_name: user.name,
    action,
    table_name: table,
    description,
  });
  if (error) console.error('שגיאה ברישום ליומן:', error.message);
}
