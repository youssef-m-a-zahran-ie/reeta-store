"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track, trackPurchaseOnce, type TrackItem } from "../analytics";

/** In-app navigation doesn't reload the page, so tell the pixels about each new page. */
export function PixelPageViews() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const w = window as Window & { fbq?: (...a: unknown[]) => void; ttq?: { page: () => void } };
    try {
      w.fbq?.("track", "PageView");
      w.ttq?.page();
    } catch {}
  }, [path]);
  return null;
}

export function TrackView({ item }: { item: TrackItem }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // Give the pixel scripts a moment to load on a fresh visit.
    const t = setTimeout(() => track("view_item", { items: [item] }), 800);
    return () => clearTimeout(t);
  }, [item]);
  return null;
}

export function TrackPurchase({ orderId, orderNumber, value, items }: { orderId: string; orderNumber: number; value: number; items: TrackItem[] }) {
  useEffect(() => {
    const t = setTimeout(() => trackPurchaseOnce(orderId, () => track("purchase", { items, value, orderId, orderNumber })), 800);
    return () => clearTimeout(t);
  }, [orderId, orderNumber, value, items]);
  return null;
}
