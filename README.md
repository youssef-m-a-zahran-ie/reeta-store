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
| 3 · Storefront pages (EN + AR), cart | ✅ |
| 4 · Checkout, delivery fee, orders, emails, admin orders and settings | ✅ |
| 5 · Rest of the admin (customers, bundles, discounts, content, inbox, manual orders, packing slips) | ✅ |
| 6 · Dashboard, reports, ad spend, pixels | ✅ |
| 7 · QA and launch | next |

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

## Orders

- Checkout sends the cart to `place_order` in the database, which re-prices everything, checks stock, applies the discount, computes delivery and takes the stock off in one transaction. The browser can't change a price.
- Delivery fee = straight-line km from the store × road factor × price per km, rounded up, never below the minimum. The store location never leaves the database. Settings → Delivery has a calculator.
- New-order emails go out from the database through Resend. The API key is in Supabase Vault as `resend_api_key`.

## Admin access

1. Open `/admin/login` → **First time? Set up account** → use `reetadeserts@gmail.com`.
2. Confirm from the email, then sign in.

To add another admin: `insert into public.admins (email) values ('name@example.com');`

## Deploy to Cloudflare

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `reeta-store`.
2. Build command: `npx opennextjs-cloudflare build` · Deploy command: `npx opennextjs-cloudflare deploy`.
3. In Supabase → **Authentication → URL Configuration**, set the Site URL to the live address and add `https://<your-domain>/**` to the redirect URLs, so email links open the site.

## The Atelier (make your own)

Shoppers compose a pouch at `/customize` (`/ar/customize`): a nut, a coating and a size. A live stage shows the coating pouring onto the nut, then the bowl filling up for the size picked.

- **Admin → Atelier:** weights, prices and costs per nut and size; what each coating adds per size; which nuts, coatings and sizes are offered; on/off switch. Price = nut at that size + coating at that size (same for cost).
- **Stock:** Admin → Inventory → Atelier. Nuts and coatings are tracked in grams; each nut's coating share splits a pouch's weight between them. "Sell out when it runs out" is off until real stock is entered.
- **Orders:** `place_order` prices made-to-order lines itself (cart id `<base>.<coating>.<size>`), snapshots name, price and cost, and takes stock through `stock_movements` like any product.
- **Photos:** `public/atelier/`, listed in `src/store/customize/visuals.ts`. A new nut or coating needs its photo set there before it can be offered. The bowl's logo is drawn from `public/brand/mark-full.png`, so a new logo shows on the bowl too.
- The page and the nav link appear only when the Atelier is on and at least one nut and one coating are priced in the same size.

## Ads and tracking

- Ad links carry `?utm_source=meta|tiktok|google&utm_medium=paid&utm_campaign=<name>`. Instagram and Facebook links can use `instagram` or `facebook` too; they count as Meta.
- Ad spend is entered by hand in Admin → Ad spend (one row per platform and period). Reports split a period's spend across its days and compare it with sales from that platform's links.
- Pixel IDs (Meta, TikTok, GA4) live in Admin → Settings → Tracking. The store sends PageView, ViewContent, AddToCart, InitiateCheckout and Purchase (once per order, event id = order id).
- All report numbers come from `admin_report(from, to)` in the database, in Cairo time.
