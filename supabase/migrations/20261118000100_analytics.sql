-- Visitor sessions + a small report engine (Shopify-style analytics), all in the database.
-- No personal data is stored: random ids, device class and city-level location only. Days and hours are Cairo time.

-- ---------------------------------------------------------------
-- Sessions (one row per visit; the storefront reports in through track_visit)
-- ---------------------------------------------------------------
create table public.analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  device text not null default 'desktop' check (device in ('mobile', 'desktop', 'tablet')),
  is_bot boolean not null default false,
  country text,
  region text,
  city text,
  lat double precision,
  lng double precision,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_path text not null default '/',
  lang text not null default 'en',
  pageviews int not null default 1,
  carted_at timestamptz,
  checkout_at timestamptz,
  purchased_at timestamptz
);
create index analytics_sessions_started_idx on public.analytics_sessions (started_at desc);
create index analytics_sessions_seen_idx on public.analytics_sessions (last_seen_at desc);

alter table public.analytics_sessions enable row level security;
create policy "admin full access" on public.analytics_sessions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- The storefront's only way in. Shoppers can't read or edit sessions; this validates and trims everything.
create or replace function public.track_visit(
  p_session uuid, p_visitor uuid, p_event text, p_path text,
  p_device text default 'desktop', p_bot boolean default false,
  p_country text default null, p_region text default null, p_city text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_referrer text default null, p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null, p_lang text default 'en'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device text := case when p_device in ('mobile', 'desktop', 'tablet') then p_device else 'desktop' end;
  v_lang text := case when p_lang = 'ar' then 'ar' else 'en' end;
  v_path text := left(coalesce(nullif(p_path, ''), '/'), 200);
begin
  if p_session is null or p_visitor is null then return; end if;
  if p_event not in ('page', 'cart', 'checkout', 'purchase') then return; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180) then
    p_lat := null; p_lng := null;
  end if;

  insert into public.analytics_sessions as s (
    id, visitor_id, device, is_bot, country, region, city, lat, lng, referrer_host,
    utm_source, utm_medium, utm_campaign, landing_path, lang, carted_at, checkout_at, purchased_at
  ) values (
    p_session, p_visitor, v_device, coalesce(p_bot, false),
    left(p_country, 80), left(p_region, 80), left(p_city, 80), p_lat, p_lng, left(p_referrer, 120),
    left(p_utm_source, 80), left(p_utm_medium, 80), left(p_utm_campaign, 120), v_path, v_lang,
    case when p_event = 'cart' then now() end,
    case when p_event = 'checkout' then now() end,
    case when p_event = 'purchase' then now() end
  )
  on conflict (id) do update set
    last_seen_at = now(),
    pageviews = s.pageviews + case when p_event = 'page' then 1 else 0 end,
    carted_at = coalesce(s.carted_at, case when p_event = 'cart' then now() end),
    checkout_at = coalesce(s.checkout_at, case when p_event = 'checkout' then now() end),
    purchased_at = coalesce(s.purchased_at, case when p_event = 'purchase' then now() end)
  where s.visitor_id = p_visitor;
