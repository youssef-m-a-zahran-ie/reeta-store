"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { dict, type Lang } from "../i18n";

export type LatLng = { lat: number; lng: number };

const CAIRO: LatLng = { lat: 30.0444, lng: 31.2357 };

type SearchHit = { display_name: string; lat: string; lon: string };

/**
 * Map for the customer to drop a pin at their door.
 * OpenStreetMap tiles, Nominatim search. The store's own location is never shown.
 */
export function LocationPicker({
  lang,
  value,
  onChange,
  onAddress,
}: {
  lang: Lang;
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  onAddress?: (text: string) => void;
}) {
  const t = dict[lang].checkout;
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const cb = useRef({ onChange, onAddress });
  useEffect(() => {
    cb.current = { onChange, onAddress };
  }, [onChange, onAddress]);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Reverse geocode: suggest a street/area line for the pin.
  const reverse = async (p: LatLng) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=${lang}&lat=${p.lat}&lon=${p.lng}`,
      );
      const j = (await r.json()) as { address?: Record<string, string>; display_name?: string };
      const a = j.address ?? {};
      const parts = [a.road, a.neighbourhood ?? a.suburb ?? a.quarter, a.city_district ?? a.city ?? a.town ?? a.state].filter(Boolean);
      const text = parts.length ? parts.join(lang === "ar" ? "، " : ", ") : (j.display_name ?? "");
      if (text) cb.current.onAddress?.(text);
    } catch {
      // Offline or rate-limited: the customer types the address.
    }
  };

  const place = (p: LatLng, zoom?: number) => {
    const Lf = L.current;
    const m = map.current;
    if (!Lf || !m) return;
    if (!marker.current) {
      marker.current = Lf.marker([p.lat, p.lng], {
        draggable: true,
        keyboard: true,
        icon: Lf.divIcon({
          className: "",
          html: '<div class="reeta-pin"><span class="mark mark-inner"></span></div>',
          iconSize: [48, 58],
          iconAnchor: [24, 56],
        }),
      }).addTo(m);
      marker.current.on("dragend", () => {
        const ll = marker.current!.getLatLng();
        const v = { lat: ll.lat, lng: ll.lng };
        cb.current.onChange(v);
        void reverse(v);
      });
    } else {
      marker.current.setLatLng([p.lat, p.lng]);
    }
    m.setView([p.lat, p.lng], zoom ?? Math.max(m.getZoom(), 16), { animate: true });
    cb.current.onChange(p);
    void reverse(p);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      L.current = Lf;
      const start = value ?? CAIRO;
      const m = Lf.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : 11);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      if (value) place(value, 16);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; later pin changes go through place().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (q.trim().length < 3) return;
    setBusy("search");
    setMsg(null);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=eg&viewbox=30.7,30.4,31.8,29.7&bounded=0&accept-language=${lang}&q=${encodeURIComponent(q.trim())}`,
      );
      const j = (await r.json()) as SearchHit[];
      setHits(j);
      if (!j.length) setMsg(t.noResults);
    } catch {
      setMsg(t.noResults);
    }
    setBusy(null);
  }

  function locate() {
    if (!navigator.geolocation) {
      setMsg(t.locationDenied);
      return;
    }
    setBusy("locate");
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        place({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17);
      },
      () => {
        setBusy(null);
        setMsg(t.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 gap-2" role="search">
          <input
            className="input min-w-0 flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <button type="button" onClick={() => void search()} className="btn btn-secondary btn-sm shrink-0" disabled={busy !== null}>
            {busy === "search" ? t.searching : t.searchBtn}
          </button>
        </div>
        <button type="button" onClick={locate} className="btn btn-ghost btn-sm border-2 border-plum/20" disabled={busy !== null}>
          {busy === "locate" ? t.locating : t.myLocation}
        </button>
      </div>

      {hits && hits.length > 0 && (
        <ul className="grid gap-1 rounded-2xl border border-line bg-white p-1.5">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2 text-start text-sm hover:bg-blush"
                onClick={() => {
                  setHits(null);
                  place({ lat: Number(h.lat), lng: Number(h.lon) }, 17);
                }}
              >
                {h.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-sm font-medium text-[#a33a52]">{msg}</p>}

      <div className="relative overflow-hidden rounded-[22px] border border-line">
        <div ref={el} className="h-[320px] w-full bg-blush md:h-[360px]" dir="ltr" />
        {!value && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-full bg-plum/90 px-4 py-2 text-center text-sm font-medium text-blush">
            {t.mapHint}
          </div>
        )}
      </div>
    </div>
  );
}
