"use client";

// Detailed shopper actions for the Live view (opened a product, added to cart, started checkout, pinned a location...).
// They go straight to the database (track_events), not through the site's worker, and only for a tracked visit
// (see visits.ts: a person, not local, not opted out). The visit row itself is created by the first page view.

import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { currentVisit, isPerson, touchVisit, visitReady } from "./visits";

export type ShopEvent =
  | "heartbeat" | "view_item" | "add_to_cart" | "remove_from_cart" | "cart_open"
  | "checkout_start" | "checkout_phone" | "checkout_location" | "purchase" | "whatsapp" | "lang";

type Payload = { n?: string; o?: string | null; q?: number; v?: number; oid?: string; area?: string; lat?: number; lng?: number };
type Queued = { t: ShopEvent; p: string } & Payload;

const MAX_QUEUE = 40;
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/** What's in the cart right now (value and number of pouches), read from the cart's own storage. */
function cartSnapshot() {
  try {
    const items = JSON.parse(window.localStorage.getItem("reeta-cart-v1") ?? "[]") as { price?: number; qty?: number }[];
    if (!Array.isArray(items)) return null;
    let v = 0;
    let i = 0;
    for (const it of items) {
      if (typeof it?.price === "number" && typeof it?.qty === "number" && it.qty > 0) {
        v += it.price * it.qty;
        i += it.qty;
      }
    }
    return { v: Math.round(v * 100) / 100, i: Math.min(i, 999) };
  } catch {
    return null;
  }
}

/** Records one action. Sent in a small batch a moment later, or right away when `now` is set (leaving the page). */
export function logEvent(t: ShopEvent, data: Payload = {}, now = false) {
  if (typeof window === "undefined") return;
  const e: Queued = { t, p: window.location.pathname, ...data };
  if (e.o === null) delete e.o;
  if (e.n) e.n = e.n.slice(0, 120);
  if (e.o) e.o = e.o.slice(0, 120);
  queue.push(e);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (now) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 700);
}

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (sending || !queue.length) return;
  // Before a person has shown up, keep the actions for when they do (bots never get there).
  if (!isPerson()) return;
  sending = true;
  try {
    await Promise.race([visitReady(), new Promise((r) => setTimeout(r, 4000))]);
    const visit = currentVisit();
    if (!visit) {
      queue = [];
      return;
    }
    while (queue.length) {
      const batch = queue.splice(0, 20);
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_events`, {
        method: "POST",
        keepalive: true,
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_session: visit.sid, p_visitor: visit.vid, p_events: batch, p_cart: cartSnapshot() }),
      }).catch(() => undefined);
    }
  } finally {
    sending = false;
  }
}

/* ---------- "still here" ---------- */

const HEARTBEAT = 30_000;
const ACTIVE_FOR = 10 * 60_000;
let lastActive = 0;
let started = false;

function onActivity(e: Event) {
  if (e.isTrusted) lastActive = Date.now();
}

/**
 * While the page is on screen and the person did something in the last 10 minutes, tell the Live view every 30 seconds
 * that they're still here (and once at 12 seconds, which is when a visit starts to count). Returns a stop function.
 */
export function startLiveSignals() {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  lastActive = Date.now();
  const signs = ["pointerdown", "touchstart", "keydown", "wheel", "scroll", "mousemove"] as const;
  for (const s of signs) window.addEventListener(s, onActivity, { capture: true, passive: true });

  const beat = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastActive > ACTIVE_FOR) return;
    touchVisit();
    logEvent("heartbeat", {}, true);
  };
  const first = setTimeout(beat, 12_000);
  const every = setInterval(beat, HEARTBEAT);
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  document.addEventListener("visibilitychange", onHide);

  // Links that leave the page: WhatsApp and the language switch.
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (/wa\.me|whatsapp/i.test(href)) logEvent("whatsapp", {}, true);
    else if (a.hasAttribute("hreflang")) logEvent("lang", { n: a.getAttribute("hreflang") ?? undefined }, true);
  };
  document.addEventListener("click", onClick, { capture: true });

  return () => {
    started = false;
    clearTimeout(first);
    clearInterval(every);
    for (const s of signs) window.removeEventListener(s, onActivity, true);
    document.removeEventListener("visibilitychange", onHide);
    document.removeEventListener("click", onClick, true);
  };
}
