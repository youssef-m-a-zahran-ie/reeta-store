"use client";

// Anonymous visit tracking for the admin's Analytics. Random ids in the browser, no personal data.
// A visit ends after 30 minutes without activity. Add ?notrack=1 to any store link once, on a device, to leave it out for good.

const VID = "reeta-vid";
const SID = "reeta-sid";
const OFF = "reeta-notrack";
const IDLE = 30 * 60 * 1000;

type Event = "page" | "cart" | "checkout" | "purchase";

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

export function sendVisit(event: Event, lang: "en" | "ar" = document.documentElement.lang === "ar" ? "ar" : "en") {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("notrack") === "1") window.localStorage.setItem(OFF, "1");
    if (window.localStorage.getItem(OFF)) return;

    let vid = window.localStorage.getItem(VID);
    if (!vid) window.localStorage.setItem(VID, (vid = uuid()));

    const now = Date.now();
    let sess: { id: string; last: number } | null = null;
    try {
      sess = JSON.parse(window.localStorage.getItem(SID) ?? "null");
    } catch {
      sess = null;
    }
    const fresh = !sess || now - sess.last > IDLE;
    const id = fresh || !sess ? uuid() : sess.id;
    window.localStorage.setItem(SID, JSON.stringify({ id, last: now }));

    const body: Record<string, unknown> = { sid: id, vid, event, path: url.pathname, lang, webdriver: navigator.webdriver === true };
    if (fresh) {
      // Where this visit came from: this link's own tags, else the site that sent them.
      const us = url.searchParams.get("utm_source") || (url.searchParams.get("fbclid") ? "meta" : url.searchParams.get("ttclid") ? "tiktok" : url.searchParams.get("gclid") ? "google" : null);
      body.us = us ?? undefined;
      body.um = url.searchParams.get("utm_medium") ?? undefined;
      body.uc = url.searchParams.get("utm_campaign") ?? undefined;
      body.ref = externalHost();
    }
    const data = JSON.stringify(body);
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([data], { type: "application/json" })))) {
      void fetch("/api/t", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    // tracking is best effort
  }
}
