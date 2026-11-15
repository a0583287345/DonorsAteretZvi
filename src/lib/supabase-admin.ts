import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// =====================================================================
// לקוח service_role – עוקף RLS. צד שרת בלבד! אסור לייבא לקוד 'use client'.
// =====================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceKey) {
  console.warn('חסר SUPABASE_SERVICE_ROLE_KEY בקובץ סביבה');
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
