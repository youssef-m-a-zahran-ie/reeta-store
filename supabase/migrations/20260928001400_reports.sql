-- Numbers for the dashboard and reports, computed in one pass in the database.
-- Days, hours and weekdays are in Cairo time. Cancelled and refused orders don't count as sales.

-- Which ad platform an order's source belongs to, so spend can be matched to sales.
create or replace function public._source_platform(p_source text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source is null then null
    when lower(p_source) in ('meta', 'facebook', 'fb', 'instagram', 'ig', 'ig_ads', 'fb_ads') then 'meta'
    when lower(p_source) in ('tiktok', 'tt', 'tiktok_ads') then 'tiktok'
    when lower(p_source) in ('google', 'gads', 'google_ads', 'youtube', 'yt') then 'google'
    when lower(p_source) in ('snapchat', 'snap') then 'snapchat'
    else null
  end;
$$;

-- Ad spend inside a date range; entries that only partly overlap count pro rata by day.
create or replace function public._spend_between(p_from date, p_to date)
returns table (platform text, amount numeric)
language sql
stable
set search_path = ''
as $$
  select a.platform::text,
         sum(a.amount * (least(a.period_end, p_to) - greatest(a.period_start, p_from) + 1)::numeric
             / (a.period_end - a.period_start + 1)) as amount
  from public.ad_spend a
  where a.period_start <= p_to and a.period_end >= p_from
  group by 1;
$$;

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
        'aov', coalesce(round(avg(total) filter (where kept), 2), 0),
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
        'aov', coalesce(round(avg(total) filter (where kept), 2), 0),
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
          'platform', public._source_platform(src),
          'orders', count(*),
          'sales', sum(total),
          'profit', sum(subtotal - discount_total - cost)
        ) as s
        from (select *, coalesce(nullif(lower(utm_source), ''), case when source = 'web' then 'direct' else source end) as src from cur where kept) c
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

-- Helpers run as the signed-in admin (admin_report is not SECURITY DEFINER), so they stay callable by signed-in users.
revoke execute on function public._source_platform(text) from public, anon;
revoke execute on function public._spend_between(date, date) from public, anon;
grant execute on function public._source_platform(text) to authenticated;
grant execute on function public._spend_between(date, date) to authenticated;
revoke execute on function public.admin_report(date, date) from public, anon;
grant execute on function public.admin_report(date, date) to authenticated;
