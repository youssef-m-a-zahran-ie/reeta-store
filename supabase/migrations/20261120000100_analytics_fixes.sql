-- Analytics fixes after the first audit.
-- 1. Sources: team orders keep their own name ("team:instagram"), never "Meta ads"; organic visits are named from the
--    referrer (instagram, facebook, google ...) instead of "direct"; hosts like l.instagram.com fold into one name.
-- 2. Marketing channels like Shopify: ads (from utm_source), other campaigns, organic social, organic search, email,
--    other websites, direct, added by the team.
-- 3. Average order value = (gross sales - discounts) / orders, without delivery. Returning customer rate counts customers.
-- 4. Product reports: gross sales include cancelled items (like the Sales reports), with a "sales reversals" column;
--    a code limited to some products is shared only between those products.
-- 5. Visit tracking can't be faked: a purchase needs a real, fresh web order; new visits are rate limited; "ping" keeps a
--    visitor live without counting a page. Visits recorded from local development are excluded.
-- 6. Delivered orders are counted on the day they were delivered.
-- 7. A bundle with a component that has no cost now has no cost (so profit is flagged as incomplete, not inflated).

-- ---------------------------------------------------------------
-- Where a visit or an order came from
-- ---------------------------------------------------------------
create or replace function public._ref_source(p_ref text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when h is null then null
    when h ~ 'instagram' then 'instagram'
    when h ~ '(facebook|messenger|^fb\.|\.fb\.)' then 'facebook'
    when h ~ 'tiktok' then 'tiktok'
    when h ~ '(whatsapp|^wa\.me$)' then 'whatsapp'
    when h ~ '(^mail\.google\.|android\.gm$|outlook|^mail\.yahoo\.|mail\.)' then 'email'
    when h ~ '(^|\.)google\.' or h ~ 'googlequicksearchbox' then 'google'
    when h ~ '(youtube|^youtu\.be$)' then 'youtube'
    when h ~ '(^|\.)(t\.co|x\.com|twitter\.com)$' then 'x'
    when h ~ 'snapchat' then 'snapchat'
    when h ~ '(^|\.)bing\.com$' then 'bing'
    when h ~ 'duckduckgo' then 'duckduckgo'
    when h ~ '(^|\.)yahoo\.' then 'yahoo'
    else left(h, 120)
  end
  from (
    select nullif(regexp_replace(lower(coalesce(
      substring(p_ref from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:?#]+)'),
      split_part(split_part(split_part(coalesce(p_ref, ''), '/', 1), '?', 1), ':', 1)
    )), '^www\.', ''), '') as h
  ) x;
$$;

-- The marketing channel of a visit or order. p_ref is already a _ref_source name.
create or replace function public._an_channel(p_utm text, p_medium text, p_ref text, p_team boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_team then 'team'
    when lower(coalesce(p_medium, '')) = 'email' then 'email'
    when lower(coalesce(p_medium, '')) in ('organic', 'social', 'bio', 'post', 'story', 'profile') then 'social'
    when public._source_platform(nullif(p_utm, '')) is not null then public._source_platform(p_utm)
    when nullif(p_utm, '') is not null then 'campaign'
    when p_ref in ('instagram', 'facebook', 'tiktok', 'x', 'youtube', 'snapchat', 'whatsapp') then 'social'
    when p_ref in ('google', 'bing', 'duckduckgo', 'yahoo') then 'search'
    when p_ref = 'email' then 'email'
    when p_ref is not null then 'referral'
    else 'direct'
  end;
$$;

revoke execute on function public._ref_source(text) from public, anon;
revoke execute on function public._an_channel(text, text, text, boolean) from public, anon;
grant execute on function public._ref_source(text) to authenticated;
grant execute on function public._an_channel(text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------
-- Row sources (new columns, so they are dropped and made again)
-- ---------------------------------------------------------------
drop function public._an_orders(date, date);
drop function public._an_items(date, date);
drop function public._an_sessions(date, date);

create function public._an_orders(p_from date, p_to date)
returns table (
  id uuid, d date, wk date, mo date, hr int, dow int, status text, kept boolean,
  gross numeric, discounts numeric, shipping numeric, total numeric, cost numeric, has_cost boolean, items int,
  channel text, mkt text, payment text, code text, cust text, distance text, order_name text, customer_id uuid
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
    case when o.source <> 'web' then 'team:' || o.source
         else coalesce(nullif(lower(o.utm_source), ''), public._ref_source(o.referrer), 'direct') end,
    public._an_channel(o.utm_source, o.utm_medium, public._ref_source(o.referrer), o.source <> 'web'),
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

create function public._an_items(p_from date, p_to date)
returns table (
  d date, wk date, mo date, order_id uuid, kept boolean, product text, option text, kind text,
  qty int, gross numeric, disc numeric, cost numeric, grams numeric
)
language sql
stable
set search_path = ''
as $$
  select x.d, x.wk, x.mo, x.order_id, x.kept, x.product, x.option, x.kind, x.qty, x.gross,
    -- An order's discount is shared by value between the lines it applied to (all lines unless the code was limited
    -- to some products; if none of those are left, all lines).
    case when x.elig_sum > 0 then case when x.elig then x.discount_total * x.gross / x.elig_sum else 0 end
         when x.subtotal > 0 then x.discount_total * x.gross / x.subtotal
         else 0 end,
    x.cost, x.grams
  from (
    select (o.created_at at time zone 'Africa/Cairo')::date as d,
      date_trunc('week', o.created_at at time zone 'Africa/Cairo')::date as wk,
      date_trunc('month', o.created_at at time zone 'Africa/Cairo')::date as mo,
      o.id as order_id,
      o.status not in ('cancelled', 'refused') as kept,
      i.name_en as product,
      coalesce(i.option_label, '–') as option,
      case when i.bundle_id is not null then 'bundle' else 'product' end as kind,
      i.qty, i.line_total as gross,
      coalesce(i.unit_cost, 0) * i.qty as cost,
      coalesce(i.grams, 0) * i.qty as grams,
      o.discount_total, o.subtotal,
      (dd.product_ids is null or (i.product_id is not null and i.product_id = any (dd.product_ids))) as elig,
      sum(i.line_total) filter (where dd.product_ids is null or (i.product_id is not null and i.product_id = any (dd.product_ids)))
        over (partition by o.id) as elig_sum
    from public.order_items i
    join public.orders o on o.id = i.order_id
    left join public.discounts dd on dd.id = o.discount_id
    where (o.created_at at time zone 'Africa/Cairo')::date between p_from and p_to
  ) x;
$$;

create function public._an_sessions(p_from date, p_to date)
returns table (
  visitor_id uuid, d date, wk date, mo date, hr int, dow int, device text, country text, region text, city text,
  location text, referrer text, source text, mkt text, landing text, lang text, pv int, carted boolean, checkout boolean, purchased boolean
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
    coalesce(public._ref_source(s.referrer_host), 'direct'),
    coalesce(nullif(lower(s.utm_source), ''), public._ref_source(s.referrer_host), 'direct'),
    public._an_channel(s.utm_source, s.utm_medium, public._ref_source(s.referrer_host), false),
    s.landing_path, s.lang, s.pageviews,
    s.carted_at is not null, s.checkout_at is not null, s.purchased_at is not null
  from public.analytics_sessions s
  where not s.is_bot and (s.started_at at time zone 'Africa/Cairo')::date between p_from and p_to;
$$;

-- ---------------------------------------------------------------
-- The engine (same signature, updated metric and dimension lists)
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
      "referrer_source": "b.channel", "marketing_channel": "b.mkt",
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
      "average_order_value": "coalesce(round(sum(b.gross - b.discounts) filter (where b.kept) / nullif(count(*) filter (where b.kept), 0), 2), 0)",
      "items_ordered": "coalesce(sum(b.items) filter (where b.kept), 0)",
      "cost_of_goods": "coalesce(sum(b.cost) filter (where b.kept), 0)",
      "gross_profit": "coalesce(sum(b.gross - b.discounts - b.cost) filter (where b.kept), 0)",
      "gross_margin": "coalesce(round(100 * sum(b.gross - b.discounts - b.cost) filter (where b.kept) / nullif(sum(b.gross - b.discounts) filter (where b.kept), 0), 1), 0)",
      "customers": "count(distinct b.customer_id) filter (where b.kept)",
      "new_customers": "count(distinct b.customer_id) filter (where b.kept and b.cust = 'new')",
      "returning_customers": "count(distinct b.customer_id) filter (where b.kept and b.cust = 'returning')",
      "returning_orders": "count(*) filter (where b.kept and b.cust = 'returning')",
      "returning_customer_rate": "coalesce(round(100.0 * count(distinct b.customer_id) filter (where b.kept and b.cust = 'returning') / nullif(count(distinct b.customer_id) filter (where b.kept), 0), 1), 0)",
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
      "gross_sales": "coalesce(sum(b.gross), 0)",
      "discounts": "coalesce(round(sum(b.disc), 2), 0)",
      "sales_reversals": "coalesce(round(sum(b.gross - b.disc) filter (where not b.kept), 2), 0)",
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
      "referrer": "b.referrer", "traffic_source": "b.source", "marketing_channel": "b.mkt",
      "landing_page": "b.landing", "language": "b.lang"
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
-- Orders delivered per day (by the day they were delivered, Cairo time)
-- ---------------------------------------------------------------
create or replace function public.analytics_delivered(p_from date, p_to date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_to < p_from or p_to - p_from > 800 then raise exception 'bad_range'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('d', t.d, 'n', t.n) order by t.d), '[]'::jsonb)
    from (
      select (o.delivered_at at time zone 'Africa/Cairo')::date as d, count(*) as n
      from public.orders o
      where o.status = 'delivered' and o.delivered_at is not null
        and (o.delivered_at at time zone 'Africa/Cairo')::date between p_from and p_to
      group by 1
    ) t
  );
end;
$$;

-- ---------------------------------------------------------------
-- Visit tracking
-- ---------------------------------------------------------------
alter table public.analytics_sessions add column purchase_order_id uuid unique;
create index analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id, started_at desc);

-- Visits recorded while the site ran on a developer's computer have no country (Cloudflare adds it in production).
update public.analytics_sessions set is_bot = true where country is null and lat is null and not is_bot;

drop function public.track_visit(uuid, uuid, text, text, text, boolean, text, text, text, double precision, double precision, text, text, text, text, text);

create function public.track_visit(
  p_session uuid, p_visitor uuid, p_event text, p_path text,
  p_device text default 'desktop', p_bot boolean default false,
  p_country text default null, p_region text default null, p_city text default null,
  p_lat double precision default null, p_lng double precision default null,
  p_referrer text default null, p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null, p_lang text default 'en', p_order uuid default null
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
  v_exists boolean;
begin
  if p_session is null or p_visitor is null then return; end if;
  if p_event not in ('page', 'cart', 'checkout', 'purchase', 'ping') then return; end if;

  -- A purchase only counts for a real web order placed in the last 2 hours, once.
  if p_event = 'purchase' and (
       p_order is null
       or not exists (select 1 from public.orders o where o.id = p_order and o.source = 'web' and o.created_at > now() - interval '2 hours')
       or exists (select 1 from public.analytics_sessions x where x.purchase_order_id = p_order and x.id <> p_session)
     ) then
    return;
  end if;

  select true into v_exists from public.analytics_sessions where id = p_session;
  v_exists := coalesce(v_exists, false);

  -- "Still here" only keeps a known visit live.
  if p_event = 'ping' then
    update public.analytics_sessions set last_seen_at = now() where id = p_session and visitor_id = p_visitor;
    return;
  end if;

  if not v_exists then
    -- Limits on new visits: 30 an hour per browser, 3000 every 10 minutes for the whole store.
    if (select count(*) from public.analytics_sessions where visitor_id = p_visitor and started_at > now() - interval '1 hour') >= 30
       or (select count(*) from public.analytics_sessions where started_at > now() - interval '10 minutes') >= 3000 then
      return;
    end if;
  end if;

  if p_lat is not null and (p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180) then
    p_lat := null; p_lng := null;
  end if;

  insert into public.analytics_sessions as s (
    id, visitor_id, device, is_bot, country, region, city, lat, lng, referrer_host,
    utm_source, utm_medium, utm_campaign, landing_path, lang, carted_at, checkout_at, purchased_at, purchase_order_id
  ) values (
    p_session, p_visitor, v_device, coalesce(p_bot, false),
    left(p_country, 80), left(p_region, 80), left(p_city, 80), p_lat, p_lng, left(p_referrer, 120),
    left(p_utm_source, 80), left(p_utm_medium, 80), left(p_utm_campaign, 120), v_path, v_lang,
    case when p_event = 'cart' then now() end,
    case when p_event = 'checkout' then now() end,
    case when p_event = 'purchase' then now() end,
    case when p_event = 'purchase' then p_order end
  )
  on conflict (id) do update set
    last_seen_at = now(),
    pageviews = least(s.pageviews + case when p_event = 'page' then 1 else 0 end, 1000),
    carted_at = coalesce(s.carted_at, case when p_event = 'cart' then now() end),
    checkout_at = coalesce(s.checkout_at, case when p_event = 'checkout' then now() end),
    purchased_at = coalesce(s.purchased_at, case when p_event = 'purchase' then now() end),
    purchase_order_id = coalesce(s.purchase_order_id, case when p_event = 'purchase' then p_order end)
  where s.visitor_id = p_visitor;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public._an_orders(date, date)', 'public._an_items(date, date)', 'public._an_sessions(date, date)',
    'public.analytics_delivered(date, date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.track_visit(uuid, uuid, text, text, text, boolean, text, text, text, double precision, double precision, text, text, text, text, text, uuid) from public;
grant execute on function public.track_visit(uuid, uuid, text, text, text, boolean, text, text, text, double precision, double precision, text, text, text, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- Bundles: a component without a cost leaves the bundle without a cost (was counted as 0).
-- Same as 20261011000200_customizer_fix.sql except that one line.
-- ---------------------------------------------------------------
create or replace function public._compute_order(p jsonb)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  it jsonb;
  v_qty int;
  v_lines jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_needs jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v record;
  b record;
  bi record;
  line_cost numeric;
  idx int := 0;
  v_code text := upper(trim(coalesce(p ->> 'discount_code', '')));
  d public.discounts;
  eligible numeric := 0;
  disc numeric := 0;
  v_free boolean := false;
  deliv jsonb;
  v_fee numeric := 0;
  need record;
  have numeric;
  tracked boolean;
  nm_en text;
  nm_ar text;
  cu record;
  cu_ok boolean;
begin
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty');
  elsif jsonb_array_length(p -> 'items') > 50 then
    v_errors := v_errors || jsonb_build_object('code', 'too_many_items');
  end if;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    idx := idx + 1;
    v_qty := least(greatest(coalesce((it ->> 'qty')::int, 1), 1), 20);

    -- Made-to-order: id = "<base>.<coating>.<size>". Price and cost = base at that size + coating at that size.
    if it ->> 'kind' = 'custom' then
      cu_ok := false;
      if coalesce(it ->> 'id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select xb.id as base_id, xc.id as coating_id, xz.id as size_id,
               xb.name_en as b_en, xb.name_ar as b_ar, xc.name_en as c_en, xc.name_ar as c_ar,
               xz.name_en as z_en, xz.name_ar as z_ar, cb.display, bp.grams, cb.coating_share, xc.color,
               bp.price + cp.price as price,
               case when bp.cost is null or cp.cost is null then null else bp.cost + cp.cost end as unit_cost
        into cu
        from public.custom_bases cb
        join public.bases xb on xb.id = cb.base_id
        join public.custom_base_prices bp on bp.base_id = cb.base_id
        join public.custom_sizes xz on xz.id = bp.size_id
        join public.custom_coating_prices cp on cp.size_id = xz.id
        join public.custom_coatings cc on cc.coating_id = cp.coating_id
        join public.coatings xc on xc.id = cc.coating_id
        cross join public.settings xs
        where xs.id = 1 and xs.custom_enabled
          and cb.base_id = split_part(it ->> 'id', '.', 1)::uuid
          and cc.coating_id = split_part(it ->> 'id', '.', 2)::uuid
          and xz.id = split_part(it ->> 'id', '.', 3)::uuid
          and cb.is_active and cc.is_active and xz.is_active
          and cb.visual is not null and cc.visual is not null
          and bp.price is not null and bp.grams is not null and cp.price is not null;
        cu_ok := found;
      end if;
      if not cu_ok then
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'index', idx - 1, 'id', it ->> 'id');
        continue;
      end if;
      v_needs := v_needs
        || jsonb_build_object('base_id', cu.base_id, 'amount', round(cu.grams * (100 - cu.coating_share) / 100 * v_qty, 2))
        || jsonb_build_object('coating_id', cu.coating_id, 'amount', round(cu.grams * cu.coating_share / 100 * v_qty, 2));
      v_lines := v_lines || jsonb_build_object(
        'kind', 'custom', 'id', it ->> 'id', 'product_id', null, 'variant_id', null, 'bundle_id', null,
        'base_id', cu.base_id, 'coating_id', cu.coating_id, 'size_id', cu.size_id,
        'name_en', cu.b_en || ' · ' || cu.c_en, 'name_ar', cu.b_ar || ' · ' || cu.c_ar,
        'label_en', case when cu.display = 'weight' then cu.z_en || ' · ' || trim_scale(cu.grams)::text || ' g' else cu.z_en end,
        'label_ar', case when cu.display = 'weight' then cu.z_ar || ' · ' || trim_scale(cu.grams)::text || ' جم' else cu.z_ar end,
        'grams', cu.grams, 'qty', v_qty, 'unit_price', cu.price, 'unit_cost', cu.unit_cost,
        'line_total', cu.price * v_qty, 'color', cu.color
      );
      v_subtotal := v_subtotal + cu.price * v_qty;
      continue;
    end if;

    if it ->> 'kind' = 'bundle' then
      select bu.* into b from public.bundles bu
      where bu.id = (it ->> 'id')::uuid and bu.status = 'active';
      if not found then
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'index', idx - 1, 'id', it ->> 'id');
        continue;
      end if;
      line_cost := 0;
      for bi in
        select x.qty as n, vv.id as variant_id, pp.id as product_id, pp.stock_unit, ov.amount,
               coalesce(vv.cost, (select pti.cost from public.price_template_items pti
                                   where pti.template_id = pp.price_template_id and pti.option_value_id = vv.option_value_id)) as unit_cost,
               (pp.status = 'active' and vv.is_active) as ok
        from public.bundle_items x
        join public.variants vv on vv.id = x.variant_id
        join public.products pp on pp.id = vv.product_id
        left join public.option_values ov on ov.id = vv.option_value_id
        where x.bundle_id = b.id
      loop
        if not bi.ok then
          v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'index', idx - 1, 'id', it ->> 'id');
        end if;
        v_needs := v_needs || jsonb_build_object(
          'product_id', bi.product_id,
          'variant_id', case when bi.stock_unit = 'pieces' then bi.variant_id end,
          'amount', case when bi.stock_unit = 'grams' then coalesce(bi.amount, 0) * bi.n * v_qty else bi.n * v_qty end
        );
        line_cost := line_cost + bi.unit_cost * bi.n;  -- null if any component has no cost
      end loop;
      v_lines := v_lines || jsonb_build_object(
        'kind', 'bundle', 'id', b.id, 'bundle_id', b.id, 'product_id', null, 'variant_id', null,
        'name_en', b.name_en, 'name_ar', b.name_ar, 'label_en', null, 'label_ar', null,
        'grams', null, 'qty', v_qty, 'unit_price', b.price, 'unit_cost', line_cost,
        'line_total', b.price * v_qty, 'color', '#5b4659'
      );
      v_subtotal := v_subtotal + b.price * v_qty;
    else
      select vv.id as variant_id, pp.id as product_id, pp.name_en, pp.name_ar, pp.stock_unit,
             coalesce(pp.color, co.color) as color,
             coalesce(ov.label_en, vv.label_en) as label_en, coalesce(ov.label_ar, vv.label_ar) as label_ar,
             ov.amount, public._variant_price(vv, pp) as price,
             coalesce(vv.cost, (select pti.cost from public.price_template_items pti
                                 where pti.template_id = pp.price_template_id and pti.option_value_id = vv.option_value_id)) as unit_cost
      into v
      from public.variants vv
      join public.products pp on pp.id = vv.product_id
      join public.categories c on c.id = pp.category_id and c.is_visible
      left join public.coatings co on co.id = pp.coating_id
      left join public.option_values ov on ov.id = vv.option_value_id
      where vv.id = (it ->> 'id')::uuid and vv.is_active and pp.status = 'active';
      if not found or v.price is null then
        v_errors := v_errors || jsonb_build_object('code', 'unavailable', 'index', idx - 1, 'id', it ->> 'id');
        continue;
      end if;
      v_needs := v_needs || jsonb_build_object(
        'product_id', v.product_id,
        'variant_id', case when v.stock_unit = 'pieces' then v.variant_id end,
        'amount', case when v.stock_unit = 'grams' then coalesce(v.amount, 0) * v_qty else v_qty end
      );
      v_lines := v_lines || jsonb_build_object(
        'kind', 'variant', 'id', v.variant_id, 'variant_id', v.variant_id, 'product_id', v.product_id, 'bundle_id', null,
        'name_en', v.name_en, 'name_ar', v.name_ar, 'label_en', v.label_en, 'label_ar', v.label_ar,
        'grams', case when v.stock_unit = 'grams' then v.amount end, 'qty', v_qty,
        'unit_price', v.price, 'unit_cost', v.unit_cost, 'line_total', v.price * v_qty, 'color', v.color
      );
      v_subtotal := v_subtotal + v.price * v_qty;
    end if;
  end loop;

  for need in
    select (n ->> 'product_id')::uuid as product_id, (n ->> 'variant_id')::uuid as variant_id,
           (n ->> 'base_id')::uuid as base_id, (n ->> 'coating_id')::uuid as coating_id,
           sum((n ->> 'amount')::numeric) as amount
    from jsonb_array_elements(v_needs) n
    group by 1, 2, 3, 4
  loop
    have := null;
    tracked := true;
    if need.base_id is not null then
      select cb.stock_grams, cb.track_stock, xb.name_en, xb.name_ar into have, tracked, nm_en, nm_ar
      from public.custom_bases cb join public.bases xb on xb.id = cb.base_id where cb.base_id = need.base_id;
    elsif need.coating_id is not null then
      select cc.stock_grams, cc.track_stock, xc.name_en, xc.name_ar into have, tracked, nm_en, nm_ar
      from public.custom_coatings cc join public.coatings xc on xc.id = cc.coating_id where cc.coating_id = need.coating_id;
    else
      select pr.name_en, pr.name_ar into nm_en, nm_ar from public.products pr where pr.id = need.product_id;
      if need.variant_id is null then
        select pr.stock_grams into have from public.products pr where pr.id = need.product_id;
      else
        select va.stock_qty into have from public.variants va where va.id = need.variant_id;
      end if;
    end if;
    if coalesce(tracked, false) and coalesce(have, 0) < need.amount then
      v_errors := v_errors || jsonb_build_object(
        'code', 'out_of_stock',
        'product_id', need.product_id,
        'name_en', nm_en,
        'name_ar', nm_ar
      );
    end if;
  end loop;

  if v_code <> '' then
    select * into d from public.discounts dd
    where dd.code = v_code and dd.is_active
      and (dd.starts_at is null or dd.starts_at <= now())
      and (dd.ends_at is null or dd.ends_at > now())
      and (dd.usage_limit is null or dd.used_count < dd.usage_limit);
    if not found then
      v_errors := v_errors || jsonb_build_object('code', 'invalid_code');
    elsif v_subtotal < d.min_subtotal then
      v_errors := v_errors || jsonb_build_object('code', 'code_min', 'min', d.min_subtotal);
      d := null;
    else
      if d.product_ids is null then
        eligible := v_subtotal;
      else
        select coalesce(sum((l ->> 'line_total')::numeric), 0) into eligible
        from jsonb_array_elements(v_lines) l
        where (l ->> 'product_id') is not null and (l ->> 'product_id')::uuid = any (d.product_ids);
      end if;
      if d.type = 'percent' then
        disc := round(eligible * d.value / 100, 2);
      elsif d.type = 'fixed' then
        disc := least(d.value, eligible);
      else
        v_free := true;
      end if;
    end if;
  end if;

  if not v_free and exists (
    select 1 from public.discounts ad
    where ad.code is null and ad.type = 'free_shipping' and ad.is_active
      and (ad.starts_at is null or ad.starts_at <= now())
      and (ad.ends_at is null or ad.ends_at > now())
      and v_subtotal >= ad.min_subtotal
  ) then
    v_free := true;
  end if;

  deliv := public._delivery((p ->> 'lat')::float8, (p ->> 'lng')::float8);
  if coalesce((deliv ->> 'out_of_range')::boolean, false) then
    v_errors := v_errors || jsonb_build_object('code', 'out_of_range');
  end if;
  v_fee := case when v_free then 0 else coalesce((deliv ->> 'fee')::numeric, 0) end;

  return jsonb_build_object(
    'lines', v_lines,
    'errors', v_errors,
    'needs', v_needs,
    'subtotal', v_subtotal,
    'discount', case when d.id is not null then jsonb_build_object('id', d.id, 'code', d.code, 'type', d.type, 'amount', disc) end,
    'discount_total', disc,
    'free_shipping', v_free,
    'distance_km', deliv -> 'distance_km',
    'has_location', deliv is not null,
    'out_of_range', coalesce((deliv ->> 'out_of_range')::boolean, false),
    'shipping_fee', v_fee,
    'total', v_subtotal - disc + v_fee
  );
end;
$function$;

revoke execute on function public._compute_order(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Reports page: average order = (sales before delivery - discounts) / orders, and sources named like Analytics.
-- Same as 20260928001400_reports.sql except the two aov lines and the "sources" block.
-- ---------------------------------------------------------------
create or replace function public.admin_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  tz constant text := 'Africa/Cairo';
  v_days int := p_to - p_from + 1;
  prev_from date := p_from - (p_to - p_from + 1);
  prev_to date := p_from - 1;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_to < p_from or v_days > 800 then raise exception 'bad_range'; end if;

  with o as (
    select o.*,
           (o.created_at at time zone tz)::date as d,
           o.status not in ('cancelled', 'refused') as kept,
           (select coalesce(sum(i.unit_cost * i.qty), 0) from public.order_items i where i.order_id = o.id) as cost,
           (select bool_and(i.unit_cost is not null) from public.order_items i where i.order_id = o.id) as has_cost,
           exists (select 1 from public.orders e where e.customer_id = o.customer_id and e.created_at < o.created_at
                   and e.status not in ('cancelled', 'refused')) as returning_customer
    from public.orders o
    where (o.created_at at time zone tz)::date between prev_from and p_to
  ),
  cur as (select * from o where d between p_from and p_to),
  prev as (select * from o where d between prev_from and prev_to),
  kpi as (
    select
      (select jsonb_build_object(
        'sales', coalesce(sum(total) filter (where kept), 0),
        'orders', count(*) filter (where kept),
        'aov', coalesce(round(sum(subtotal - discount_total) filter (where kept) / nullif(count(*) filter (where kept), 0), 2), 0),
        'profit', coalesce(sum(subtotal - discount_total - cost) filter (where kept), 0),
        'profit_complete', coalesce(bool_and(has_cost) filter (where kept), true),
        'delivery', coalesce(sum(shipping_fee) filter (where kept), 0),
        'discounts', coalesce(sum(discount_total) filter (where kept), 0),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'refused', count(*) filter (where status = 'refused'),
        'all_orders', count(*),
        'returning', count(*) filter (where kept and returning_customer),
        'customers', count(distinct customer_id) filter (where kept)
      ) from cur) as cur,
      (select jsonb_build_object(
        'sales', coalesce(sum(total) filter (where kept), 0),
        'orders', count(*) filter (where kept),
        'aov', coalesce(round(sum(subtotal - discount_total) filter (where kept) / nullif(count(*) filter (where kept), 0), 2), 0),
        'profit', coalesce(sum(subtotal - discount_total - cost) filter (where kept), 0),
        'returning', count(*) filter (where kept and returning_customer),
        'refused', count(*) filter (where status = 'refused'),
        'all_orders', count(*)
      ) from prev) as prev
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'prev_from', prev_from, 'prev_to', prev_to,
    'kpi', (select cur from kpi),
    'prev', (select prev from kpi),

    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', g.d::date, 'sales', coalesce(x.sales, 0), 'orders', coalesce(x.orders, 0)) order by g.d), '[]'::jsonb)
      from generate_series(p_from, p_to, interval '1 day') as g(d)
      left join (select d, sum(total) as sales, count(*) as orders from cur where kept group by d) x on x.d = g.d::date
    ),

    'sources', (
      select coalesce(jsonb_agg(s order by (s ->> 'sales')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'source', src,
          'platform', case when src not like 'team:%' then public._source_platform(src) end,
          'orders', count(*),
          'sales', sum(total),
          'profit', sum(subtotal - discount_total - cost)
        ) as s
        -- Same names as Analytics: team orders keep their own name, web orders without tags are named from the referrer.
        from (select *, case when source <> 'web' then 'team:' || source
                             else coalesce(nullif(lower(utm_source), ''), public._ref_source(referrer), 'direct') end as src
              from cur where kept) c
        group by src
      ) t
    ),

    'spend', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', sp.platform,
        'amount', round(sp.amount, 2),
        'sales', coalesce((select sum(total) from cur where kept and public._source_platform(utm_source) = sp.platform), 0),
        'orders', coalesce((select count(*) from cur where kept and public._source_platform(utm_source) = sp.platform), 0)
      )), '[]'::jsonb)
      from public._spend_between(p_from, p_to) sp
    ),
    'spend_prev', (select coalesce(sum(amount), 0) from public._spend_between(prev_from, prev_to)),

    'products', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'label', label, 'bundle', bundle, 'qty', qty, 'sales', sales,
                                'profit', profit, 'grams', grams) order by sales desc), '[]'::jsonb) from (
        select i.name_en as name, i.option_label as label, i.bundle_id is not null as bundle,
               sum(i.qty) as qty, sum(i.line_total) as sales,
               sum(i.line_total - coalesce(i.unit_cost, 0) * i.qty) as profit,
               sum(coalesce(i.grams, 0) * i.qty) as grams
        from public.order_items i join cur on cur.id = i.order_id and cur.kept
        group by 1, 2, 3
        order by 5 desc
        limit 50
      ) t
    ),

    'discounts', (
      select coalesce(jsonb_agg(jsonb_build_object('code', code, 'orders', n, 'sales', sales, 'given', given) order by n desc), '[]'::jsonb) from (
        select discount_code as code, count(*) as n, sum(total) as sales, sum(discount_total) as given
        from cur where kept and discount_code is not null
        group by 1
      ) t
    ),

    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hr, 'orders', n)), '[]'::jsonb) from (
        select extract(isodow from created_at at time zone tz)::int as dow,
               extract(hour from created_at at time zone tz)::int as hr, count(*) as n
        from cur where kept group by 1, 2
      ) t
    ),

    'distances', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b, 'orders', n, 'avg_fee', fee, 'sales', sales) order by ord), '[]'::jsonb) from (
        select case when distance_km is null then 'No location'
                    when distance_km < 5 then 'Under 5 km'
                    when distance_km < 10 then '5–10 km'
                    when distance_km < 15 then '10–15 km'
                    when distance_km < 25 then '15–25 km'
                    else '25 km+' end as b,
               case when distance_km is null then 9 when distance_km < 5 then 1 when distance_km < 10 then 2
                    when distance_km < 15 then 3 when distance_km < 25 then 4 else 5 end as ord,
               count(*) as n, round(avg(shipping_fee), 0) as fee, sum(total) as sales
        from cur where kept group by 1, 2
      ) t
    ),

    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('method', payment_method, 'orders', n, 'sales', sales)), '[]'::jsonb) from (
        select payment_method, count(*) as n, sum(total) as sales from cur where kept group by 1
      ) t
    ),

    'abandoned', (
      select jsonb_build_object(
        'total', count(*),
        'recovered', count(*) filter (where recovered_order_id is not null),
        'value', coalesce(sum(subtotal) filter (where recovered_order_id is null), 0)
      )
      from public.abandoned_checkouts a
      where (a.created_at at time zone tz)::date between p_from and p_to
    )
  ) into res;

  return res;
end;
$$;
