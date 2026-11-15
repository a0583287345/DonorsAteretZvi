import { supabase } from '@/lib/supabase';

// רישום פעולה ליומן (audit_logs) בשם המשתמש המחובר.
// שגיאה ברישום לא עוצרת את הפעולה עצמה.
export async function logActivity(action: string, tableName: string, description: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'משתמש לא ידוע',
      action,
      table_name: tableName,
      description,
    });

    if (error) console.error('שגיאה ברישום ליומן:', error.message);
  } catch (error) {
    console.error('שגיאה ברישום ליומן:', error);
  }
}
