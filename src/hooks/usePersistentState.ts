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
