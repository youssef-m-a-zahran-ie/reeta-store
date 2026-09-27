# Reeta store

The Reeta e-commerce site and its admin, on one domain.

- **Stack:** Next.js 16 (App Router) · Supabase (database, auth, image storage) · Cloudflare Workers via OpenNext
- **Brand:** colors, fonts and logo layers follow the Reeta Brand Guidelines v1.0 (`src/app/globals.css`, `public/brand/`)

## What's built

| Phase | Status |
|---|---|
| 0 · Setup (project, Supabase, Cloudflare config, brand tokens) | ✅ |
| 1 · Prototype (Orbit hero, pouch cards, cart ring) | ✅ separate artifact |
| 2 · Database, admin sign-in, Catalog, Inventory | ✅ |
| 3 · Storefront pages | next |
| 4 · Cart, checkout, orders, emails | |
| 5 · Rest of the admin (orders, customers, bundles, discounts, content, settings) | |
| 6 · Dashboard, reports, ad spend, pixels | |
| 7 · QA and launch | |

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000, admin at /admin
npm run preview      # production build running in the Cloudflare runtime
```

`.env.production` holds the Supabase URL and publishable key. Both are public by design; the database is protected by Row Level Security.

## Database

Migrations live in `supabase/migrations` and are already applied to the `reeta` project (Frankfurt).

- Every table has RLS on. The admin is any signed-in user whose email is in `public.admins`.
- Stock only changes through `stock_movements`; a trigger updates the balance.
- Orders keep a snapshot of name, price and cost at the time of sale.
- After changing the schema, regenerate `src/lib/supabase/database.types.ts`.

## Admin access

1. Open `/admin/login` → **First time? Set up account** → use `reetadeserts@gmail.com`.
2. Confirm from the email, then sign in.

To add another admin: `insert into public.admins (email) values ('name@example.com');`

## Deploy to Cloudflare

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `reeta-store`.
2. Build command: `npx opennextjs-cloudflare build` · Deploy command: `npx opennextjs-cloudflare deploy`.
3. In Supabase → **Authentication → URL Configuration**, set the Site URL to the live address and add `https://<your-domain>/**` to the redirect URLs, so email links open the site.
