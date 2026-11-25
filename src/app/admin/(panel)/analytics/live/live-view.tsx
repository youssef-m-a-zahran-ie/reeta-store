"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { fmtValue, pctChange, SERIES } from "@/lib/analytics/format";
import { Sparkline } from "@/components/analytics/charts";

type Step = "browsing" | "cart" | "checkout" | "purchased";

export type Live = {
  now: string; visitors: number; sessions: number; sessions_prev: number; orders: number; orders_prev: number; sales: number; sales_prev: number;
  carts: number; checkouts: number; purchased: number;
  spark: { sessions: number[]; orders: number[]; sales: number[] };
  funnel: { sessions: number; viewed: number; carted: number; checkout: number; purchased: number };
  live_visitors: {
    id: string; device: string; place: string; precise: boolean; path: string; since: string; pages: number;
    cart_value: number; cart_items: number; step: Step; source: string; lang: string;
  }[];
  open_carts: { id: string; place: string; precise: boolean; value: number; items: number; checkout: boolean; seen: string; live: boolean }[];
  feed: {
    at: string; type: string; path: string | null; product: string | null; option: string | null; qty: number | null; value: number | null;
    area: string | null; id: string; place: string; precise: boolean; device: string;
  }[];
  locations: { label: string; n: number }[];
  new_vs_returning: { new: number; returning: number };
  products: { name: string; option: string | null; sales: number }[];
  dots: { visitors: { lat: number; lng: number; city: string | null; precise?: boolean }[]; orders: { lat: number; lng: number; name: string }[] };
};

const VISITOR = "#cf5973";
const ORDER = "#7e387b";
const money = (n: number | null | undefined) => fmtValue(Number(n ?? 0), "money");

/** "/ar/shop" -> "Menu (Arabic)" */
function pageName(path: string | null | undefined) {
  if (!path) return "—";
  const ar = path === "/ar" || path.startsWith("/ar/");
  const p = ar ? path.slice(3) || "/" : path;
  const name =
    p === "/" ? "Home"
    : p.startsWith("/shop") ? "Menu"
    : p.startsWith("/checkout") ? "Checkout"
    : p.startsWith("/order/") ? "Order confirmation"
    : p.startsWith("/bundles") ? "Bundles"
    : p.startsWith("/products/") ? "Product page"
    : p.startsWith("/customize") ? "Build your own"
    : p.startsWith("/about") ? "About"
    : p.startsWith("/contact") ? "Contact"
    : p.startsWith("/policies") ? "Policies"
    : p;
  return ar ? `${name} (Arabic)` : name;
}

