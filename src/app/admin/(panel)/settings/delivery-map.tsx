"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/form-bits";
import { egp } from "@/lib/format";
import { saveDelivery } from "./actions";

type Pt = { lat: number; lng: number };

function km(a: Pt, b: Pt) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Same formula as the database: straight line × road factor × price per km, rounded up, not below the minimum. */
function fee(distanceKm: number, perKm: number, min: number, round: number) {
  return Math.max(min, Math.ceil((distanceKm * perKm) / round) * round);
}

export function DeliverySettings({
  initial,
}: {
  initial: { lat: number | null; lng: number | null; perKm: number | null; min: number; factor: number; round: number };
}) {
  const [store, setStore] = useState<Pt | null>(initial.lat && initial.lng ? { lat: initial.lat, lng: initial.lng } : null);
  const [test, setTest] = useState<Pt | null>(null);
  const [mode, setMode] = useState<"store" | "test">(store ? "test" : "store");
  const [perKm, setPerKm] = useState(String(initial.perKm ?? ""));
  const [min, setMin] = useState(String(initial.min));
  const [factor, setFactor] = useState(String(initial.factor));
  const [round, setRound] = useState(String(initial.round));

  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const storeM = useRef<Leaflet.Marker | null>(null);
  const testM = useRef<Leaflet.Marker | null>(null);
  const line = useRef<Leaflet.Polyline | null>(null);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      L.current = Lf;
      const c = store ?? { lat: 30.0444, lng: 31.2357 };
      const m = Lf.map(el.current).setView([c.lat, c.lng], 11);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (modeRef.current === "store") setStore(p);
        else setTest(p);
      });
      map.current = m;
      setStore((s) => (s ? { ...s } : s));
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      storeM.current = testM.current = null;
      line.current = null;
    };
    // Created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep markers in sync with state.
  useEffect(() => {
    const Lf = L.current;
    const m = map.current;
    if (!Lf || !m) return;
    const icon = (cls: string) => Lf.divIcon({ className: "", html: `<div class="${cls}"><span class="mark mark-inner"></span></div>`, iconSize: [48, 58], iconAnchor: [24, 56] });
    if (store) {
      if (!storeM.current) {
        storeM.current = Lf.marker([store.lat, store.lng], { draggable: true, icon: icon("reeta-pin") }).addTo(m);
        storeM.current.on("dragend", () => {
          const ll = storeM.current!.getLatLng();
          setStore({ lat: ll.lat, lng: ll.lng });
        });
      } else storeM.current.setLatLng([store.lat, store.lng]);
    }
    if (test) {
      if (!testM.current) {
        testM.current = Lf.marker([test.lat, test.lng], { draggable: true, icon: icon("reeta-pin reeta-pin-test") }).addTo(m);
        testM.current.on("dragend", () => {
          const ll = testM.current!.getLatLng();
          setTest({ lat: ll.lat, lng: ll.lng });
        });
      } else testM.current.setLatLng([test.lat, test.lng]);
    }
    if (store && test) {
      const pts: [number, number][] = [
        [store.lat, store.lng],
        [test.lat, test.lng],
      ];
      if (!line.current) line.current = Lf.polyline(pts, { color: "#5b4659", weight: 3, dashArray: "2 8", lineCap: "round" }).addTo(m);
      else line.current.setLatLngs(pts);
    }
  }, [store, test]);

  const n = (v: string, d = 0) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);
  const dist = store && test ? km(store, test) * n(factor, 1.3) : null;
  const examples = [2, 5, 8, 12, 18, 25];

  return (
    <ActionForm action={saveDelivery} className="grid gap-5">
      {(state) => (
        <>
          <input type="hidden" name="store_lat" value={store?.lat ?? ""} />
          <input type="hidden" name="store_lng" value={store?.lng ?? ""} />

          <div className="flex flex-wrap gap-1 rounded-full bg-cocoa/5 p-1 text-sm" role="radiogroup" aria-label="What a map click does">
            {(
              [
                ["store", "Move the store pin"],
                ["test", "Test a customer location"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mode === k}
                onClick={() => setMode(k)}
                className="flex-1 rounded-full px-4 py-1.5 font-semibold text-plum aria-checked:bg-plum aria-checked:text-blush"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-[22px] border border-line">
            <div ref={el} className="h-[380px] w-full bg-blush" />
            {dist !== null && (
              <div className="absolute end-3 top-3 z-[500] grid gap-0.5 rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
                <span className="text-xs text-muted">Customer here pays</span>
                <span className="num font-display text-2xl font-semibold text-plum">{egp(fee(dist, n(perKm), n(min), Math.max(1, n(round, 5))))}</span>
                <span className="num text-xs text-muted">≈ {dist.toFixed(1)} km by road</span>
              </div>
            )}
          </div>
          <FieldError state={state} name="store_lat" />
          <p className="hint">
            Only you see the store pin. Customers only see their own pin and the fee. Click “Test a customer location” and tap anywhere to see what
            they&apos;d pay.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="field">
              <span className="label">Price per km</span>
              <input className="input num" name="fee_per_km" inputMode="decimal" value={perKm} onChange={(e) => setPerKm(e.target.value)} />
              <FieldError state={state} name="fee_per_km" />
            </label>
            <label className="field">
              <span className="label">Minimum fee</span>
              <input className="input num" name="min_shipping_fee" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
              <FieldError state={state} name="min_shipping_fee" />
            </label>
            <label className="field">
              <span className="label">Road factor</span>
              <input className="input num" name="distance_factor" inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} />
              <span className="hint">Roads are longer than a straight line. 1.3 fits Cairo well.</span>
              <FieldError state={state} name="distance_factor" />
            </label>
            <label className="field">
              <span className="label">Round up to</span>
              <input className="input num" name="fee_round_to" inputMode="numeric" value={round} onChange={(e) => setRound(e.target.value)} />
              <span className="hint">5 turns 92.7 into 95.</span>
              <FieldError state={state} name="fee_round_to" />
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <caption className="px-4 pt-3 text-start text-sm font-semibold text-plum">What customers pay by road distance</caption>
              <thead>
                <tr>
                  {examples.map((d) => (
                    <th key={d} className="num px-4 py-2 text-start font-medium text-muted">
                      {d} km
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  {examples.map((d) => (
                    <td key={d} className="num px-4 py-2.5 font-semibold text-plum">
                      {egp(fee(d, n(perKm), n(min), Math.max(1, n(round, 5))))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <SubmitButton pending="Saving…">Save delivery pricing</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
