import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { parseCallbackBody } from '@/lib/nedarim/adapter';
import { getNedarimConfig, importTransactionRecord, loadDonorIndex } from '@/lib/nedarim/importer';

// =====================================================================
// Callback מנדרים פלוס: נדרים שולחים לכאן כל עסקה חדשה מיד כשהיא מתבצעת.
// הכתובת (כולל המפתח הסודי key) מוצגת בפאנל ניהול → נדרים פלוס.
// אין כאן משתמש מחובר – האבטחה היא המפתח הסודי בכתובת.
// =====================================================================

export const dynamic = 'force-dynamic';

function sameKey(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  const cfg = await getNedarimConfig();
  if (!cfg.callbackKey || !key || !sameKey(key, cfg.callbackKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!cfg.enabled) return NextResponse.json({ ok: true, ignored: 'disabled' });

  const raw = parseCallbackBody(await request.text(), request.headers.get('content-type'));
  if (!raw) return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 });

  try {
    const outcome = await importTransactionRecord(raw, await loadDonorIndex());
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error('Nedarim callback error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