end;
$$;
revoke execute on function public.track_visit(uuid, uuid, text, text, text, boolean, text, text, text, double precision, double precision, text, text, text, text, text) from public;
grant execute on function public.track_visit(uuid, uuid, text, text, text, boolean, text, text, text, double precision, double precision, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Row sources for the engine (run as the signed-in admin, so RLS applies)
-- ---------------------------------------------------------------
create or replace function public._an_orders(p_from date, p_to date)
returns table (
  id uuid, d date, wk date, mo date, hr int, dow int, status text, kept boolean,
  gross numeric, discounts numeric, shipping numeric, total numeric, cost numeric, has_cost boolean, items int,
  channel text, payment text, code text, cust text, distance text, order_name text, customer_id uuid
)
language sql
stable
set search_path = ''
as $$
  select o.id,
    (o.created_at at time zone 'Africa/Cairo')::date,
    date_trunc('week', o.created_at at time zone 'Africa/Cairo')::date,
    date_trunc('month', o.created_at at time zone 'Africa/Cairo')::date,
    extract(hour from o.created_at at time zone 'Africa/Cairo')::int,
    extract(isodow from o.created_at at time zone 'Africa/Cairo')::int,
    o.status::text,
    o.status not in ('cancelled', 'refused'),
    o.subtotal, o.discount_total, o.shipping_fee, o.total,
    coalesce((select sum(i.unit_cost * i.qty) from public.order_items i where i.order_id = o.id), 0),
    coalesce((select bool_and(i.unit_cost is not null) from public.order_items i where i.order_id = o.id), true),
    coalesce((select sum(i.qty) from public.order_items i where i.order_id = o.id), 0)::int,
    coalesce(nullif(lower(o.utm_source), ''), case when o.source = 'web' then 'direct' else o.source end),
    o.payment_method::text,
    o.discount_code,
    case when exists (select 1 from public.orders e where e.customer_id = o.customer_id and e.created_at < o.created_at
                      and e.status not in ('cancelled', 'refused')) then 'returning' else 'new' end,
    case when o.distance_km is null then 'No location'
         when o.distance_km < 5 then 'Under 5 km' when o.distance_km < 10 then '5–10 km'
         when o.distance_km < 15 then '10–15 km' when o.distance_km < 25 then '15–25 km' else '25 km+' end,
    '#' || o.number::text,
    o.customer_id
  from public.orders o
  where (o.created_at at time zone 'Africa/Cairo')::date between p_from and p_to;
$$;

create or replace function public._an_items(p_from date, p_to date)
returns table (
  d date, wk date, mo date, order_id uuid, kept boolean, product text, option text, kind text,
  qty int, gross numeric, disc numeric, cost numeric, grams numeric
)
language sql
stable
set search_path = ''
as $$
  select (o.created_at at time zone 'Africa/Cairo')::date,
    date_trunc('week', o.created_at at time zone 'Africa/Cairo')::date,
    date_trunc('month', o.created_at at time zone 'Africa/Cairo')::date,
    o.id,
    o.status not in ('cancelled', 'refused'),
    i.name_en,
    coalesce(i.option_label, '–'),
    case when i.bundle_id is not null then 'bundle' else 'product' end,
    i.qty, i.line_total,
    -- an order's discount is shared between its lines by value
    case when o.subtotal > 0 then o.discount_total * i.line_total / o.subtotal else 0 end,
    coalesce(i.unit_cost, 0) * i.qty,
    coalesce(i.grams, 0) * i.qty
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where (o.created_at at time zone 'Africa/Cairo')::date between p_from and p_to;
$$;

create or replace function public._an_sessions(p_from date, p_to date)
returns table (
  visitor_id uuid, d date, wk date, mo date, hr int, dow int, device text, country text, region text, city text,
  location text, referrer text, source text, landing text, lang text, pv int, carted boolean, checkout boolean, purchased boolean
)
language sql
stable
set search_path = ''
as $$
  select s.visitor_id,
    (s.started_at at time zone 'Africa/Cairo')::date,
    date_trunc('week', s.started_at at time zone 'Africa/Cairo')::date,
    date_trunc('month', s.started_at at time zone 'Africa/Cairo')::date,
    extract(hour from s.started_at at time zone 'Africa/Cairo')::int,
    extract(isodow from s.started_at at time zone 'Africa/Cairo')::int,
    s.device,
    coalesce(s.country, 'Unknown'), coalesce(s.region, 'Unknown'), coalesce(s.city, 'Unknown'),
    coalesce(s.country, 'Unknown') || ' · ' || coalesce(s.region, 'Unknown') || ' · ' || coalesce(s.city, 'Unknown'),
    coalesce(s.referrer_host, 'direct'),
    coalesce(nullif(lower(s.utm_source), ''), s.referrer_host, 'direct'),
    s.landing_path, s.lang, s.pageviews,
    s.carted_at is not null, s.checkout_at is not null, s.purchased_at is not null
  from public.analytics_sessions s
  where not s.is_bot and (s.started_at at time zone 'Africa/Cairo')::date between p_from and p_to;
$$;

-- ---------------------------------------------------------------
-- The engine: one report = a schema, some metrics, some dimensions, a date range.
-- Only whitelisted names reach the SQL text, so nothing a caller sends is ever run as code.
-- ---------------------------------------------------------------
create or replace function public.analytics_query(
  p_schema text, p_metrics text[], p_dims text[], p_from date, p_to date,
  p_order text default null, p_dir text default 'desc', p_limit int default 100
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $fn$
declare
  rel text;
  dim_map jsonb;
  met_map jsonb;
  d text;
  m text;
  dim_sel text[] := '{}';
  met_sel text[] := '{}';
  grp text[] := '{}';
  ord text;
  q text;
  v_rows jsonb;
  v_tot jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_to < p_from or p_to - p_from > 800 then raise exception 'bad_range'; end if;
  if p_dir not in ('asc', 'desc') then raise exception 'bad_direction'; end if;
  if coalesce(cardinality(p_metrics), 0) = 0 then raise exception 'no_metrics'; end if;

  if p_schema = 'sales' then
    rel := 'public._an_orders($1, $2)';
    dim_map := $j${
      "day": "b.d", "week": "b.wk", "month": "b.mo", "hour_of_day": "b.hr", "day_of_week": "b.dow",
      "referrer_source": "b.channel",
      "marketing_channel": "case when public._source_platform(b.channel) is not null then public._source_platform(b.channel) when b.channel = 'direct' then 'direct' else 'added by team' end",
      "payment_method": "b.payment", "discount_code": "coalesce(b.code, 'none')", "customer_type": "b.cust",
      "distance_bucket": "b.distance", "order_name": "b.order_name", "order_status": "b.status"
    }$j$;
    met_map := $j${
      "orders": "count(*) filter (where b.kept)",
      "gross_sales": "coalesce(sum(b.gross), 0)",
      "discounts": "coalesce(sum(b.discounts), 0)",
      "sales_reversals": "coalesce(sum(b.gross - b.discounts) filter (where not b.kept), 0)",
      "net_sales": "coalesce(sum(b.gross - b.discounts) filter (where b.kept), 0)",
      "shipping_charges": "coalesce(sum(b.shipping) filter (where b.kept), 0)",
      "total_sales": "coalesce(sum(b.total) filter (where b.kept), 0)",
      "average_order_value": "coalesce(round(avg(b.total) filter (where b.kept), 2), 0)",
      "items_ordered": "coalesce(sum(b.items) filter (where b.kept), 0)",
      "cost_of_goods": "coalesce(sum(b.cost) filter (where b.kept), 0)",
      "gross_profit": "coalesce(sum(b.gross - b.discounts - b.cost) filter (where b.kept), 0)",
      "gross_margin": "coalesce(round(100 * sum(b.gross - b.discounts - b.cost) filter (where b.kept) / nullif(sum(b.gross - b.discounts) filter (where b.kept), 0), 1), 0)",
      "new_customers": "count(*) filter (where b.kept and b.cust = 'new')",
      "returning_orders": "count(*) filter (where b.kept and b.cust = 'returning')",
      "returning_customer_rate": "coalesce(round(100.0 * count(*) filter (where b.kept and b.cust = 'returning') / nullif(count(*) filter (where b.kept), 0), 1), 0)",
      "cancelled_orders": "count(*) filter (where b.status = 'cancelled')",
      "refused_orders": "count(*) filter (where b.status = 'refused')",
      "all_orders": "count(*)",
      "reversal_rate": "coalesce(round(100.0 * count(*) filter (where not b.kept) / nullif(count(*), 0), 1), 0)"
    }$j$;
  elsif p_schema = 'items' then
    rel := 'public._an_items($1, $2)';
    dim_map := $j${
      "day": "b.d", "week": "b.wk", "month": "b.mo",
      "product": "b.product", "option": "b.option", "product_kind": "b.kind",
      "product_option": "b.product || ' · ' || b.option"
    }$j$;
    met_map := $j${
      "items_sold": "coalesce(sum(b.qty) filter (where b.kept), 0)",
      "orders": "count(distinct b.order_id) filter (where b.kept)",
      "gross_sales": "coalesce(sum(b.gross) filter (where b.kept), 0)",
      "discounts": "coalesce(round(sum(b.disc) filter (where b.kept), 2), 0)",
      "net_sales": "coalesce(round(sum(b.gross - b.disc) filter (where b.kept), 2), 0)",
      "cost_of_goods": "coalesce(sum(b.cost) filter (where b.kept), 0)",
      "gross_profit": "coalesce(round(sum(b.gross - b.disc - b.cost) filter (where b.kept), 2), 0)",
      "grams_sold": "coalesce(sum(b.grams) filter (where b.kept), 0)",
      "items_reversed": "coalesce(sum(b.qty) filter (where not b.kept), 0)"
    }$j$;
  elsif p_schema = 'sessions' then
    rel := 'public._an_sessions($1, $2)';
    dim_map := $j${
      "day": "b.d", "week": "b.wk", "month": "b.mo", "hour_of_day": "b.hr", "day_of_week": "b.dow",
      "device_type": "b.device", "country": "b.country", "region": "b.region", "city": "b.city", "location": "b.location",
      "referrer": "b.referrer", "traffic_source": "b.source", "landing_page": "b.landing", "language": "b.lang"
    }$j$;
    met_map := $j${
      "sessions": "count(*)",
      "visitors": "count(distinct b.visitor_id)",
      "pageviews": "coalesce(sum(b.pv), 0)",
      "cart_sessions": "count(*) filter (where b.carted)",
      "checkout_sessions": "count(*) filter (where b.checkout)",
      "completed_sessions": "count(*) filter (where b.purchased)",
      "cart_rate": "coalesce(round(100.0 * count(*) filter (where b.carted) / nullif(count(*), 0), 2), 0)",
      "checkout_rate": "coalesce(round(100.0 * count(*) filter (where b.checkout) / nullif(count(*), 0), 2), 0)",
      "conversion_rate": "coalesce(round(100.0 * count(*) filter (where b.purchased) / nullif(count(*), 0), 2), 0)",
      "checkout_conversion_rate": "coalesce(round(100.0 * count(*) filter (where b.purchased) / nullif(count(*) filter (where b.checkout), 0), 2), 0)",
      "bounce_rate": "coalesce(round(100.0 * count(*) filter (where b.pv <= 1) / nullif(count(*), 0), 1), 0)"
    }$j$;
  else
    raise exception 'bad_schema: %', p_schema;
  end if;

  foreach d in array coalesce(p_dims, '{}') loop
    if not dim_map ? d then raise exception 'bad_dimension: %', d; end if;
    dim_sel := dim_sel || format('%s as %I', dim_map ->> d, d);
    grp := grp || (cardinality(dim_sel))::text;
  end loop;
  foreach m in array p_metrics loop
    if not met_map ? m then raise exception 'bad_metric: %', m; end if;
    met_sel := met_sel || format('%s as %I', met_map ->> m, m);
  end loop;

  if p_order is not null and (p_order = any (p_metrics) or p_order = any (coalesce(p_dims, '{}'))) then
    ord := format('%I %s nulls last', p_order, p_dir);
  elsif coalesce(p_dims, '{}') && array['day', 'week', 'month', 'hour_of_day', 'day_of_week'] then
    ord := format('%I asc', (select x from unnest(p_dims) x where x in ('day', 'week', 'month', 'hour_of_day', 'day_of_week') limit 1));
  else
    ord := format('%I desc nulls last', p_metrics[1]);
  end if;

  q := format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select %s from %s b %s order by %s limit %s) t',
    array_to_string(dim_sel || met_sel, ', '), rel,
    case when cardinality(grp) > 0 then 'group by ' || array_to_string(grp, ', ') else '' end,
    ord, least(greatest(coalesce(p_limit, 100), 1), 1000));
  execute q into v_rows using p_from, p_to;

  q := format('select to_jsonb(t) from (select %s from %s b) t', array_to_string(met_sel, ', '), rel);
  execute q into v_tot using p_from, p_to;

  return jsonb_build_object('rows', v_rows, 'totals', v_tot);
