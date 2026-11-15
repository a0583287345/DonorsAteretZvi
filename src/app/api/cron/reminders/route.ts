import { NextResponse } from 'next/server';
import { runDailyEmails } from '@/lib/email/server';

// =====================================================================
// בדיקה יומית אוטומטית (Vercel Cron – מוגדר ב-vercel.json)
// Vercel שולח Authorization: Bearer <CRON_SECRET> כשמשתנה הסביבה CRON_SECRET מוגדר.
// =====================================================================

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET לא מוגדר' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cron reminders error:', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'error' }, { status: 500 });
  }
}
