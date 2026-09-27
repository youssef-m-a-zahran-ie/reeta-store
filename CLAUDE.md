@AGENTS.md

# Reeta store: working notes

Custom e-commerce site + admin for Reeta (chocolate-coated nuts), Cairo & Giza. Owner talks in Egyptian Arabic.

## Where things live
- **Code:** this repo, `main` deploys to Cloudflare Workers (OpenNext) automatically.
- **Live:** https://reeta-store.youssef-m-a-zahran.workers.dev · admin at `/admin` (admin email: reetadeserts@gmail.com).
- **Database:** Supabase project `reeta` (`bojrqzhsgzahskomgwki`, Frankfurt). Change it with migrations in `supabase/migrations`, apply them, then regenerate `src/lib/supabase/database.types.ts`.
- **Plan:** phases 0–7 are listed in `README.md`.

## Rules that matter
- Brand only: colors from the Reeta palette (plum, blush, cream, cocoa, toffee, sage, honey, rose), fonts Fredoka + Figtree (English), Baloo Bhaijaan 2 + Readex Pro (Arabic). Buttons are pill-shaped. Accents never for body text.
- Every table has RLS; admin = email in `public.admins`. Every server action calls `assertAdmin()`.
- Shoppers read only through `store_*` SQL functions (no costs, no stock numbers, no drafts).
- Stock changes only through `stock_movements`. Orders snapshot price and cost.
- Store pages exist twice: `src/app/(en)/…` and `src/app/ar/…` are thin wrappers around `src/store/views`. Copy lives in `src/store/i18n.ts` and in `content_blocks`.
- The sandbox can't reach Supabase over HTTP: test SQL through the Supabase connector, and render pages against a local mock when checking visuals.
