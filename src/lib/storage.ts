import type { MouseEvent } from 'react';
import { supabase } from '@/lib/supabase';

/*
 * קבצים נשמרים ב-buckets פרטיים. במסד שומרים "bucket/path" (למשל
 * "attachments/donations/123/abc.pdf") ובכל פתיחה מייצרים קישור זמני.
 * רשומות ישנות שמורות כקישור ציבורי מלא – גם הן נתמכות.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 10;
const PUBLIC_MARKER = '/storage/v1/object/public/';

export function toStorageRef(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

function parseStorageRef(value: string): { bucket: string; path: string } | null {
  let ref = value.trim();
  if (!ref) return null;

  if (/^https?:\/\//i.test(ref)) {
    const idx = ref.indexOf(PUBLIC_MARKER);
    if (idx === -1) return null; // קישור חיצוני – לא קובץ שלנו
    ref = decodeURIComponent(ref.slice(idx + PUBLIC_MARKER.length).split('?')[0]);
  }

  const slash = ref.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: ref.slice(0, slash), path: ref.slice(slash + 1) };
}

export async function getFileUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const parsed = parseStorageRef(value);
  if (!parsed) return /^https?:\/\//i.test(value) ? value : null;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('שגיאה ביצירת קישור לקובץ:', error);
    return null;
  }
  return data.signedUrl;
}

/** לשימוש ב-onClick של קישור לקובץ: פותח את הקובץ בלשונית חדשה עם קישור זמני */
export async function openSecureFile(
  event: MouseEvent<HTMLElement>,
  value: string | null | undefined
) {
  event.preventDefault();
  event.stopPropagation();

  // פותחים את החלון מיד (לפני ה-await) כדי שחוסם החלונות הקופצים לא יחסום
  const win = window.open('', '_blank');
  const url = await getFileUrl(value);

  if (!url) {
    win?.close();
    alert('לא ניתן לפתוח את הקובץ. ייתכן שאין לך הרשאה לצפות במסמכים.');
    return;
  }

  if (win) {
    win.opener = null;
    win.location.href = url;
  } else {
    window.location.href = url;
  }
}