end;
$fn$;

-- ---------------------------------------------------------------
-- Customer cohorts: how many of a month's first-time customers ordered again in month 0, 1, 2 ...
-- (Month 0 = another order in the same month as their first one.)
-- ---------------------------------------------------------------
create or replace function public.analytics_cohorts(p_months int default 12)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  tz constant text := 'Africa/Cairo';
  res jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  p_months := least(greatest(coalesce(p_months, 12), 1), 24);

  with k as (
    select o.customer_id,
           date_trunc('month', o.created_at at time zone tz)::date as m,
           row_number() over (partition by o.customer_id order by o.created_at) as rn
    from public.orders o
    where o.customer_id is not null and o.status not in ('cancelled', 'refused')
  ),
  first_m as (select customer_id, m as cohort from k where rn = 1),
  months as (
    select (date_trunc('month', now() at time zone tz)::date - (g * interval '1 month'))::date as cohort
    from generate_series(0, p_months - 1) g
  ),
  cells as (
    select ms.cohort, o.off,
           (select count(distinct f.customer_id) from first_m f
              join k on k.customer_id = f.customer_id and k.rn > 1
             where f.cohort = ms.cohort
               and k.m = (ms.cohort + (o.off * interval '1 month'))::date) as n
    from months ms cross join generate_series(0, 11) as o(off)
    where (ms.cohort + (o.off * interval '1 month'))::date <= date_trunc('month', now() at time zone tz)::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'cohort', ms.cohort,
    'size', (select count(*) from first_m f where f.cohort = ms.cohort),
    'counts', (select coalesce(jsonb_agg(c.n order by c.off), '[]'::jsonb) from cells c where c.cohort = ms.cohort)
  ) order by ms.cohort desc), '[]'::jsonb)
  into res from months ms;

  return res;
