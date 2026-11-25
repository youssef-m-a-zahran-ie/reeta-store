-- Live View v2: every shopper action is logged (opened a product, added to cart, started checkout, pinned a location...),
-- the visit keeps its live state (current page, cart, step), and a visit only counts once it's a real person
-- ("engaged": 10+ seconds, 2+ pages, or any shopping step). Events come straight from the browser through track_events();
-- only the first page of a visit goes through the site's worker (that's where the location comes from).

-- ---------------------------------------------------------------
-- Visit: live state
-- ---------------------------------------------------------------
alter table public.analytics_sessions
  add column if not exists engaged boolean not null default false,
  add column if not exists current_path text,
  add column if not exists cart_value numeric,
  add column if not exists cart_items int,
  add column if not exists area text,
  add column if not exists pin_lat double precision,
  add column if not exists pin_lng double precision,
  add column if not exists event_count int not null default 0;

update public.analytics_sessions set engaged = true
where not engaged and (pageviews >= 2 or last_seen_at - started_at >= interval '10 seconds'
  or carted_at is not null or checkout_at is not null or purchased_at is not null);

create index if not exists analytics_sessions_live_idx on public.analytics_sessions (last_seen_at desc) where engaged and not is_bot;

-- ---------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.analytics_sessions(id) on delete cascade,
  at timestamptz not null default now(),
  type text not null,
  path text,
  product text,
  option text,
  qty int,
  value numeric,
  meta jsonb
);
create index if not exists analytics_events_at_idx on public.analytics_events (at desc);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id, at desc);

alter table public.analytics_events enable row level security;
create policy "admin full access" on public.analytics_events for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.analytics_events from anon;

