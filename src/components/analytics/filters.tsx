"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { cairoToday, fmtRange, matchPreset, presetRange, PRESETS, shiftDay, type CompareMode } from "@/lib/analytics/range";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COMPARE: { key: CompareMode; label: string }[] = [
  { key: "prev", label: "Previous period" },
  { key: "year", label: "Same dates last year" },
  { key: "none", label: "No comparison" },
];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function Month({ year, month, start, end, hoverEnd, today, onPick, onHover }: {
  year: number; month: number; start: string; end: string; hoverEnd: string; today: string; onPick: (d: string) => void; onHover: (d: string) => void;
}) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const lo = start && (end || hoverEnd) ? [start, end || hoverEnd].sort()[0] : start;
  const hi = start && (end || hoverEnd) ? [start, end || hoverEnd].sort()[1] : start;
  return (
    <div className="w-[236px]">
      <p className="pb-2 text-center text-sm font-semibold text-cocoa">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden="true">
        {DAYS.map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const day = iso(year, month, d);
          const inRange = lo && hi && day >= lo && day <= hi;
          const edge = day === lo || day === hi;
          const future = day > today;
          return (
            <button
              key={i}
              type="button"
              disabled={future}
              aria-label={fmtRange(day, day)}
              aria-pressed={edge}
              onClick={() => onPick(day)}
              onPointerEnter={() => onHover(day)}
              className={`num h-8 text-[13px] ${edge ? "rounded-lg bg-plum font-semibold text-blush" : inRange ? "bg-blush/60 text-cocoa" : "rounded-lg text-cocoa hover:bg-cream"} ${future ? "cursor-not-allowed opacity-30" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Wraps a trigger and its panel; clicking outside or pressing Escape closes it. */
function Popover({ open, onClose, trigger, children }: { open: boolean; onClose: () => void; trigger: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open, onClose]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && children}
    </div>
  );
}

const chip = "inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-cocoa hover:bg-cream";

/** The filter row above the dashboard: date range, comparison, currency. One row scopes every card below. */
export function AnalyticsFilters({ from, to, cmp, prevFrom, prevTo }: { from: string; to: string; cmp: CompareMode; prevFrom: string | null; prevTo: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const today = cairoToday();
  const [dateOpen, setDateOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const closeDate = useCallback(() => setDateOpen(false), []);
  const closeCompare = useCallback(() => setCompareOpen(false), []);
  const [selStart, setSelStart] = useState(from);
  const [selEnd, setSelEnd] = useState(to);
  const [hoverEnd, setHoverEnd] = useState("");
  const [view, setView] = useState({ y: Number(from.slice(0, 4)), m: Number(from.slice(5, 7)) - 1 });

  const go = (f: string, t: string, c: CompareMode) => {
    setDateOpen(false);
    setCompareOpen(false);
    start(() => router.push(`${pathname}?from=${f}&to=${t}&cmp=${c}`));
  };
  const second = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 };
  const shiftView = (by: number) => setView((v) => { const t = v.y * 12 + v.m + by; return { y: Math.floor(t / 12), m: t % 12 }; });
  const pick = (d: string) => {
    if (!selStart || selEnd) { setSelStart(d); setSelEnd(""); return; }
    if (d < selStart) { setSelEnd(selStart); setSelStart(d); } else setSelEnd(d);
  };
  const activePreset = matchPreset(from, to);

  return (
    <div className={`relative z-20 flex flex-wrap items-center gap-2 ${pending ? "opacity-70" : ""}`} aria-busy={pending}>
      <Popover
        open={dateOpen}
        onClose={closeDate}
        trigger={
        <button type="button" className={chip} aria-expanded={dateOpen} aria-haspopup="dialog" onClick={() => { setSelStart(from); setSelEnd(to); setDateOpen(!dateOpen); setCompareOpen(false); }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 7h12M5 1.5v3M11 1.5v3" /></svg>
          {fmtRange(from, to)}
          <span aria-hidden="true" className="text-[10px]">▾</span>
        </button>
        }
      >
        {(
          <div role="dialog" aria-label="Choose dates" className="absolute start-0 top-full z-30 mt-2 flex max-w-[calc(100vw-2rem)] flex-col overflow-auto rounded-2xl border border-line bg-white shadow-xl sm:flex-row">
            <ul className="grid min-w-[170px] content-start gap-0.5 border-b border-line p-2 sm:border-e sm:border-b-0">
              {PRESETS.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => { const r = presetRange(p.key); go(r.from, r.to, cmp); }}
                    aria-current={activePreset === p.key ? "true" : undefined}
                    className="w-full rounded-lg px-3 py-1.5 text-start text-[13px] hover:bg-cream aria-[current=true]:bg-blush aria-[current=true]:font-semibold"
                  >
                    {p.label}
                  </button>
                </li>
              ))}
              <li><span className="block rounded-lg bg-cream px-3 py-1.5 text-[13px] font-semibold">Custom range</span></li>
            </ul>
            <div className="grid gap-3 p-4">
              <div className="flex items-center gap-2">
                <input aria-label="Start date" type="date" className="input py-1.5" max={today} value={selStart} onChange={(e) => e.target.value && setSelStart(e.target.value)} />
                <span aria-hidden="true">→</span>
                <input aria-label="End date" type="date" className="input py-1.5" max={today} value={selEnd} onChange={(e) => e.target.value && setSelEnd(e.target.value)} />
              </div>
              <div className="flex items-start justify-between gap-4" onPointerLeave={() => setHoverEnd("")}>
                <button type="button" aria-label="Previous month" className="btn btn-secondary btn-sm !px-3" onClick={() => shiftView(-1)}>‹</button>
                <div className="flex flex-wrap justify-center gap-6">
                  <Month year={view.y} month={view.m} start={selStart} end={selEnd} hoverEnd={hoverEnd} today={today} onPick={pick} onHover={(d) => !selEnd && selStart && setHoverEnd(d)} />
                  <Month year={second.y} month={second.m} start={selStart} end={selEnd} hoverEnd={hoverEnd} today={today} onPick={pick} onHover={(d) => !selEnd && selStart && setHoverEnd(d)} />
                </div>
                <button type="button" aria-label="Next month" className="btn btn-secondary btn-sm !px-3" onClick={() => shiftView(1)}>›</button>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDateOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={!selStart || !selEnd || selStart > selEnd || selEnd > today} onClick={() => go(selStart, selEnd, cmp)}>Apply</button>
              </div>
            </div>
          </div>
        )}
      </Popover>

      <Popover
        open={compareOpen}
        onClose={closeCompare}
        trigger={
        <button type="button" className={chip} aria-expanded={compareOpen} aria-haspopup="menu" onClick={() => { setCompareOpen(!compareOpen); setDateOpen(false); }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" /></svg>
          {prevFrom && prevTo ? fmtRange(prevFrom, prevTo) : "No comparison"}
          <span aria-hidden="true" className="text-[10px]">▾</span>
        </button>
        }
      >
        {(
          <ul role="menu" className="absolute start-0 top-full z-30 mt-2 grid min-w-[220px] gap-0.5 rounded-2xl border border-line bg-white p-2 shadow-xl">
            {COMPARE.map((c) => (
              <li key={c.key} role="none">
                <button type="button" role="menuitemradio" aria-checked={cmp === c.key} onClick={() => go(from, to, c.key)} className="w-full rounded-lg px-3 py-1.5 text-start text-[13px] hover:bg-cream aria-checked:bg-blush aria-checked:font-semibold">
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>

      <span className={`${chip} cursor-default hover:bg-white`} title="All amounts are in Egyptian pounds">
        <span aria-hidden="true">£</span> EGP
      </span>
      {shiftDay(to, 0) === today && <span className="text-xs text-muted">Includes today</span>}
    </div>
  );
}
