import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { classifyWebhook, parseWebhookBody, verifyWebhookSignature } from '@/lib/nedarim/adapter';
import {
  applyRefusal,
  getNedarimConfig,
  importRecurringRecord,
  importTransactionRecord,
  loadDonorIndex,
} from '@/lib/nedarim/importer';

// =====================================================================
// Webhook מנדרים פלוס – אותה כתובת לשלושת סוגי העדכונים:
//   עסקה מוצלחת → תרומה · הקמת הוראת קבע → הוראת קבע · סירוב הו"ק → ההוראה "נכשלה"
// אבטחה: מפתח סודי בכתובת (key) + חתימת HMAC (כשהופעלה בהגדרות).
// התיעוד: docs/NedarimPlus-API.md → "Callback / Webhook", "חתימת HMAC על עדכוני Webhook"
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

  // הגוף הגולמי – החתימה מחושבת עליו בדיוק כפי שהתקבל
  const rawBody = await request.text();
  if (cfg.webhookSecret) {
    const valid = verifyWebhookSignature(
      rawBody,
      request.headers.get('x-nedarim-timestamp'),
      request.headers.get('x-nedarim-signature'),
      cfg.webhookSecret
    );
    if (!valid) {
      console.warn('Nedarim webhook: חתימה לא תקינה או חסרה');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  if (!cfg.enabled) return NextResponse.json({ ok: true, ignored: 'disabled' });

  const raw = parseWebhookBody(rawBody, request.headers.get('content-type'));
  if (!raw) return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 });

  try {
    const kind = classifyWebhook(raw);
    let outcome: string;
    if (kind === 'transaction') outcome = await importTransactionRecord(raw, await loadDonorIndex());
    else if (kind === 'keva') outcome = await importRecurringRecord(raw, await loadDonorIndex());
    else if (kind === 'refusal') outcome = await applyRefusal(raw);
    else outcome = 'unknown';
    return NextResponse.json({ ok: true, kind, outcome });
  } catch (err) {
    console.error('Nedarim webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
