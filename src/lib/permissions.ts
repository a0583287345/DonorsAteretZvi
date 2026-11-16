// =====================================================================
// רשימת ההרשאות של המערכת – מקור אחד לכל המקומות (פאנל ניהול, הודעות, UI)
// הרשאה חדשה = להוסיף כאן + <Protect permId> ב-UI + מדיניות RLS במסד.
// =====================================================================

/** 'action' = כפתור/פעולה, 'view' = צפייה בנתון או באזור במסך */
export type PermissionKind = 'action' | 'view';

export type PermissionDef = {
  id: string;
  label: string;
  kind: PermissionKind;
};

export type PermissionGroup = {
  title: string;
  permissions: PermissionDef[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'הגדרות מערכת ומשתמשים',
    permissions: [
      { id: 'manage_users', label: 'ניהול משתמשים (הוספה, עריכה, סיסמאות)', kind: 'action' },
      { id: 'manage_roles', label: 'ניהול תפקידים והרשאות', kind: 'action' },
      { id: 'view_dashboard', label: 'כניסה למערכת (לוח הבקרה)', kind: 'view' },
    ],
  },
  {
    title: 'ניהול תורמים',
    permissions: [
      { id: 'donors_view', label: 'צפייה ברשימת התורמים', kind: 'view' },
      { id: 'donors_create', label: 'הוספת תורם חדש', kind: 'action' },
      { id: 'donors_edit', label: 'עריכת פרטי תורם (כללי)', kind: 'action' },
      { id: 'donors_delete', label: 'מחיקת תורם', kind: 'action' },
      { id: 'donors_export', label: 'ייצוא תורמים לאקסל', kind: 'action' },
      { id: 'donors_view_contact', label: 'צפייה בפרטי התקשרות (טלפונים, אימייל, כתובת)', kind: 'view' },
      { id: 'donors_edit_contact', label: 'עריכת פרטי התקשרות', kind: 'action' },
      { id: 'donors_merge', label: 'בירור כפילויות ומיזוג תורמים (כולל תורמים מיובאים לבדיקה)', kind: 'action' },
    ],
  },
  {
    title: 'ניהול תרומות',
    permissions: [
      { id: 'donations_view', label: 'צפייה ברשימת התרומות', kind: 'view' },
      { id: 'donations_create', label: 'הוספת תרומה חדשה', kind: 'action' },
      { id: 'donations_edit', label: 'עריכת תרומה קיימת', kind: 'action' },
      { id: 'donations_delete', label: 'מחיקת תרומה', kind: 'action' },
      { id: 'donations_export', label: 'ייצוא תרומות לאקסל', kind: 'action' },
      { id: 'donations_view_amount', label: 'צפייה בסכומי התרומות (חסיון פיננסי)', kind: 'view' },
    ],
  },
  {
    title: 'מסמכים',
    permissions: [
      { id: 'documents_view', label: 'צפייה במסמכים (קבלות/טפסים)', kind: 'view' },
      { id: 'documents_upload', label: 'העלאת מסמכים חדשים', kind: 'action' },
      { id: 'documents_delete', label: 'מחיקת מסמכים', kind: 'action' },
    ],
  },
  {
    title: 'תזכורות',
    permissions: [
      { id: 'reminders_view', label: 'צפייה בתזכורות', kind: 'view' },
      { id: 'reminders_create', label: 'הוספת תזכורות חדשות', kind: 'action' },
      { id: 'reminders_edit', label: 'עריכת תזכורות קיימות', kind: 'action' },
      { id: 'reminders_delete', label: 'מחיקת תזכורות', kind: 'action' },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const BY_ID = new Map(ALL_PERMISSIONS.map((p) => [p.id, p]));

export function getPermission(id: string): PermissionDef | undefined {
  return BY_ID.get(id);
}

// ---------------------------------------------------------------------
// מצב הרשאה עבור משתמש:
//   allowed – מותר
//   locked  – אסור, אבל מוצג חסום (בלחיצה: "אין לך הרשאה")
//   hidden  – אסור ולא מוצג בכלל
// ---------------------------------------------------------------------
export type PermissionAccess = 'allowed' | 'locked' | 'hidden';

/** איך להציג הרשאה שאסורה – נשמר ב-roles.denied_display */
export type DeniedDisplay = 'locked' | 'hidden';

export type PermissionsMap = Record<string, boolean>;
export type DeniedDisplayMap = Record<string, DeniedDisplay>;

/** ממיר את roles.permissions (אובייקט או מערך ישן) למבנה אחיד */
export function normalizePermissions(raw: unknown): PermissionsMap {
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.filter((p): p is string => typeof p === 'string').map((p) => [p, true]));
  }
  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === true]));
  }
  return {};
}

export function normalizeDeniedDisplay(raw: unknown): DeniedDisplayMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: DeniedDisplayMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === 'locked') result[k] = 'locked';
  }
  return result;
}

export function resolveAccess(
  permId: string,
  permissions: PermissionsMap,
  deniedDisplay: DeniedDisplayMap
): PermissionAccess {
  if (permissions[permId] === true) return 'allowed';
  return deniedDisplay[permId] === 'locked' ? 'locked' : 'hidden';
}

export function deniedMessage(permId: string): string {
  const label = getPermission(permId)?.label;
  return label ? `אין לך הרשאה: ${label}` : 'אין לך הרשאה לפעולה זו';
}
