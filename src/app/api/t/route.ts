import { createClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Visit tracking for the store. The browser sends ids, an event and the page; this adds device class, bot flag and
// city-level location from the request itself. No IP address is stored. The database function validates everything again.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["page", "cart", "checkout", "purchase", "ping"]);
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python|axios|node-fetch|go-http|java\//i;

const text = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

function deviceOf(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 2000) return new Response(null, { status: 413 });
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const sid = typeof b.sid === "string" && UUID.test(b.sid) ? b.sid : null;
  const vid = typeof b.vid === "string" && UUID.test(b.vid) ? b.vid : null;
  const event = typeof b.event === "string" && EVENTS.has(b.event) ? b.event : null;
  if (!sid || !vid || !event) return new Response(null, { status: 400 });
  // A purchase must name its order; the database checks it is real and recent.
  const oid = typeof b.oid === "string" && UUID.test(b.oid) ? b.oid : undefined;
  if (event === "purchase" && !oid) return new Response(null, { status: 400 });

  const ua = req.headers.get("user-agent") ?? "";
  let cf: Record<string, unknown> | undefined;
  try {
    cf = getCloudflareContext().cf as Record<string, unknown> | undefined;
  } catch {
    cf = undefined; // local dev without the Cloudflare runtime
  }
  const country = text(cf?.country, 2) ?? text(req.headers.get("cf-ipcountry"), 2);
  const lat = Number(cf?.latitude);
  const lng = Number(cf?.longitude);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.rpc("track_visit", {
    p_session: sid,
    p_visitor: vid,
    p_event: event,
    p_path: text(b.path, 200) ?? "/",
    p_device: deviceOf(ua),
    p_bot: !ua || BOT.test(ua) || b.webdriver === true,
    p_country: countryName(country) ?? undefined,
    p_region: text(cf?.region, 80) ?? undefined,
    p_city: text(cf?.city, 80) ?? undefined,
    p_lat: Number.isFinite(lat) && cf?.latitude != null ? lat : undefined,
    p_lng: Number.isFinite(lng) && cf?.longitude != null ? lng : undefined,
    p_referrer: text(b.ref, 120) ?? undefined,
    p_utm_source: text(b.us, 80) ?? undefined,
    p_utm_medium: text(b.um, 80) ?? undefined,
    p_utm_campaign: text(b.uc, 120) ?? undefined,
    p_lang: b.lang === "ar" ? "ar" : "en",
    p_order: oid,
  });
  return new Response(null, { status: error ? 502 : 204, headers: { "Cache-Control": "no-store" } });
}
