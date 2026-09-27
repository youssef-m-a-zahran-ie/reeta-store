// OpenNext adapter config for Cloudflare Workers.
// No incremental cache for now: admin pages are dynamic and the store is small.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
