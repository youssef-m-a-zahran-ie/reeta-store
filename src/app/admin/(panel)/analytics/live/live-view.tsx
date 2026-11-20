"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { fmtValue, pctChange, SERIES } from "@/lib/analytics/format";
import { Sparkline } from "@/components/analytics/charts";

export type Live = {
  now: string; visitors: number; sessions: number; sessions_prev: number; orders: number; orders_prev: number; sales: number; sales_prev: number;
  carts: number; checkouts: number; purchased: number;
  spark: { sessions: number[]; orders: number[]; sales: number[] };
  locations: { label: string; n: number }[];
  new_vs_returning: { new: number; returning: number };
  products: { name: string; option: string | null; sales: number }[];
  dots: { visitors: { lat: number; lng: number; city: string | null }[]; orders: { lat: number; lng: number; name: string }[] };
};

const VISITOR = "#cf5973";
const ORDER = "#7e387b";

function Pill({ cur, prev }: { cur: number; prev: number }) {
  const d = pctChange(cur, prev);
  if (d === null) return null;
  return <span className="chip num bg-cocoa/10 px-2 text-cocoa"><span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "•"}</span><span className="sr-only">{d > 0 ? "Up" : d < 0 ? "Down" : "No change"}</span>{Math.abs(d)}%</span>;
}

function Tile({ title, value, pill, spark }: { title: string; value: string; pill?: React.ReactNode; spark?: number[] }) {
  return (
    <div className="card grid gap-1 p-4">
      <h3 className="font-sans text-[14px] font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-2"><span className="num text-[22px] leading-none font-medium">{value}</span>{pill}</div>
      {spark && <Sparkline values={spark} width={140} height={28} />}
    </div>
  );
}

function LiveMap({ dots }: { dots: Live["dots"] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);
  // Zoom to the dots once; after that the map stays where the admin left it across refreshes.
  const fitted = useRef(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (off || !el.current || map.current) return;
      L.current = Lf;
      const m = Lf.map(el.current, { zoomControl: true, scrollWheelZoom: false }).setView([30.0444, 31.2357], 9);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
      layer.current = Lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    })();
    return () => {
      off = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const Lf = L.current, g = layer.current, m = map.current;
    if (!ready || !Lf || !g || !m) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    for (const v of dots.visitors) { Lf.circleMarker([v.lat, v.lng], { radius: 8, color: "#fff", weight: 2, fillColor: VISITOR, fillOpacity: 0.95 }).bindTooltip(v.city ?? "Visitor").addTo(g); pts.push([v.lat, v.lng]); }
    for (const o of dots.orders) { Lf.circleMarker([o.lat, o.lng], { radius: 9, color: "#fff", weight: 2, fillColor: ORDER, fillOpacity: 0.95 }).bindTooltip(`Order ${o.name}`).addTo(g); pts.push([o.lat, o.lng]); }
    if (pts.length && !fitted.current) {
      m.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });
      fitted.current = true;
    }
  }, [dots, ready]);

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[22px] border border-line lg:min-h-[640px]">
      <div ref={el} className="absolute inset-0" role="img" aria-label="Map of visitors right now and today's orders" />
      <div className="pointer-events-none absolute start-3 bottom-3 z-[500] flex gap-3 rounded-full bg-white/95 px-3 py-1.5 text-xs shadow">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full" style={{ background: ORDER }} />Orders today</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full" style={{ background: VISITOR }} />Visitors right now</span>
      </div>
    </div>
  );
}

/** "Just now" that counts up until the next refresh; remounted (reset) with every new payload. */
function Freshness() {
  const [age, setAge] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAge((a) => a + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
      <span aria-hidden="true" className="size-2.5 rounded-full bg-sage" />
      {age < 5 ? "Just now" : `Updated ${age}s ago`}
    </p>
  );
}

