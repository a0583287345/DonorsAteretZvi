import { useCallback, useState } from 'react';

/**
 * מצב (סינון / מיון) שנשמר בדפדפן (localStorage) – לא מתאפס במעבר בין לשוניות או ברענון.
 * `allowed` – אם הוגדר, ערך שמור שאינו ברשימה נזנח.
 */
export function usePersistentState<T extends string>(key: string, defaultValue: T, allowed?: readonly T[]) {
  const storageKey = `ui:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (saved === null) return defaultValue;
      if (allowed && !(allowed as readonly string[]).includes(saved)) return defaultValue;
      return saved as T;
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (next === defaultValue) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, next);
      } catch {
        // דפדפן שחוסם אחסון – פשוט לא יישמר
      }
    },
    [storageKey, defaultValue]
  );

  return [value, update] as const;
}

/**
 * אובייקט שלם (למשל כל הסינונים של לשונית) שנשמר בדפדפן כ-JSON.
 * ערך שמור משולב עם ברירת המחדל: שדה חסר או מסוג שגוי מקבל את ברירת המחדל,
 * כך שהוספת שדה חדש בעתיד לא שוברת סינון ששמור אצל המשתמש.
 */
export function usePersistentObject<T extends Record<string, string | string[]>>(key: string, defaults: T) {
  const storageKey = `ui:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (!saved) return defaults;
      const parsed: unknown = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object') return defaults;
      const merged: Record<string, string | string[]> = { ...defaults };
      for (const [k, def] of Object.entries(defaults)) {
        const v = (parsed as Record<string, unknown>)[k];
        if (Array.isArray(def)) {
          if (Array.isArray(v) && v.every((x) => typeof x === 'string')) merged[k] = v;
        } else if (typeof v === 'string') {
          merged[k] = v;
        }
      }
      return merged as T;
    } catch {
      return defaults;
    }
  });

  const save = useCallback(
    (next: T) => {
      try {
        if (JSON.stringify(next) === JSON.stringify(defaults)) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // דפדפן שחוסם אחסון – פשוט לא יישמר
      }
    },
    [storageKey, defaults]
  );

  /** עדכון שדה אחד */
  const setField = useCallback(
    <K extends keyof T>(field: K, fieldValue: T[K]) => {
      setValue((prev) => {
        const next = { ...prev, [field]: fieldValue };
        save(next);
        return next;
      });
    },
    [save]
  );

  /** חזרה לברירת המחדל (איפוס) */
  const reset = useCallback(() => {
    setValue(defaults);
    save(defaults);
  }, [defaults, save]);

  return [value, setField, reset] as const;
}