-- ---------------------------------------------------------------
-- Events from the browser (anonymous, validated here). Up to 20 events per call; heartbeats only keep the visit live.
-- ---------------------------------------------------------------
create or replace function public.track_events(p_session uuid, p_visitor uuid, p_events jsonb, p_cart jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.analytics_sessions;
  e jsonb;
  n int := 0;
  v_type text;
  v_path text;
  v_last_path text;
  v_order uuid;
  v_total numeric;
  v_shop boolean := false;
  v_cart_v numeric;
  v_cart_i int;
  v_lat double precision;
  v_lng double precision;
begin
  if p_session is null or p_visitor is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  select * into s from public.analytics_sessions x
  where x.id = p_session and x.visitor_id = p_visitor and not x.is_bot and x.started_at > now() - interval '12 hours'
  for update;
  if not found then return; end if;

  if s.event_count < 1000 then
    for e in select value from jsonb_array_elements(p_events) limit 20 loop
      if jsonb_typeof(e) <> 'object' then continue; end if;
      v_type := e ->> 't';
      if v_type is null or v_type not in ('heartbeat', 'view_item', 'add_to_cart', 'remove_from_cart', 'cart_open', 'checkout_start',
                                           'checkout_phone', 'checkout_location', 'purchase', 'whatsapp', 'lang') then
        continue;
      end if;
      v_path := left(nullif(e ->> 'p', ''), 200);
      if v_path is not null then v_last_path := v_path; end if;
      if v_type = 'heartbeat' then continue; end if;
      if v_type in ('add_to_cart', 'checkout_start', 'checkout_phone', 'checkout_location', 'purchase') then v_shop := true; end if;

      if v_type = 'purchase' then
        -- Only a real web order from the last 2 hours, once; its value comes from the order itself.
        v_order := case when (e ->> 'oid') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e ->> 'oid')::uuid end;
        v_total := null;
        select o.total into v_total from public.orders o
        where o.id = v_order and o.source = 'web' and o.created_at > now() - interval '2 hours';
        if v_total is null or exists (select 1 from public.analytics_events x where x.type = 'purchase' and x.meta ->> 'oid' = v_order::text) then
          continue;
        end if;
        insert into public.analytics_events (session_id, type, path, value, meta)
        values (p_session, 'purchase', v_path, v_total, jsonb_build_object('oid', v_order));
        if s.purchase_order_id is null and not exists (select 1 from public.analytics_sessions x where x.purchase_order_id = v_order) then
          update public.analytics_sessions set purchased_at = coalesce(purchased_at, now()), purchase_order_id = v_order where id = p_session;
        end if;
        n := n + 1;
        continue;
      end if;

      if v_type = 'checkout_location' then
        v_lat := case when (e ->> 'lat') ~ '^-?\d{1,3}(\.\d+)?$' then (e ->> 'lat')::double precision end;
        v_lng := case when (e ->> 'lng') ~ '^-?\d{1,3}(\.\d+)?$' then (e ->> 'lng')::double precision end;
        if v_lat between 21 and 32 and v_lng between 24 and 37 then
          update public.analytics_sessions set pin_lat = round(v_lat::numeric, 3), pin_lng = round(v_lng::numeric, 3),
            area = coalesce(left(nullif(trim(e ->> 'area'), ''), 120), area)
          where id = p_session;
        end if;
      end if;

      insert into public.analytics_events (session_id, type, path, product, option, qty, value, meta)
      values (
        p_session, v_type, v_path,
        left(nullif(e ->> 'n', ''), 120),
        left(nullif(e ->> 'o', ''), 120),
        case when (e ->> 'q') ~ '^\d{1,3}$' then (e ->> 'q')::int end,
        case when (e ->> 'v') ~ '^\d{1,7}(\.\d{1,2})?$' then (e ->> 'v')::numeric end,
        case when v_type = 'checkout_location' then jsonb_build_object('area', left(nullif(trim(e ->> 'area'), ''), 120)) end
      );
      n := n + 1;
    end loop;
  end if;

  if jsonb_typeof(p_cart) = 'object' then
    v_cart_v := case when (p_cart ->> 'v') ~ '^\d{1,7}(\.\d{1,2})?$' then (p_cart ->> 'v')::numeric end;
    v_cart_i := case when (p_cart ->> 'i') ~ '^\d{1,3}$' then (p_cart ->> 'i')::int end;
  end if;

  update public.analytics_sessions x set
    last_seen_at = now(),
    current_path = coalesce(v_last_path, x.current_path),
    event_count = x.event_count + n,
    cart_value = coalesce(v_cart_v, x.cart_value),
    cart_items = coalesce(v_cart_i, x.cart_items),
    carted_at = case when x.carted_at is null and exists (select 1 from jsonb_array_elements(p_events) j where j ->> 't' = 'add_to_cart') then now() else x.carted_at end,
    checkout_at = case when x.checkout_at is null and exists (select 1 from jsonb_array_elements(p_events) j where j ->> 't' = 'checkout_start') then now() else x.checkout_at end,
    engaged = x.engaged or v_shop or x.pageviews >= 2 or now() - x.started_at >= interval '10 seconds'
  where x.id = p_session;
end;
$$;

