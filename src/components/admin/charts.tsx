"use client";

import { useState } from "react";

const egpShort = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(Math.round(n)));
const egpFull = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} EGP`;

/** Rounded "nice" upper bound and 4 ticks for an axis. */
function niceTicks(max: number) {
  if (max <= 0) return { top: 100, ticks: [0, 25, 50, 75, 100] };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

/**
 * Sales per day: one series of plum columns. Hover or tap a day for sales and orders.
 * A hidden table carries the same numbers for screen readers.
 */
export function DailySalesChart({ data, height = 220 }: { data: { d: string; sales: number; orders: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.sales));
  const { top, ticks } = niceTicks(max);
  const n = data.length;
  const W = 720;
  const padL = 44;
  const padB = 26;
  const plotW = W - padL - 8;
  const plotH = height - padB - 10;
  const band = plotW / Math.max(n, 1);
  const barW = Math.min(24, Math.max(3, band - 2));
  const y = (v: number) => 10 + plotH - (v / top) * plotH;
  const labelEvery = n <= 10 ? 1 : n <= 31 ? Math.ceil(n / 8) : Math.ceil(n / 7);
  const fmtD = (d: string, long = false) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(long ? { weekday: "short" } : {}), timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label="Sales per day" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="rgb(91 70 89 / .12)" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-cocoa/55 text-[11px]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {egpShort(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + band * i + band / 2;
          const bh = Math.max(0, (d.sales / top) * plotH);
          const x = cx - barW / 2;
          const r = Math.min(4, barW / 2, bh);
          const yb = 10 + plotH;
          return (
            <g key={d.d}>
              {bh > 0 && (
                <path
                  d={`M${x},${yb} V${yb - bh + r} Q${x},${yb - bh} ${x + r},${yb - bh} H${x + barW - r} Q${x + barW},${yb - bh} ${x + barW},${yb - bh + r} V${yb} Z`}
                  className={hover === null || hover === i ? "fill-plum" : "fill-plum/35"}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-cocoa/55 text-[11px]">
                  {fmtD(d.d)}
                </text>
              )}
              {/* Hit target: the whole day column, bigger than the bar. */}
              <rect
                x={padL + band * i}
                y={10}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              />
            </g>
          );
        })}
        <line x1={padL} x2={W - 8} y1={10 + plotH} y2={10 + plotH} stroke="rgb(91 70 89 / .3)" strokeWidth="1" />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 grid -translate-x-1/2 gap-0.5 rounded-xl bg-cocoa px-3 py-2 text-xs whitespace-nowrap text-cream shadow-lg"
          style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%` }}
        >
          <span className="font-semibold">{fmtD(h.d, true)}</span>
          <span className="num">{egpFull(h.sales)}</span>
          <span className="num text-cream/75">
            {h.orders} order{h.orders === 1 ? "" : "s"}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Sales per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.d}>
              <td>{d.d}</td>
              <td>{d.sales}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Orders by weekday and hour: a single-hue plum ramp, empty hours in cream. */
export function HourHeatmap({ data }: { data: { dow: number; hour: number; orders: number }[] }) {
  const [hover, setHover] = useState<{ dow: number; hour: number; n: number } | null>(null);
  const grid = new Map(data.map((c) => [`${c.dow}-${c.hour}`, c.orders]));
  const max = Math.max(1, ...data.map((c) => c.orders));
  const shade = (n: number) => (n === 0 ? "var(--cream)" : `color-mix(in srgb, var(--plum) ${Math.round(22 + (n / max) * 78)}%, var(--cream))`);
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px] text-[10px] text-cocoa/55">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
          {DAYS.map((day, di) => (
            <Row key={day} day={day} dow={di + 1} grid={grid} shade={shade} onHover={setHover} />
          ))}
        </div>
      </div>
      <p className="h-5 text-sm text-muted" aria-live="polite">
        {hover
          ? `${DAYS[hover.dow - 1]} ${String(hover.hour).padStart(2, "0")}:00–${String(hover.hour + 1).padStart(2, "0")}:00 · ${hover.n} order${hover.n === 1 ? "" : "s"}`
          : "Darker = more orders. Hover a square for the count."}
      </p>
    </div>
  );
}

function Row({
  day,
  dow,
  grid,
  shade,
  onHover,
}: {
  day: string;
  dow: number;
  grid: Map<string, number>;
  shade: (n: number) => string;
  onHover: (v: { dow: number; hour: number; n: number } | null) => void;
}) {
  return (
    <>
      <span className="self-center pe-1 text-[11px]">{day}</span>
      {Array.from({ length: 24 }, (_, h) => {
        const n = grid.get(`${dow}-${h}`) ?? 0;
        return (
          <span
            key={h}
            className="aspect-square rounded-[4px]"
            style={{ background: shade(n) }}
            title={`${day} ${h}:00 · ${n} orders`}
            onMouseEnter={() => onHover({ dow, hour: h, n })}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </>
  );
}
