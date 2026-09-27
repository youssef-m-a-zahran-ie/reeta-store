import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images are converted to WebP and resized in the browser before upload,
  // so we serve them straight from Supabase Storage.
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // One 404 for every URL, since the store and admin have separate root layouts.
    globalNotFound: true,
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
