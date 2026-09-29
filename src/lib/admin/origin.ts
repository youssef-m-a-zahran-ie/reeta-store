import "server-only";
import { headers } from "next/headers";

/**
 * The site origin for links in auth emails, e.g. https://reeta.store
 * Uses NEXT_PUBLIC_SITE_URL when set, so a forged X-Forwarded-Host can't point reset links elsewhere.
 */
export async function requestOrigin() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
