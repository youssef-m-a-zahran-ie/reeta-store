"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/analytics/range";
import type { Insight } from "@/lib/analytics/insights";
import { Sparkline } from "./charts";

const TONE = { good: "bg-sage text-white", bad: "bg-rose text-white", info: "bg-plum text-blush" } as const;
const ICON = { good: "↑", bad: "↓", info: "i" } as const;

/** Short readings of the numbers: a list on the left, the selected one on the right. */
export function InsightPanel({ insights }: { insights: Insight[] }) {
  const [sel, setSel] = useState(0);
  if (!insights.length)
    return (
      <section className="card p-5 text-sm text-muted">
        Insights appear here once there are orders to compare with an earlier period.
      </section>
    );
  const cur = insights[Math.min(sel, insights.length - 1)];
  return (
    <section className="grid overflow-hidden rounded-[22px] border border-line bg-cream/60 md:grid-cols-[minmax(0,300px)_1fr]" aria-label="Insights">
      <ul className="max-h-[176px] overflow-y-auto p-2" role="listbox" aria-label="Insight list">
        {insights.map((ins, i) => (
          <li key={ins.id} role="presentation">
            <button
              type="button" role="option" aria-selected={i === sel} onClick={() => setSel(i)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-[13px] font-medium ${i === sel ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
            >
              <span aria-hidden="true" className={`grid size-4 shrink-0 place-content-center rounded-full text-[10px] font-bold ${TONE[ins.tone]}`}>{ICON[ins.tone]}</span>
              <span className="line-clamp-1">{ins.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 rounded-[18px] bg-white p-5 md:m-2 md:ms-0 md:grid-cols-[1fr_minmax(0,320px)]" aria-live="polite">
        <div className="grid content-start gap-2">
          <p className="text-xs text-muted">Insight · {fmtDate(cur.date, true)}</p>
          <p className="flex items-start gap-2 text-[17px] font-semibold text-cocoa">
            <span aria-hidden="true" className={`mt-1 grid size-5 shrink-0 place-content-center rounded-full text-xs font-bold ${TONE[cur.tone]}`}>{ICON[cur.tone]}</span>
            {cur.title}
          </p>
          <p className="text-[14px] text-cocoa/85">
            {cur.parts.map((p, i) => (p.h ? <mark key={i} className="rounded bg-blush/70 px-1 font-medium text-cocoa">{p.t}</mark> : <span key={i}>{p.t}</span>))}
          </p>
        </div>
        {cur.spark && cur.spark.length > 1 && (
          <div className="grid content-end gap-1">
            <Sparkline values={cur.spark} width={320} height={84} />
            <div className="flex justify-between text-xs text-muted">
              <span>{fmtDate(cur.sparkFrom ?? "")}</span>
              <span>{fmtDate(cur.sparkTo ?? "")}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
