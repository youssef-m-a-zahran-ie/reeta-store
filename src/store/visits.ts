"use client";

// Anonymous visit tracking for the admin's Analytics. Random ids in the browser, no personal data.
// A visit counts once a person interacts with the page, and ends after 30 minutes without activity. Add ?notrack=1 to any store link once, on a device, to leave it out for good
// (signing in to the admin does this automatically). Nothing is sent while the site runs on a developer's computer.

const VID = "reeta-vid";
const SID = "reeta-sid";
const OFF = "reeta-notrack";
const IDLE = 30 * 60 * 1000;

type Event = "page" | "cart" | "checkout" | "purchase" | "ping";
type Sess = { id: string; last: number; src?: string };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)));

function externalHost() {
  try {
    if (!document.referrer) return undefined;
    const h = new URL(document.referrer).hostname.replace(/^www\./, "");
    return h && h !== window.location.hostname ? h : undefined;
  } catch {
    return undefined;
  }
}

function isLocal() {
  if (process.env.NODE_ENV !== "production") return true;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h) || h.endsWith(".local");
}

/** Leaves this browser out of the store's visit numbers (used when the admin signs in). */
export function stopTracking() {
  try {
    window.localStorage.setItem(OFF, "1");
  } catch {}
}

// Crawlers (search engines, link previews, scanners) run the page like a browser and leave without touching it. A visit
// is only counted once a person shows up: a real tap, click, key, wheel or mouse move, or a cart/checkout/purchase.
// The answer is kept for the tab, so a page reload (like the order confirmation) counts straight away.
const HUMAN = "reeta-human";
const SIGNS = ["pointerdown", "touchstart", "keydown", "wheel", "mousemove"] as const;
let human: boolean | null = null;
let waiting: (() => void) | null = null;

function isHuman() {
  if (human === null) {
    try {
      human = window.sessionStorage.getItem(HUMAN) === "1";
    } catch {
      human = false;
    }
  }
  return human;
}

function markHuman() {
  if (isHuman()) return;
  human = true;
  try {
    window.sessionStorage.setItem(HUMAN, "1");
  } catch {}
  for (const s of SIGNS) window.removeEventListener(s, onSign, true);
  const w = waiting;
  waiting = null;
  w?.();
}

function onSign(e: globalThis.Event) {
  if (e.isTrusted) markHuman();
}

export function sendVisit(event: Event, opts: { orderId?: string } = {}) {
  if (typeof window === "undefined") return;
  if (event === "page" && !isHuman()) {
    // Hold the page view until a person shows up (only the latest page is kept).
    if (!waiting) for (const s of SIGNS) window.addEventListener(s, onSign, { capture: true, passive: true });
    waiting = () => record(event, opts);
    return;
  }
  if (event === "ping" && !isHuman()) return;
  if (event !== "page" && event !== "ping") markHuman();
  record(event, opts);
}

function record(event: Event, opts: { orderId?: string }) {
  try {
    if (isLocal()) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notrack") === "1") window.localStorage.setItem(OFF, "1");
    if (window.localStorage.getItem(OFF)) return;

    let vid = window.localStorage.getItem(VID);
    if (!vid) window.localStorage.setItem(VID, (vid = uuid()));

    const now = Date.now();
    let sess: Sess | null = null;
    try {
      sess = JSON.parse(window.localStorage.getItem(SID) ?? "null");
    } catch {
      sess = null;
    }
    const idle = !sess || now - sess.last > IDLE;

    // "Still here": keeps a live visit on the Live view without counting a page or extending the visit.
    if (event === "ping") {
      if (idle || !sess) return;
      post({ sid: sess.id, vid, event });
      return;
    }

    // Where this visit came from: this link's own tags, else the site that sent them.
    const us = url.searchParams.get("utm_source") || (url.searchParams.get("fbclid") ? "meta" : url.searchParams.get("ttclid") ? "tiktok" : url.searchParams.get("gclid") ? "google" : null);
    // Like Shopify, arriving from a different campaign starts a new visit.
    const fresh = idle || !sess || (!!us && us !== sess.src);
    const id = fresh || !sess ? uuid() : sess.id;
    window.localStorage.setItem(SID, JSON.stringify({ id, last: now, src: fresh ? us ?? undefined : sess?.src } satisfies Sess));

    const lang = document.documentElement.lang === "ar" ? "ar" : "en";
    const body: Record<string, unknown> = { sid: id, vid, event, path: url.pathname, lang, webdriver: navigator.webdriver === true };
    if (opts.orderId) body.oid = opts.orderId;
    if (fresh) {
      body.us = us ?? undefined;
      body.um = url.searchParams.get("utm_medium") ?? undefined;
      body.uc = url.searchParams.get("utm_campaign") ?? undefined;
      body.ref = externalHost();
    }
    post(body);
  } catch {
    // tracking is best effort
  }
}

function post(body: Record<string, unknown>) {
  const data = JSON.stringify(body);
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([data], { type: "application/json" })))) {
    void fetch("/api/t", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true });
  }
}
