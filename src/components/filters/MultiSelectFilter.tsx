'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';
import { CONTAINS_PREFIX, isContainsToken, tokenLabel, type FilterOption } from '@/lib/filters';

type Props = {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** טקסט כשלא נבחר כלום */
  placeholder?: string;
  /** לאפשר "מכיל: ..." מטקסט חופשי (Enter) – לשדות כמו טלפון ומייל */
  allowContains?: boolean;
  dir?: 'rtl' | 'ltr';
};

const MAX_VISIBLE = 200;

/**
 * תיבת סינון: מקלידים → הרשימה מצטמצמת; אפשר לסמן כמה ערכים יחד.
 * Enter בוחר את השורה המסומנת (או "מכיל" כשאין התאמה), Backspace בתיבה ריקה מסיר את האחרון.
 */
export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'הכל',
  allowContains = false,
  dir = 'rtl',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // סגירה בלחיצה מחוץ לתיבה
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options),
    [options, q]
  );

  // שורות הרשימה: "מכיל" (אם מותר והוקלד טקסט) ואחריו האפשרויות
  const rows = useMemo(() => {
    const list: { value: string; label: string; count?: number; contains?: boolean }[] = [];
    if (allowContains && q) list.push({ value: CONTAINS_PREFIX + query.trim(), label: `מכיל „${query.trim()}”`, contains: true });
    for (const o of filtered.slice(0, MAX_VISIBLE)) list.push(o);
    return list;
  }, [allowContains, q, query, filtered]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const pick = (value: string, contains?: boolean) => {
    toggle(value);
    // אחרי בחירה מהקלדה – מנקים את הטקסט כדי שאפשר יהיה להקליד את הבא
    if (contains || q) setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[highlight];
      if (row) pick(row.value, row.contains);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  const active = selected.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>

      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex flex-wrap items-center gap-1 min-h-[36px] w-full px-2 py-1 bg-white border rounded-xl text-xs cursor-text ${
          active ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'
        } ${open ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}`}
      >
        {selected.map((token) => (
          <span
            key={token}
            className={`inline-flex items-center gap-1 max-w-full rounded-lg px-1.5 py-0.5 text-[11px] font-medium ${
              isContainsToken(token) ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            <span className="truncate">{tokenLabel(token, options)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(token);
              }}
              className="hover:text-red-600"
              aria-label="הסר"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={query}
          dir={dir}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={active ? '' : placeholder}
          className="flex-1 min-w-[60px] py-1 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400"
        />

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {rows.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                אין התאמות
              </div>
            )}
            {rows.map((row, i) => {
              const checked = selected.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row.value, row.contains)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-right ${
                    i === highlight ? 'bg-slate-100' : ''
                  } ${row.contains ? 'text-violet-700 font-medium border-b border-slate-100' : 'text-slate-700'}`}
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                      checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="flex-1 truncate" dir={row.contains ? undefined : dir}>
                    {row.label}
                  </span>
                  {row.count !== undefined && <span className="text-[10px] text-slate-400">{row.count}</span>}
                </button>
              );
            })}
            {filtered.length > MAX_VISIBLE && (
              <div className="px-3 py-1.5 text-[10px] text-slate-400">
                מוצגות {MAX_VISIBLE} מתוך {filtered.length} – הקלידו כדי לצמצם
              </div>
            )}
          </div>

          {(active || (q && filtered.length > 0)) && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-100 bg-slate-50">
              {q && filtered.length > 0 ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(Array.from(new Set([...selected, ...filtered.map((o) => o.value)])));
                    setQuery('');
                  }}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  בחר את כל המוצגים ({filtered.length})
                </button>
              ) : (
                <span />
              )}
              {active && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange([])}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  נקה ({selected.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
