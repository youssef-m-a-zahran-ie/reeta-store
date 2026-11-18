"use client";

import { useId, useState } from "react";
import {
  fmtAxis,
  fmtValue,
  niceTicks,
  pctChange,
  SERIES,
  type Unit,
} from "@/lib/analytics/format";

export type LinePoint = {
  label: string;
  prevLabel?: string;
  value: number;
  prev?: number | null;
};

/** Smooth line through the points that never dips below or above its neighbours (monotone cubic). */
function smoothPath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx = xs.slice(1).map((x, i) => x - xs[i]);
  const m = ys.slice(1).map((y, i) => (y - ys[i]) / dx[i]);
  const t = new Array<number>(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++)
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i],
      b = t[i + 1] / m[i],
      s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${xs[i] + h},${ys[i] + t[i] * h} ${xs[i + 1] - h},${ys[i + 1] - t[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

/**
 * One line (plum) with the comparison period behind it (lighter, dashed). Hover or arrow keys read a day.
 * The same numbers are in a hidden table for screen readers.
 */
export function LineChart({
  points,
  unit,
  rangeLabel,
  prevLabel,
  name,
  height = 250,
}: {
  points: LinePoint[];
  unit: Unit;
  rangeLabel: string;
  prevLabel?: string;
  name: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const n = points.length;
  const hasPrev = points.some((p) => p.prev !== undefined && p.prev !== null);
  const vals = points.flatMap((p) => [
    p.value,
    ...(hasPrev && p.prev != null ? [p.prev] : []),
  ]);
  const { hi, ticks } = niceTicks(Math.max(0, ...vals));
  const W = 720,
    padL = 46,
    padR = 14,
    padT = 12,
    padB = 28;
  const plotW = W - padL - padR,
    plotH = height - padT - padB;
  const x = (i: number) =>
    n <= 1 ? padL + plotW / 2 : padL + (plotW * i) / (n - 1);
  const y = (v: number) => padT + plotH - (v / (hi || 1)) * plotH;
  const xs = points.map((_, i) => x(i));
  const main = smoothPath(
    xs,
    points.map((p) => y(p.value)),
  );
  const prevIdx = points
    .map((p, i) => (p.prev != null ? i : -1))
    .filter((i) => i >= 0);
  const prevPath = smoothPath(
    prevIdx.map(x),
    prevIdx.map((i) => y(points[i].prev as number)),
  );
  const every = Math.max(1, Math.ceil(n / 7));
  const h = hover !== null ? points[hover] : null;
  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.max(
      0,
      Math.min(n - 1, Math.round(((px - padL) / plotW) * (n - 1))),
    );
  };

  return (
    <figure className="m-0 grid gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="h-auto w-full touch-pan-y outline-offset-4"
          role="img"
          aria-label={name}
          tabIndex={0}
          aria-describedby={`${id}-read`}
          onPointerMove={(e) =>
            setHover(pick(e.clientX, e.currentTarget.getBoundingClientRect()))
          }
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              setHover((v) => Math.min(n - 1, (v ?? -1) + 1));
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setHover((v) => Math.max(0, (v ?? n) - 1));
            }
            if (e.key === "Escape") setHover(null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? SERIES.axis : SERIES.grid}
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-cocoa/60 text-[11px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtAxis(t, unit)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-cocoa/60 text-[11px]"
              >
                {p.label}
              </text>
            ) : null,
          )}
          {hasPrev && prevPath && (
            <path
              d={prevPath}
              fill="none"
              stroke={SERIES.compare}
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          )}
          <path
            d={main}
            fill="none"
            stroke={SERIES.main}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {n === 1 && (
            <circle
              cx={x(0)}
              cy={y(points[0].value)}
              r="4"
              fill={SERIES.main}
              stroke="#fff"
              strokeWidth="2"
            />
          )}
          {hover !== null && h && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={padT}
                y2={padT + plotH}
                stroke={SERIES.axis}
                strokeWidth="1"
              />
              {h.prev != null && (
                <circle
                  cx={x(hover)}
                  cy={y(h.prev)}
                  r="4"
                  fill="#9f8f9d"
                  stroke="#fff"
                  strokeWidth="2"
                />
              )}
              <circle
                cx={x(hover)}
                cy={y(h.value)}
                r="4.5"
                fill={SERIES.main}
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 grid -translate-x-1/2 gap-0.5 rounded-xl bg-cocoa px-3 py-2 text-xs whitespace-nowrap text-cream shadow-lg"
            style={{
              left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`,
            }}
          >
            <span className="font-semibold">{h.label}</span>
            <span className="num">{fmtValue(h.value, unit)}</span>
            {h.prev != null && (
              <span className="num text-cream/70">
                {h.prevLabel}: {fmtValue(h.prev, unit)}
              </span>
            )}
          </div>
        )}
      </div>
      <p id={`${id}-read`} className="sr-only" aria-live="polite">
        {h
          ? `${h.label}: ${fmtValue(h.value, unit)}`
          : "Use the left and right arrow keys to read each day."}
      </p>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-4 rounded-full"
            style={{ background: SERIES.main }}
          />
          {rangeLabel}
        </span>
        {hasPrev && prevLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-4 border-t-2 border-dashed"
              style={{ borderColor: SERIES.compare }}
            />
            {prevLabel}
          </span>
        )}
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{name}</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>{rangeLabel}</th>
              {hasPrev && <th>{prevLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td>{p.value}</td>
                {hasPrev && <td>{p.prev ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** A tiny trend line for stat cards: no axes, one 2px stroke. */
export function Sparkline({
  values,
  width = 92,
  height = 30,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span aria-hidden="true" style={{ width }} />;
  const max = Math.max(...values),
    min = Math.min(...values);
  const span = max - min || 1;
  const xs = values.map((_, i) => 2 + ((width - 4) * i) / (values.length - 1));
  const ys = values.map((v) =>
    max === min ? height / 2 : height - 3 - ((v - min) / span) * (height - 6),
  );
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d={smoothPath(xs, ys)}
        fill="none"
        stroke={SERIES.main}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type Slice = { label: string; value: number; prev?: number | null };

/** Parts of a whole: up to four brand colors, the rest folded into "Other". Values are always written in the legend. */
export function Donut({
  slices,
  unit,
  centerLabel,
}: {
  slices: Slice[];
  unit: Unit;
  centerLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...slices]
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4);
  const items: (Slice & { color: string })[] = [
    ...top.map((s, i) => ({ ...s, color: SERIES.cat[i] })),
    ...(rest.length
      ? [
          {
            label: "Other",
            value: rest.reduce((t, s) => t + s.value, 0),
            prev: null,
            color: SERIES.other,
          },
        ]
      : []),
  ];
  const sum = items.reduce((t, s) => t + s.value, 0);
  if (!sum)
    return (
      <p className="py-10 text-center text-sm text-muted">
        No data for this date range
      </p>
    );

  const R = 56,
    SW = 20,
    C = 2 * Math.PI * R,
    GAP = items.length > 1 ? 3 : 0;
  let acc = 0;
  const hv = hover !== null ? items[hover] : null;
  return (
    <div className="@container">
      <div className="grid items-center gap-4 @md:grid-cols-[150px_1fr]">
        <div className="relative mx-auto size-[150px]">
          <svg
            viewBox="0 0 150 150"
            className="size-full -rotate-90"
            role="img"
            aria-label={`${centerLabel}: ${items.map((s) => `${s.label} ${fmtValue(s.value, unit)}`).join(", ")}`}
          >
            {items.map((s, i) => {
              const len = (s.value / sum) * C;
              const seg = (
                <circle
                  key={s.label}
                  cx="75"
                  cy="75"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? SW + 3 : SW}
                  strokeDasharray={`${Math.max(0, len - GAP)} ${C}`}
                  strokeDashoffset={-acc}
                  opacity={hover === null || hover === i ? 1 : 0.35}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              );
              acc += len;
              return seg;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="mx-auto max-w-[80px] truncate text-[11px] text-muted">
              {hv ? hv.label : centerLabel}
            </span>
            <span className="num text-[14px] leading-tight font-medium text-cocoa">
              {fmtValue(hv ? hv.value : sum, unit)}
            </span>
          </div>
        </div>
        <ul className="grid gap-1.5 text-sm">
          {items.map((s, i) => {
            const ch = pctChange(s.value, s.prev ?? null);
            return (
              <li
                key={s.label}
                className={`flex flex-wrap items-center gap-x-2 rounded-lg px-1.5 py-1 ${hover === i ? "bg-cream" : ""}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-[4px]"
                  style={{ background: s.color }}
                />
                <span className="min-w-[5rem] flex-1 truncate">{s.label}</span>
                <span className="num shrink-0 font-medium">
                  {fmtValue(s.value, unit)}
                </span>
                <span className="num w-10 shrink-0 text-end text-xs text-muted">
                  {Math.round((s.value / sum) * 100)}%
                </span>
                {ch !== null && (
                  <span
                    className={`num w-12 shrink-0 text-end text-xs ${ch === 0 ? "text-muted" : "text-cocoa"}`}
                  >
                    {ch > 0 ? "▲" : ch < 0 ? "▼" : ""} {Math.abs(ch)}%
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