end;
$$;

-- ---------------------------------------------------------------
-- Live view: the last minutes of the store in one call
-- ---------------------------------------------------------------
create or replace function public.analytics_live()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  tz constant text := 'Africa/Cairo';
  v_now timestamptz := now();
  v_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  v_ystart timestamptz := (date_trunc('day', now() at time zone tz) - interval '1 day') at time zone tz;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  with s as (select * from public.analytics_sessions where not is_bot and started_at >= v_ystart),
  o as (
    select o.*, o.status not in ('cancelled', 'refused') as kept,
           exists (select 1 from public.orders e where e.customer_id = o.customer_id and e.created_at < o.created_at
                   and e.status not in ('cancelled', 'refused')) as is_returning
    from public.orders o where o.created_at >= v_ystart
  ),
  hours as (select g as h from generate_series(0, 23) g)
  select jsonb_build_object(
    'now', v_now,
    'visitors', (select count(*) from public.analytics_sessions where not is_bot and last_seen_at > v_now - interval '5 minutes'),
    'sessions', (select count(*) from s where started_at >= v_start),
    'sessions_prev', (select count(*) from s where started_at >= v_ystart and started_at <= v_now - interval '1 day'),
    'orders', (select count(*) from o where created_at >= v_start and kept),
    'orders_prev', (select count(*) from o where created_at >= v_ystart and created_at <= v_now - interval '1 day' and kept),
    'sales', (select coalesce(sum(total), 0) from o where created_at >= v_start and kept),
    'sales_prev', (select coalesce(sum(total), 0) from o where created_at >= v_ystart and created_at <= v_now - interval '1 day' and kept),
    'carts', (select count(*) from public.analytics_sessions where not is_bot and last_seen_at > v_now - interval '30 minutes'
               and carted_at is not null and checkout_at is null and purchased_at is null),
    'checkouts', (select count(*) from public.analytics_sessions where not is_bot and last_seen_at > v_now - interval '30 minutes'
                   and checkout_at is not null and purchased_at is null),
    'purchased', (select count(*) from s where purchased_at >= v_start),
    'spark', jsonb_build_object(
      'sessions', (select jsonb_agg((select count(*) from s where started_at >= v_start and extract(hour from started_at at time zone tz)::int = h.h) order by h.h) from hours h),
      'orders', (select jsonb_agg((select count(*) from o where created_at >= v_start and kept and extract(hour from created_at at time zone tz)::int = h.h) order by h.h) from hours h),
      'sales', (select jsonb_agg((select coalesce(sum(total), 0) from o where created_at >= v_start and kept and extract(hour from created_at at time zone tz)::int = h.h) order by h.h) from hours h)
    ),
    'locations', (
      select coalesce(jsonb_agg(jsonb_build_object('label', l, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(country, 'Unknown') || ' · ' || coalesce(region, 'Unknown') || ' · ' || coalesce(city, 'Unknown') as l, count(*) as n
        from s where started_at >= v_start group by 1 order by 2 desc limit 8
      ) t
    ),
    'new_vs_returning', jsonb_build_object(
      'new', (select count(distinct customer_id) from o where created_at >= v_start and kept and not is_returning),
      'returning', (select count(distinct customer_id) from o where created_at >= v_start and kept and is_returning)
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'option', opt, 'sales', sales) order by sales desc), '[]'::jsonb) from (
        select i.name_en as name, i.option_label as opt, sum(i.line_total) as sales
        from public.order_items i join o on o.id = i.order_id and o.kept and o.created_at >= v_start
        group by 1, 2 order by 3 desc limit 6
      ) t
    ),
    'dots', jsonb_build_object(
      'visitors', (select coalesce(jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'city', city)), '[]'::jsonb) from (
                     select lat, lng, city from public.analytics_sessions
                     where not is_bot and last_seen_at > v_now - interval '5 minutes' and lat is not null limit 200) t),
      'orders', (select coalesce(jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'name', '#' || number)), '[]'::jsonb) from (
                   select lat, lng, number from o where created_at >= v_start and kept and lat is not null limit 200) t)
    )
  ) into res;

  return res;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public._an_orders(date, date)', 'public._an_items(date, date)', 'public._an_sessions(date, date)',
    'public.analytics_query(text, text[], text[], date, date, text, text, int)',
    'public.analytics_cohorts(int)', 'public.analytics_live()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
