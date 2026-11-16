'use client';

// =====================================================================
// גרפים פשוטים (HTML) – צבע אחד (כחול המערכת), כל מטבע בנפרד.
// עמודות דקות עם קצה מעוגל, רשת עדינה, תווית רק על הערך הגבוה והחודש האחרון,
// ופרטים מלאים במעבר עכבר.
// =====================================================================

import { formatNumber } from '@/components/donations/donationUtils';

const BAR = '#2563eb';
const BAR_MUTED = '#93c5fd';

export type MonthPoint = { key: string; label: string; total: number; count: number };

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : Math.round(n).toLocaleString('he-IL');

/** עמודות לפי חודש */
export function MonthlyBars({ points, currency }: { points: MonthPoint[]; currency: string }) {
  const max = Math.max(...points.map((p) => p.total), 0);
  const peakIndex = points.findIndex((p) => p.total === max && max > 0);
  const lastIndex = points.length - 1;

  return (
    <div>
      <div className="relative h-44" role="img" aria-label={`תרומות לפי חודש ב-${currency}`}>
        {/* קווי רשת */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${f * 100}%` }}>
            {f > 0 && max > 0 && (
              <span className="absolute -top-2 left-0 text-[10px] text-slate-400 bg-white pr-1">{compact(max * f)}</span>
            )}
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pl-8">
          {points.map((p, i) => {
            const h = max > 0 ? (p.total / max) * 100 : 0;
            const showLabel = p.total > 0 && (i === peakIndex || i === lastIndex);
            return (
              <div key={p.key} className="group relative flex-1 h-full flex flex-col justify-end items-center">
                {showLabel && <span className="text-[10px] text-slate-600 mb-0.5 whitespace-nowrap">{compact(p.total)}</span>}
                <div
                  className="w-full max-w-7 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{ height: `${h}%`, minHeight: p.total > 0 ? 2 : 0, background: i === lastIndex ? BAR : BAR_MUTED }}
                />
                {/* tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-lg bg-slate-800 text-white text-[11px] px-2 py-1 shadow">
                  <div className="font-semibold">{p.label}</div>
                  <div>
                    {formatNumber(p.total)} {currency}
                  </div>
                  <div className="text-slate-300">{p.count} תרומות</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-[2px] pl-8 mt-1">
        {points.map((p) => (
          <div key={p.key} className="flex-1 text-center text-[10px] text-slate-400 truncate">
            {p.label.split(' ')[0]}
          </div>
        ))}
      </div>
    </div>
  );
}

export type BarItem = { key: string; label: string; value: number; sub?: string; onClick?: () => void };

/** עמודות אופקיות (דירוג) */
export function HorizontalBars({ items, unit }: { items: BarItem[]; unit: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0) return <div className="p-6 text-center text-sm text-slate-400">אין נתונים</div>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="group">
          <div className="flex items-baseline justify-between gap-2 text-xs mb-0.5">
            {it.onClick ? (
              <button type="button" onClick={it.onClick} className="truncate text-slate-700 hover:text-blue-600 hover:underline text-right">
                {it.label}
              </button>
            ) : (
              <span className="truncate text-slate-700">{it.label}</span>
            )}
            <span className="shrink-0 text-slate-800 font-medium">
              {formatNumber(it.value)} {unit}
              {it.sub && <span className="text-slate-400 font-normal mr-1">· {it.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full group-hover:opacity-80"
              style={{ width: `${max > 0 ? Math.max(2, (it.value / max) * 100) : 0}%`, background: BAR }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