export function LiveView({ data }: { data: Live }) {
  const router = useRouter();
  // Pull fresh numbers every 10 seconds while the tab is open on screen.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 10000);
    return () => clearInterval(t);
  }, [router]);
  const nr = data.new_vs_returning;
  const nrTotal = nr.new + nr.returning;
  const dots = (n: number) => Array.from({ length: Math.min(n, 24) }, (_, i) => <span key={i} aria-hidden="true" className="size-2.5 rounded-full" style={{ background: SERIES.main }} />);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,480px)_1fr]">
      <div className="grid content-start gap-4">
        <Freshness key={data.now} />
        <div className="grid grid-cols-2 gap-3">
          <Tile title="Visitors right now" value={String(data.visitors)} />
          <Tile title="Total sales today" value={fmtValue(data.sales, "money")} pill={<Pill cur={data.sales} prev={data.sales_prev} />} spark={data.spark.sales} />
          <Tile title="Sessions" value={String(data.sessions)} pill={<Pill cur={data.sessions} prev={data.sessions_prev} />} spark={data.spark.sessions} />
          <Tile title="Orders" value={String(data.orders)} pill={<Pill cur={data.orders} prev={data.orders_prev} />} spark={data.spark.orders} />
        </div>

        <section className="card grid gap-3 p-4">
          <h3 className="font-sans text-[14px] font-semibold">Customer behavior</h3>
          <div className="grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse">
            {[["Active carts", data.carts], ["Checking out", data.checkouts], ["Purchased today", data.purchased]].map(([label, n]) => (
              <div key={label} className="grid content-start gap-2 px-3 first:ps-0">
                <span className="text-xs text-muted">{label}</span>
                <span className="num text-[20px] leading-none font-medium">{n}</span>
                <span className="flex flex-wrap gap-1">{dots(Number(n))}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card grid gap-3 p-4">
          <h3 className="font-sans text-[14px] font-semibold">Sessions by location</h3>
          {data.locations.length === 0 ? <p className="text-sm text-muted">No visits yet today</p> : (
            <ul className="grid gap-2.5">
              {data.locations.map((l) => (
                <li key={l.label} className="grid gap-1 text-[13px]">
                  <div className="flex justify-between gap-3"><span className="truncate">{l.label}</span><span className="num font-medium">{l.n}</span></div>
                  <div className="h-2 rounded-full bg-cream/70" aria-hidden="true"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (l.n / data.locations[0].n) * 100)}%`, background: SERIES.main }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card grid gap-3 p-4">
          <h3 className="font-sans text-[14px] font-semibold">New vs returning customers</h3>
          {nrTotal === 0 ? <p className="text-sm text-muted">No orders yet today</p> : (
            <>
              <div className="flex gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-[4px]" style={{ background: SERIES.cat[0] }} />New <b className="num">{nr.new}</b></span>
                <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-[4px]" style={{ background: SERIES.cat[1] }} />Returning <b className="num">{nr.returning}</b></span>
              </div>
              <div className="flex h-10 gap-[2px]" aria-hidden="true">
                {nr.new > 0 && <div className="rounded-s-lg" style={{ flex: nr.new, background: SERIES.cat[0] }} />}
                {nr.returning > 0 && <div className="rounded-e-lg" style={{ flex: nr.returning, background: SERIES.cat[1] }} />}
              </div>
            </>
          )}
        </section>

        <section className="card grid gap-2 p-4">
          <h3 className="font-sans text-[14px] font-semibold">Total sales by product today</h3>
          {data.products.length === 0 ? <p className="text-sm text-muted">No sales yet today</p> : (
            <ul className="grid text-[13px]">
              {data.products.map((p, i) => (
                <li key={`${p.name}-${p.option}`} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${i % 2 ? "" : "bg-cream/60"}`}>
                  <span className="min-w-0 truncate">{p.name}{p.option ? ` · ${p.option}` : ""}</span>
                  <span className="num shrink-0 font-medium">{fmtValue(p.sales, "money")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <LiveMap dots={data.dots} />
    </div>
  );
}
