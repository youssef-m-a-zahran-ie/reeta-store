import "server-only";
import { headers } from "next/headers";

/**
 * The origin for links in admin sign-in emails (magic link, password reset): the admin's own address when ADMIN_HOST is set
 * (e.g. https://admin.reeta-eg.com), else NEXT_PUBLIC_SITE_URL. Never taken from the request, so a forged X-Forwarded-Host
 * can't point reset links elsewhere.
 */
export async function requestOrigin() {
  const adminHost = process.env.ADMIN_HOST;
  if (adminHost) return `https://${adminHost}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
