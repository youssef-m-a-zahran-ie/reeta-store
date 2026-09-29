import Link from "next/link";
import type { ReactNode } from "react";
import { RANGES, type RangeKey } from "@/lib/admin/period";

/** A number with its change against the previous period. `upIsGood` flips the color for things like refusals. */
export function KpiTile({
  label,
  value,
  delta,
  compare,
  hint,
  upIsGood = true,
}: {
  label: string;
  value: string;
  delta?: number | null;
  compare?: string;
  hint?: ReactNode;
  upIsGood?: boolean;
}) {
  const good = delta === null || delta === undefined || delta === 0 ? null : delta > 0 === upIsGood;
  return (
    <div className="card grid content-start gap-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-medium text-plum md:text-[28px]">{value}</span>
      {delta !== undefined && (
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {delta === null ? (
            <span>Nothing to compare yet</span>
          ) : (
            <>
              <span
                className={`chip px-2 ${good === null ? "bg-cocoa/10 text-cocoa" : good ? "bg-sage/20 text-[#4d5a33]" : "bg-rose/15 text-[#a33a52]"}`}
              >
                <span aria-hidden="true">{delta > 0 ? "▲" : delta < 0 ? "▼" : "•"}</span>
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>
              <span>vs {compare}</span>
            </>
          )}
        </span>
      )}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** Range tabs plus a custom from/to form. Keeps other query params out on purpose. */
export function PeriodPicker({ path, current, from, to }: { path: string; current: RangeKey; from: string; to: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap gap-1.5" aria-label="Period">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`${path}?range=${r.key}`}
            aria-current={r.key === current ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-plum hover:bg-blush aria-[current=page]:bg-plum aria-[current=page]:text-blush"
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap items-center gap-2 text-sm" action={path}>
        <input type="hidden" name="range" value="custom" />
        <label className="sr-only" htmlFor="p-from">
          From
        </label>
        <input id="p-from" type="date" name="from" defaultValue={from} className="input w-auto py-1.5" />
        <span className="text-muted">to</span>
        <label className="sr-only" htmlFor="p-to">
          To
        </label>
        <input id="p-to" type="date" name="to" defaultValue={to} className="input w-auto py-1.5" />
        <button className={`btn btn-sm ${current === "custom" ? "btn-primary" : "btn-secondary"}`}>Show</button>
      </form>
    </div>
  );
}

/** Horizontal bars for a ranked list; the bar is a plum wash, the numbers stay in ink. */
export function BarList({ rows, empty }: { rows: { label: ReactNode; value: number; display: string; sub?: string }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="grid gap-1.5">
      {rows.map((r, i) => (
        <li key={i} className="relative overflow-hidden rounded-xl px-3 py-2">
          <span className="absolute inset-y-0 start-0 rounded-xl bg-plum/12" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} aria-hidden="true" />
          <span className="relative flex items-center justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="num shrink-0 font-semibold">
              {r.display}
              {r.sub && <span className="ms-2 text-xs font-normal text-muted">{r.sub}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
