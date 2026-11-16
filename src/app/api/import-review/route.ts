import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { auditFromServer, requirePermissionFromRequest } from '@/lib/server-auth';
import type { IncomingDonor } from '@/lib/import/donorMatch';
import type { ParsedDonation, ParsedRecurring } from '@/lib/nedarim/adapter';
import {
  createDonorFromIncoming,
  fillMissingDonorFields,
  insertDonation,
  upsertRecurring,
} from '@/lib/nedarim/importer';

// =====================================================================
// טיפול בפריט מתור "לבדיקה" (דורש donors_merge):
//   link   – שיוך לתורם קיים (donorId) + השלמת שדות חסרים אצלו
//   create – יצירת תורם חדש מהנתונים המיובאים
//   ignore – לא לייבא (לא יחזור לתור)
// =====================================================================

export const dynamic = 'force-dynamic';

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const user = await requirePermissionFromRequest(request, 'donors_merge');
  if (user instanceof NextResponse) return user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('בקשה לא תקינה');
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const action = typeof body.action === 'string' ? body.action : '';
  if (!id) return fail('חסר מזהה');

  const { data: item, error: loadError } = await supabaseAdmin.from('import_review').select('*').eq('id', id).maybeSingle();
  if (loadError) return fail(loadError.message, 500);
  if (!item) return fail('הפריט לא נמצא', 404);
  if (item.status !== 'pending') return fail('הפריט כבר טופל');

  const incoming = item.incoming_donor as unknown as IncomingDonor;
  const label = incoming.full_name ?? [incoming.first_name, incoming.last_name].filter(Boolean).join(' ') ?? '';

  try {
    let donorId: string | null = null;

    if (action === 'link') {
      donorId = typeof body.donorId === 'string' ? body.donorId : null;
      if (!donorId) return fail('יש לבחור תורם');
      const { data: donor } = await supabaseAdmin.from('donors').select('id').eq('id', donorId).maybeSingle();
      if (!donor) return fail('התורם לא נמצא', 404);
      await fillMissingDonorFields(donorId, incoming);
    } else if (action === 'create') {
      donorId = await createDonorFromIncoming(incoming, { isRecurring: item.payload_kind === 'recurring' });
    } else if (action !== 'ignore') {
      return fail('פעולה לא חוקית');
    }

    if (donorId && item.incoming_payload) {
      if (item.payload_kind === 'donation') {
        await insertDonation(donorId, item.incoming_payload as unknown as ParsedDonation);
      } else if (item.payload_kind === 'recurring') {
        await upsertRecurring(donorId, item.incoming_payload as unknown as ParsedRecurring);
      }
    }

    const status = action === 'link' ? 'linked' : action === 'create' ? 'created' : 'ignored';
    const { error } = await supabaseAdmin
      .from('import_review')
      .update({ status, resolved_donor_id: donorId, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return fail(error.message, 500);

    const what = item.payload_kind === 'recurring' ? 'הוראת קבע' : 'תרומה';
    const desc =
      status === 'linked'
        ? `${what} מנדרים פלוס (${label}) שויכה לתורם קיים`
        : status === 'created'
          ? `נוצר תורם חדש מנדרים פלוס: ${label}`
          : `${what} מנדרים פלוס (${label}) סומנה "לא לייבא"`;
    await auditFromServer(user, 'IMPORT_REVIEW', 'import_review', desc);

    return NextResponse.json({ success: true, donorId });
  } catch (err) {
    console.error('Import review error:', err);
    return fail(err instanceof Error ? err.message : 'שגיאת שרת', 500);
  }
}
