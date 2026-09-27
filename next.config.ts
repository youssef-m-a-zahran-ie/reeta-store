import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images are converted to WebP and resized in the browser before upload,
  // so we serve them straight from Supabase Storage.
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