function ago(at: string, now: string) {
  const s = Math.max(0, Math.round((new Date(now).getTime() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function since(at: string, now: string) {
  const s = Math.max(0, Math.round((new Date(now).getTime() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function placeLabel(place: string, precise: boolean) {
  return precise ? place : `${place} (approx.)`;
}

function feedText(e: Live["feed"][number]) {
  const item = [e.product, e.option].filter(Boolean).join(" · ");
  const qty = e.qty && e.qty > 1 ? ` ×${e.qty}` : "";
  switch (e.type) {
    case "page": return `Opened ${pageName(e.path)}`;
    case "view_item": return `Looked at ${item || "a product"}`;
    case "add_to_cart": return `Added ${item || "a product"}${qty} to the cart${e.value ? ` (${money(e.value)})` : ""}`;
    case "remove_from_cart": return `Removed ${item || "a product"}${qty} from the cart`;
    case "cart_open": return "Opened the cart";
    case "checkout_start": return `Started checkout${e.value ? ` (${money(e.value)})` : ""}`;
    case "checkout_phone": return "Entered a phone number";
    case "checkout_location": return `Pinned the delivery location${e.area ? `: ${e.area}` : ""}`;
    case "purchase": return `Placed an order${e.value ? ` (${money(e.value)})` : ""}`;
    case "whatsapp": return "Tapped WhatsApp";
    case "lang": return "Switched language";
    default: return e.type;
  }
}

const STEP: Record<Step, { label: string; cls: string }> = {
  browsing: { label: "Browsing", cls: "bg-cream text-cocoa" },
  cart: { label: "Cart", cls: "bg-honey/35 text-cocoa" },
  checkout: { label: "Checkout", cls: "bg-rose/20 text-[#8a2f45]" },
  purchased: { label: "Ordered", cls: "bg-sage/25 text-[#3f4a2a]" },
};

const FEED_DOT: Record<string, string> = {
  add_to_cart: "bg-honey", remove_from_cart: "bg-cocoa/30", checkout_start: "bg-rose", checkout_phone: "bg-rose",
  checkout_location: "bg-rose", purchase: "bg-sage", whatsapp: "bg-sage", view_item: "bg-plum/60", cart_open: "bg-honey",
};

function Pill({ cur, prev }: { cur: number; prev: number }) {
  const d = pctChange(cur, prev);
  if (d === null) return null;
  return <span className="chip num bg-cocoa/10 px-2 text-cocoa"><span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "•"}</span><span className="sr-only">{d > 0 ? "Up" : d < 0 ? "Down" : "No change"}</span>{Math.abs(d)}%</span>;
}

function Tile({ title, value, pill, spark, hint }: { title: string; value: string; pill?: React.ReactNode; spark?: number[]; hint?: string }) {
  return (
    <div className="card grid gap-1 p-4">
      <h3 className="font-sans text-[14px] font-semibold">{title}</h3>
      <div className="flex flex-wrap items-center gap-2"><span className="num text-[22px] leading-none font-medium">{value}</span>{pill}</div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {spark && <Sparkline values={spark} width={140} height={28} />}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card grid content-start gap-3 p-4">
      <div className="grid gap-0.5">
        <h3 className="font-sans text-[14px] font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Funnel({ f }: { f: Live["funnel"] }) {
  const steps: [string, number][] = [
    ["Visits", f.sessions], ["Looked at a product", f.viewed], ["Added to cart", f.carted], ["Reached checkout", f.checkout], ["Ordered", f.purchased],
  ];
  const top = Math.max(1, f.sessions);
  return (
    <ol className="grid gap-2.5">
      {steps.map(([label, n], i) => {
        const prev = i === 0 ? null : steps[i - 1][1];
        const pct = prev ? Math.round((n / prev) * 100) : null;
        return (
          <li key={label} className="grid gap-1 text-[13px]">
            <div className="flex justify-between gap-3">
              <span>{label}</span>
              <span className="num font-medium">{n}{pct !== null && <span className="ms-2 text-xs font-normal text-muted">{pct}% of previous</span>}</span>
            </div>
            <div className="h-2 rounded-full bg-cream/70" aria-hidden="true">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(n ? 2 : 0, (n / top) * 100)}%`, background: SERIES.main }} />
            </div>
          </li>
        );
      })}
    </ol>
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
    for (const v of dots.visitors) {
      Lf.circleMarker([v.lat, v.lng], { radius: v.precise ? 8 : 7, color: "#fff", weight: 2, fillColor: VISITOR, fillOpacity: v.precise ? 0.95 : 0.55 })
        .bindTooltip(v.precise ? `${v.city ?? "Visitor"} (pinned at checkout)` : `${v.city ?? "Visitor"} (approx.)`).addTo(g);
      pts.push([v.lat, v.lng]);
    }
    for (const o of dots.orders) { Lf.circleMarker([o.lat, o.lng], { radius: 9, color: "#fff", weight: 2, fillColor: ORDER, fillOpacity: 0.95 }).bindTooltip(`Order ${o.name}`).addTo(g); pts.push([o.lat, o.lng]); }
    if (pts.length && !fitted.current) {
      m.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });
      fitted.current = true;
    }
  }, [dots, ready]);

  return (
    <div className="relative min-h-[380px] overflow-hidden rounded-[22px] border border-line lg:min-h-[460px]">
      <div ref={el} className="absolute inset-0" role="img" aria-label="Map of visitors right now and today's orders" />
      <div className="pointer-events-none absolute start-3 bottom-3 z-[500] flex flex-wrap gap-3 rounded-2xl bg-white/95 px-3 py-1.5 text-xs shadow">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full" style={{ background: ORDER }} />Orders today</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full" style={{ background: VISITOR }} />Visitors now</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-full opacity-55" style={{ background: VISITOR }} />Faded = approximate area</span>
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
    <div className="grid gap-4">
      <Freshness key={data.now} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile title="Visitors right now" value={String(data.visitors)} hint="Active in the last 90 seconds" />
        <Tile title="Total sales today" value={money(data.sales)} pill={<Pill cur={data.sales} prev={data.sales_prev} />} spark={data.spark.sales} />
        <Tile title="Visits today" value={String(data.sessions)} pill={<Pill cur={data.sessions} prev={data.sessions_prev} />} spark={data.spark.sessions} />
        <Tile title="Orders today" value={String(data.orders)} pill={<Pill cur={data.orders} prev={data.orders_prev} />} spark={data.spark.orders} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Card title="On the store right now" hint="Each visitor's page, cart and step. Places marked (approx.) come from their network; pinned ones from checkout.">
            {data.live_visitors.length === 0 ? <p className="text-sm text-muted">Nobody right now</p> : (
              <ul className="grid gap-2">
                {data.live_visitors.map((v) => (
                  <li key={v.id} className="grid gap-1.5 rounded-2xl border border-line p-3 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{pageName(v.path)}</span>
                      <span className={`chip px-2.5 ${STEP[v.step].cls}`}>{STEP[v.step].label}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
                      <span>{placeLabel(v.place, v.precise)}</span>
                      <span>{v.device === "mobile" ? "Phone" : v.device === "tablet" ? "Tablet" : "Computer"}</span>
                      <span className="num">{since(v.since, data.now)} on site · {v.pages} {v.pages === 1 ? "page" : "pages"}</span>
                      <span>From {v.source}</span>
                    </div>
                    {v.cart_items > 0 && <div className="num font-medium text-plum">Cart: {v.cart_items} {v.cart_items === 1 ? "pouch" : "pouches"} · {money(v.cart_value)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Open carts" hint="Carts with something in them, active in the last 30 minutes, not ordered yet.">
            {data.open_carts.length === 0 ? <p className="text-sm text-muted">No open carts</p> : (
              <ul className="grid text-[13px]">
                {data.open_carts.map((c, i) => (
                  <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 ${i % 2 ? "" : "bg-cream/60"}`}>
                    <span className="min-w-0">
                      <span className="num font-medium">{money(c.value)}</span>
                      <span className="text-muted"> · {c.items} {c.items === 1 ? "pouch" : "pouches"} · {placeLabel(c.place, c.precise)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {c.checkout && <span className="chip bg-rose/20 px-2 text-[#8a2f45]">At checkout</span>}
                      {c.live ? <span className="text-[#3f4a2a]">Here now</span> : <span>Left {ago(c.seen, data.now)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Today's funnel" hint="Visits today and how far they got.">
            <Funnel f={data.funnel} />
          </Card>

          <Card title="Customer behavior" hint="Right now (last 30 minutes) and today.">
            <div className="grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse">
              {[["Active carts", data.carts], ["Checking out", data.checkouts], ["Ordered today", data.purchased]].map(([label, n]) => (
                <div key={label} className="grid content-start gap-2 px-3 first:ps-0">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="num text-[20px] leading-none font-medium">{n}</span>
                  <span className="flex flex-wrap gap-1">{dots(Number(n))}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <LiveMap dots={data.dots} />

          <Card title="What's happening" hint="Every step shoppers took today, newest first.">
            {data.feed.length === 0 ? <p className="text-sm text-muted">Nothing yet today</p> : (
              <ol className="grid gap-0.5 text-[13px]">
                {data.feed.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-cream/50">
                    <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${FEED_DOT[e.type] ?? "bg-cocoa/25"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block">{feedText(e)}</span>
                      <span className="block text-xs text-muted">{placeLabel(e.place, e.precise)} · visitor {e.id}</span>
                    </span>
                    <span className="num shrink-0 text-xs text-muted">{ago(e.at, data.now)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Visits by place today">
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
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="New vs returning customers">
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
            </Card>
            <Card title="Sales by product today">
              {data.products.length === 0 ? <p className="text-sm text-muted">No sales yet today</p> : (
                <ul className="grid text-[13px]">
                  {data.products.map((p, i) => (
                    <li key={`${p.name}-${p.option}`} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${i % 2 ? "" : "bg-cream/60"}`}>
                      <span className="min-w-0 truncate">{p.name}{p.option ? ` · ${p.option}` : ""}</span>
                      <span className="num shrink-0 font-medium">{money(p.sales)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
