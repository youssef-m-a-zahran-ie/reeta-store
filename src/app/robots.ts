import type { MetadataRoute } from "next";
import { SITE_URL } from "@/store/meta";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/order", "/ar/checkout", "/ar/order"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
