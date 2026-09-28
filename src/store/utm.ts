"use client";

const KEY = "reeta-utm-v1";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Remembers where the visitor came from (last ad click wins) so the order can be credited to it. */
export function captureUtm() {
  try {
    const url = new URL(window.location.href);
    const found: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = url.searchParams.get(f);
      if (v) found[f] = v.slice(0, 150);
    }
    if (!found.utm_source && url.searchParams.get("fbclid")) found.utm_source = "meta";
    if (!found.utm_source && url.searchParams.get("ttclid")) found.utm_source = "tiktok";
    if (!found.utm_source && url.searchParams.get("gclid")) found.utm_source = "google";
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : "";
    if (Object.keys(found).length || ref) {
      const prev = readUtm();
      const next = Object.keys(found).length ? { ...found, referrer: ref || prev.referrer } : { ...prev, referrer: prev.referrer || ref };
      window.localStorage.setItem(KEY, JSON.stringify({ ...next, at: Date.now() }));
    }
  } catch {
    // storage blocked: attribution is best effort
  }
}

export function readUtm(): Record<string, string | undefined> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as Record<string, string> & { at?: number };
    // Forget attribution after 30 days.
    if (v.at && Date.now() - v.at > 30 * 24 * 3600 * 1000) return {};
    return v;
  } catch {
    return {};
  }
}