revoke execute on function public.track_events(uuid, uuid, jsonb, jsonb) from public;
grant execute on function public.track_events(uuid, uuid, jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------
-- Visit tracking from the worker: same as 20261120000100 plus the page event, current page and "engaged".
-- ---------------------------------------------------------------
create or replace function public.track_visit(
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
    update public.analytics_sessions set last_seen_at = now(),
      engaged = engaged or now() - started_at >= interval '10 seconds'
    where id = p_session and visitor_id = p_visitor;
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
    utm_source, utm_medium, utm_campaign, landing_path, lang, carted_at, checkout_at, purchased_at, purchase_order_id,
    current_path, engaged
  ) values (
    p_session, p_visitor, v_device, coalesce(p_bot, false),
    left(p_country, 80), left(p_region, 80), left(p_city, 80), p_lat, p_lng, left(p_referrer, 120),
    left(p_utm_source, 80), left(p_utm_medium, 80), left(p_utm_campaign, 120), v_path, v_lang,
    case when p_event = 'cart' then now() end,
    case when p_event = 'checkout' then now() end,
    case when p_event = 'purchase' then now() end,
    case when p_event = 'purchase' then p_order end,
    v_path,
    p_event in ('cart', 'checkout', 'purchase')
  )
  on conflict (id) do update set
    last_seen_at = now(),
    pageviews = least(s.pageviews + case when p_event = 'page' then 1 else 0 end, 1000),
    carted_at = coalesce(s.carted_at, case when p_event = 'cart' then now() end),
    checkout_at = coalesce(s.checkout_at, case when p_event = 'checkout' then now() end),
    purchased_at = coalesce(s.purchased_at, case when p_event = 'purchase' then now() end),
    purchase_order_id = coalesce(s.purchase_order_id, case when p_event = 'purchase' then p_order end),
    current_path = case when p_event = 'page' then v_path else s.current_path end,
    engaged = s.engaged or p_event in ('cart', 'checkout', 'purchase')
      or (p_event = 'page' and s.pageviews >= 1) or now() - s.started_at >= interval '10 seconds'
  where s.visitor_id = p_visitor;

  -- The page itself, for the live feed (not for bots, and only on the visitor's own visit).
  if p_event = 'page' then
    insert into public.analytics_events (session_id, type, path)
    select p_session, 'page', v_path
    from public.analytics_sessions x
    where x.id = p_session and x.visitor_id = p_visitor and not x.is_bot and x.event_count < 1000;
    update public.analytics_sessions set event_count = event_count + 1 where id = p_session and visitor_id = p_visitor;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Reports count real visits only (engaged)
-- ---------------------------------------------------------------
create or replace function public._an_sessions(p_from date, p_to date)
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
  where not s.is_bot and s.engaged and (s.started_at at time zone 'Africa/Cairo')::date between p_from and p_to;
$$;

-- ---------------------------------------------------------------
-- Live View v2
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
  v_live constant interval := interval '90 seconds';
  res jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  with s as (
    select x.*,
      -- Where: the pin from checkout when there is one, else the governorate from the network (approximate).
      coalesce(x.area, nullif(x.region, ''), x.country, 'Unknown') as place,
      x.area is not null as precise
    from public.analytics_sessions x
    where not x.is_bot and x.engaged and x.last_seen_at >= v_ystart
  ),
  o as (
    select o.*, o.status not in ('cancelled', 'refused') as kept,
           exists (select 1 from public.orders e where e.customer_id = o.customer_id and e.created_at < o.created_at
                   and e.status not in ('cancelled', 'refused')) as is_returning
    from public.orders o where o.created_at >= v_ystart
  ),
  hours as (select g as h from generate_series(0, 23) g),
  ev as (
    select e.*, s.place, s.precise, s.device
    from public.analytics_events e join s on s.id = e.session_id
    where e.at >= v_start
  )
  select jsonb_build_object(
    'now', v_now,
    'visitors', (select count(*) from s where last_seen_at > v_now - v_live),
    'sessions', (select count(*) from s where started_at >= v_start),
    'sessions_prev', (select count(*) from s where started_at >= v_ystart and started_at < v_start and started_at <= v_now - interval '1 day'),
    'orders', (select count(*) from o where created_at >= v_start and kept),
    'orders_prev', (select count(*) from o where created_at >= v_ystart and created_at <= v_now - interval '1 day' and kept),
    'sales', (select coalesce(sum(total), 0) from o where created_at >= v_start and kept),
    'sales_prev', (select coalesce(sum(total), 0) from o where created_at >= v_ystart and created_at <= v_now - interval '1 day' and kept),
    'carts', (select count(*) from s where last_seen_at > v_now - interval '30 minutes' and coalesce(cart_items, 0) > 0
               and checkout_at is null and purchased_at is null),
    'checkouts', (select count(*) from s where last_seen_at > v_now - interval '30 minutes' and checkout_at is not null and purchased_at is null),
    'purchased', (select count(*) from s where purchased_at >= v_start),
    'spark', jsonb_build_object(
      'sessions', (select jsonb_agg((select count(*) from s where started_at >= v_start and extract(hour from started_at at time zone tz)::int = h.h) order by h.h) from hours h),
      'orders', (select jsonb_agg((select count(*) from o where created_at >= v_start and kept and extract(hour from created_at at time zone tz)::int = h.h) order by h.h) from hours h),
      'sales', (select jsonb_agg((select coalesce(sum(total), 0) from o where created_at >= v_start and kept and extract(hour from created_at at time zone tz)::int = h.h) order by h.h) from hours h)
    ),
    -- Today's funnel, by visit.
    'funnel', jsonb_build_object(
      'sessions', (select count(*) from s where started_at >= v_start),
      'viewed', (select count(*) from s where started_at >= v_start
                  and exists (select 1 from public.analytics_events e where e.session_id = s.id and e.type in ('view_item', 'add_to_cart'))),
      'carted', (select count(*) from s where started_at >= v_start and carted_at is not null),
      'checkout', (select count(*) from s where started_at >= v_start and checkout_at is not null),
      'purchased', (select count(*) from s where started_at >= v_start and purchased_at is not null)
    ),
    -- Who is on the store right now.
    'live_visitors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', left(id::text, 6), 'device', device, 'place', place, 'precise', precise,
        'path', coalesce(current_path, landing_path), 'since', started_at, 'pages', pageviews,
        'cart_value', coalesce(cart_value, 0), 'cart_items', coalesce(cart_items, 0),
        'step', case when purchased_at is not null then 'purchased' when checkout_at is not null then 'checkout'
                     when coalesce(cart_items, 0) > 0 then 'cart' else 'browsing' end,
        'source', coalesce(nullif(lower(utm_source), ''), public._ref_source(referrer_host), 'direct'),
        'lang', lang
      ) order by last_seen_at desc), '[]'::jsonb)
      from (select * from s where last_seen_at > v_now - v_live order by last_seen_at desc limit 50) t
    ),
    -- Carts with something in them, last 30 minutes, not bought yet.
    'open_carts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', left(id::text, 6), 'place', place, 'precise', precise, 'value', cart_value, 'items', cart_items,
        'checkout', checkout_at is not null, 'seen', last_seen_at, 'live', last_seen_at > v_now - v_live
      ) order by last_seen_at desc), '[]'::jsonb)
      from (select * from s where last_seen_at > v_now - interval '30 minutes' and coalesce(cart_items, 0) > 0
              and purchased_at is null order by last_seen_at desc limit 30) t
    ),
    -- What people did today, newest first.
    'feed', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'at', at, 'type', type, 'path', path, 'product', product, 'option', option, 'qty', qty, 'value', value,
        'area', meta ->> 'area', 'id', left(session_id::text, 6), 'place', place, 'precise', precise, 'device', device
      ) order by at desc), '[]'::jsonb)
      from (select * from ev order by at desc limit 40) t
    ),
    'locations', (
      select coalesce(jsonb_agg(jsonb_build_object('label', l, 'n', n) order by n desc), '[]'::jsonb) from (
        select place as l, count(*) as n from s where started_at >= v_start group by 1 order by 2 desc limit 8
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
      'visitors', (select coalesce(jsonb_agg(jsonb_build_object('lat', coalesce(pin_lat, lat), 'lng', coalesce(pin_lng, lng),
                                                                'city', place, 'precise', precise)), '[]'::jsonb) from (
                     select * from s where last_seen_at > v_now - v_live and coalesce(pin_lat, lat) is not null limit 200) t),
      'orders', (select coalesce(jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'name', '#' || number)), '[]'::jsonb) from (
                   select lat, lng, number from o where created_at >= v_start and kept and lat is not null limit 200) t)
    )
  ) into res;

  return res;
end;
$$;
