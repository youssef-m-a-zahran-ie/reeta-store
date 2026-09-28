-- Orders: pricing, stock, discounts, delivery fee and placement, all in one place in the database,
-- so the price a customer pays can never be changed from the browser.

create extension if not exists pg_net;

alter table public.settings add column if not exists site_url text not null default 'https://reeta-store.youssef-m-a-zahran.workers.dev';

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------

-- Egyptian mobile numbers in any common form → +201XXXXXXXXX, or null.
create or replace function public._normalize_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^01[0125][0-9]{8}$' then '+2' || d
    when d ~ '^201[0125][0-9]{8}$' then '+' || d
    when d ~ '^00201[0125][0-9]{8}$' then '+' || substr(d, 3)
    else null
  end
  from (select regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g') as d) x;
$$;

-- Straight-line distance in km.
create or replace function public._km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Delivery fee for a point: straight line from the store × road factor × price per km,
-- rounded up, never below the minimum. The store location itself is never returned.
create or replace function public._delivery(p_lat float8, p_lng float8)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when p_lat is null or p_lng is null then null
    when s.store_lat is null or s.fee_per_km is null then
      jsonb_build_object('distance_km', null, 'fee', s.min_shipping_fee)
    else (
      select jsonb_build_object(
        'distance_km', round(d::numeric, 1),
        'fee', greatest(s.min_shipping_fee, ceil((d * s.fee_per_km) / s.fee_round_to) * s.fee_round_to)
      )
      from (select public._km(s.store_lat, s.store_lng, p_lat, p_lng) * s.distance_factor as d) x
    )
  end
  from public.settings s where s.id = 1;
$$;

-- ---------------------------------------------------------------
-- The calculator: turns a cart into priced lines, stock needs and totals.
-- Input: { items: [{kind: 'variant'|'bundle', id, qty}], lat, lng, discount_code }
-- ---------------------------------------------------------------
create or replace function public._compute_order(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
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
begin
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'empty');
  elsif jsonb_array_length(p -> 'items') > 50 then
    v_errors := v_errors || jsonb_build_object('code', 'too_many_items');
  end if;

  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    idx := idx + 1;
    v_qty := least(greatest(coalesce((it ->> 'qty')::int, 1), 1), 20);

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
        line_cost := line_cost + coalesce(bi.unit_cost, 0) * bi.n;
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

  -- Stock: add up what the cart needs per product (grams) or per size (pieces).
  for need in
    select (n ->> 'product_id')::uuid as product_id, (n ->> 'variant_id')::uuid as variant_id, sum((n ->> 'amount')::numeric) as amount
    from jsonb_array_elements(v_needs) n
    group by 1, 2
  loop
    if need.variant_id is null then
      select pr.stock_grams into have from public.products pr where pr.id = need.product_id;
    else
      select va.stock_qty into have from public.variants va where va.id = need.variant_id;
    end if;
    if coalesce(have, 0) < need.amount then
      v_errors := v_errors || jsonb_build_object(
        'code', 'out_of_stock',
        'product_id', need.product_id,
        'name_en', (select pr.name_en from public.products pr where pr.id = need.product_id),
        'name_ar', (select pr.name_ar from public.products pr where pr.id = need.product_id)
      );
    end if;
  end loop;

  -- Discount code
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

  -- Automatic free delivery over a set amount
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
    'shipping_fee', v_fee,
    'total', v_subtotal - disc + v_fee
  );
end;
$$;

-- ---------------------------------------------------------------
-- Public: live price check for the checkout page (no costs returned).
-- ---------------------------------------------------------------
create or replace function public.store_quote(p jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c - 'needs' || jsonb_build_object(
    'lines', coalesce((select jsonb_agg(l - 'unit_cost') from jsonb_array_elements(c -> 'lines') l), '[]'::jsonb),
    'orders_paused', (select s.orders_paused from public.settings s where s.id = 1)
  )
  from (select public._compute_order(p) as c) x;
$$;

-- ---------------------------------------------------------------
-- Public: place the order. Everything is re-checked here.
-- ---------------------------------------------------------------
create or replace function public.place_order(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.settings;
  v_phone text := public._normalize_phone(p ->> 'phone');
  v_name text := left(trim(coalesce(p ->> 'name', '')), 80);
  v_addr text := left(trim(coalesce(p ->> 'address_line', '')), 300);
  v_lat float8 := (p ->> 'lat')::float8;
  v_lng float8 := (p ->> 'lng')::float8;
  pay public.payment_method;
  c jsonb;
  fatal jsonb;
  cust uuid;
  o public.orders;
  l jsonb;
  n record;
begin
  -- Bots fill hidden fields; people don't.
  if coalesce(p ->> 'website', '') <> '' then
    raise exception 'rejected';
  end if;

  select * into s from public.settings where id = 1;
  if s.orders_paused then
    raise exception 'orders_paused';
  end if;

  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;
  if length(v_addr) < 3 then raise exception 'invalid_address'; end if;
  if v_lat is null or v_lng is null or v_lat not between 21.5 and 32 or v_lng not between 24.5 and 37 then
    raise exception 'invalid_location';
  end if;
  begin
    pay := (p ->> 'payment_method')::public.payment_method;
  exception when others then
    raise exception 'invalid_payment';
  end;
  if pay is null then raise exception 'invalid_payment'; end if;

  -- Slow down repeated orders from one number.
  if (select count(*) from public.orders where public.orders.phone = v_phone and created_at > now() - interval '30 minutes') >= 3 then
    raise exception 'too_many_orders';
  end if;

  -- Lock the stock rows this cart touches, then price it.
  perform 1 from public.products pr
  where pr.id in (select (x ->> 'product_id')::uuid from jsonb_array_elements((public._compute_order(p)) -> 'needs') x)
  for update;

  c := public._compute_order(p);
  select jsonb_agg(e) into fatal from jsonb_array_elements(c -> 'errors') e;
  if fatal is not null then
    raise exception 'order_invalid' using detail = fatal::text;
  end if;

  insert into public.customers as cu (phone, name) values (v_phone, v_name)
  on conflict (phone) do update set name = excluded.name
  returning id into cust;

  insert into public.orders (
    customer_id, customer_name, phone, address_line, building, floor, apartment, landmark,
    lat, lng, distance_km, distance_method, subtotal, discount_total, shipping_fee, total,
    discount_id, discount_code, payment_method, customer_note, source,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, lang
  ) values (
    cust, v_name, v_phone, v_addr,
    nullif(left(trim(coalesce(p ->> 'building', '')), 60), ''),
    nullif(left(trim(coalesce(p ->> 'floor', '')), 30), ''),
    nullif(left(trim(coalesce(p ->> 'apartment', '')), 30), ''),
    nullif(left(trim(coalesce(p ->> 'landmark', '')), 200), ''),
    v_lat, v_lng, (c ->> 'distance_km')::numeric, 'straight',
    (c ->> 'subtotal')::numeric, (c ->> 'discount_total')::numeric, (c ->> 'shipping_fee')::numeric, (c ->> 'total')::numeric,
    (c -> 'discount' ->> 'id')::uuid, c -> 'discount' ->> 'code', pay,
    nullif(left(trim(coalesce(p ->> 'note', '')), 500), ''), 'web',
    left(p ->> 'utm_source', 100), left(p ->> 'utm_medium', 100), left(p ->> 'utm_campaign', 150),
    left(p ->> 'utm_content', 150), left(p ->> 'utm_term', 150), left(p ->> 'referrer', 300),
    case when p ->> 'lang' = 'ar' then 'ar' else 'en' end
  ) returning * into o;

  for l in select * from jsonb_array_elements(c -> 'lines') loop
    insert into public.order_items (order_id, product_id, variant_id, bundle_id, name_en, name_ar, option_label, grams, qty, unit_price, unit_cost, line_total)
    values (
      o.id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid, (l ->> 'bundle_id')::uuid,
      l ->> 'name_en', l ->> 'name_ar', l ->> 'label_en', (l ->> 'grams')::numeric,
      (l ->> 'qty')::int, (l ->> 'unit_price')::numeric, (l ->> 'unit_cost')::numeric, (l ->> 'line_total')::numeric
    );
  end loop;

  for n in
    select (x ->> 'product_id')::uuid as product_id, (x ->> 'variant_id')::uuid as variant_id, sum((x ->> 'amount')::numeric) as amount
    from jsonb_array_elements(c -> 'needs') x group by 1, 2
  loop
    if n.amount > 0 then
      insert into public.stock_movements (product_id, variant_id, delta, reason, order_id)
      values (n.product_id, n.variant_id, -n.amount, 'order', o.id);
    end if;
  end loop;

  if c -> 'discount' ->> 'id' is not null then
    update public.discounts set used_count = used_count + 1 where id = (c -> 'discount' ->> 'id')::uuid;
  end if;

  insert into public.order_events (order_id, type, to_value) values (o.id, 'created', 'new');

  update public.abandoned_checkouts set recovered_order_id = o.id
  where public.abandoned_checkouts.phone = v_phone and recovered_order_id is null and created_at > now() - interval '3 days';

  perform public._notify_new_order(o.id);

  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total);
end;
$$;

-- ---------------------------------------------------------------
-- Public: the confirmation page for one order (by its unguessable id).
-- ---------------------------------------------------------------
create or replace function public.store_order(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'created_at', o.created_at, 'status', o.status,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'customer_name', o.customer_name, 'phone', o.phone,
    'address_line', o.address_line, 'building', o.building, 'floor', o.floor, 'apartment', o.apartment, 'landmark', o.landmark,
    'subtotal', o.subtotal, 'discount_total', o.discount_total, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'discount_code', o.discount_code,
    'items', (select jsonb_agg(jsonb_build_object('name_en', i.name_en, 'name_ar', i.name_ar, 'label', i.option_label, 'qty', i.qty, 'line_total', i.line_total) order by i.id)
              from public.order_items i where i.order_id = o.id),
    'instapay_handle', s.instapay_handle, 'instapay_name', s.instapay_name, 'whatsapp_number', s.whatsapp_number
  )
  from public.orders o cross join public.settings s
  where o.id = p_id and s.id = 1 and o.created_at > now() - interval '60 days';
$$;

-- ---------------------------------------------------------------
-- Public: remember a checkout that has a phone number, so the team can follow up.
-- ---------------------------------------------------------------
create or replace function public.store_track_checkout(p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ph text := public._normalize_phone(p ->> 'phone');
  existing uuid;
begin
  if ph is null or jsonb_typeof(p -> 'cart') <> 'array' then return; end if;
  select id into existing from public.abandoned_checkouts
  where phone = ph and recovered_order_id is null and created_at > now() - interval '1 day'
  order by created_at desc limit 1;
  if existing is null then
    insert into public.abandoned_checkouts (phone, name, cart, subtotal, utm_source, utm_medium, utm_campaign)
    values (ph, left(p ->> 'name', 80), (select jsonb_agg(x) from (select x from jsonb_array_elements(p -> 'cart') x limit 50) y),
            (p ->> 'subtotal')::numeric, left(p ->> 'utm_source', 100), left(p ->> 'utm_medium', 100), left(p ->> 'utm_campaign', 150));
  else
    update public.abandoned_checkouts set
      name = coalesce(left(p ->> 'name', 80), name),
      cart = (select jsonb_agg(x) from (select x from jsonb_array_elements(p -> 'cart') x limit 50) y),
      subtotal = (p ->> 'subtotal')::numeric
    where id = existing;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Admin: change an order's status. Cancelled and refused orders put their stock back.
-- ---------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.orders;
  closed constant public.order_status[] := array['cancelled', 'refused']::public.order_status[];
  m record;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.status = p_status then return; end if;

  if p_status = any (closed) and not (o.status = any (closed)) then
    for m in select product_id, variant_id, sum(delta) as d from public.stock_movements where order_id = o.id group by 1, 2 loop
      if m.d < 0 then
        insert into public.stock_movements (product_id, variant_id, delta, reason, order_id)
        values (m.product_id, m.variant_id, -m.d, p_status::text::public.movement_reason, o.id);
      end if;
    end loop;
  elsif o.status = any (closed) and not (p_status = any (closed)) then
    for m in select product_id, variant_id, sum(delta) as d from public.stock_movements where order_id = o.id and reason = 'order' group by 1, 2 loop
      insert into public.stock_movements (product_id, variant_id, delta, reason, order_id, note)
      values (m.product_id, m.variant_id, m.d, 'order', o.id, 'Order reopened');
    end loop;
  end if;

  if p_status = 'refused' then
    update public.customers set refused_count = refused_count + 1, flagged = true where id = o.customer_id;
  elsif o.status = 'refused' then
    update public.customers set refused_count = greatest(refused_count - 1, 0) where id = o.customer_id;
  end if;

  update public.orders set
    status = p_status,
    confirmed_at = case when p_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    payment_status = case when p_status = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end
  where id = o.id;

  insert into public.order_events (order_id, type, from_value, to_value, note, created_by)
  values (o.id, 'status', o.status::text, p_status::text, nullif(trim(p_note), ''), auth.uid());
end;
$$;

-- ---------------------------------------------------------------
-- New-order email through Resend. The API key lives in Vault as 'resend_api_key'.
-- No key yet = no email; the order is saved either way.
-- ---------------------------------------------------------------
create or replace function public._notify_new_order(p_order uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
  o public.orders;
  s public.settings;
  item_rows text;
  html text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then return; end if;
  select * into o from public.orders where id = p_order;
  select * into s from public.settings where id = 1;
  if o.id is null or coalesce(array_length(s.notify_emails, 1), 0) = 0 then return; end if;

  select string_agg(format(
    '<tr><td style="padding:6px 0">%s × %s%s</td><td style="padding:6px 0;text-align:right">%s EGP</td></tr>',
    i.qty, replace(replace(i.name_en, '<', '&lt;'), '>', '&gt;'), coalesce(' · ' || i.option_label, ''), i.line_total), '' order by i.id)
  into item_rows from public.order_items i where i.order_id = o.id;

  html := format($h$
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#3a2420">
  <div style="background:#5b4659;color:#f2d0e3;padding:18px 22px;border-radius:18px 18px 0 0">
    <div style="font-size:13px;letter-spacing:.08em">REETA · NEW ORDER</div>
    <div style="font-size:26px;font-weight:bold">#%s · %s EGP</div>
  </div>
  <div style="background:#fef9f1;padding:18px 22px;border:1px solid #f2d0e3;border-top:0;border-radius:0 0 18px 18px">
    <p style="margin:0 0 4px"><b>%s</b> · %s</p>
    <p style="margin:0 0 4px">%s</p>
    <p style="margin:0 0 12px"><a href="https://www.google.com/maps?q=%s,%s" style="color:#5b4659">Open location on the map</a></p>
    <table style="width:100%%;border-collapse:collapse;border-top:1px solid #f2d0e3">%s
      <tr><td style="padding:6px 0;border-top:1px solid #f2d0e3">Delivery</td><td style="padding:6px 0;border-top:1px solid #f2d0e3;text-align:right">%s EGP</td></tr>
      <tr><td style="padding:6px 0">Discount</td><td style="padding:6px 0;text-align:right">-%s EGP</td></tr>
      <tr><td style="padding:6px 0"><b>Total</b></td><td style="padding:6px 0;text-align:right"><b>%s EGP</b></td></tr>
    </table>
    <p style="margin:12px 0">Payment: <b>%s</b>%s</p>
    <a href="%s/admin/orders/%s" style="display:inline-block;background:#5b4659;color:#f2d0e3;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open in admin</a>
  </div>
</div>$h$,
    o.number, o.total,
    replace(replace(o.customer_name, '<', '&lt;'), '>', '&gt;'), o.phone,
    replace(replace(concat_ws(', ', o.address_line, o.building, o.floor, o.apartment, o.landmark), '<', '&lt;'), '>', '&gt;'),
    o.lat, o.lng, coalesce(item_rows, ''), o.shipping_fee, o.discount_total, o.total,
    case o.payment_method when 'cod' then 'Cash on delivery' else 'InstaPay (check the transfer)' end,
    coalesce('<br>Note: ' || replace(replace(o.customer_note, '<', '&lt;'), '>', '&gt;'), ''),
    s.site_url, o.id);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Reeta Orders <onboarding@resend.dev>',
      'to', to_jsonb(s.notify_emails),
      'subject', format('New order #%s · %s EGP', o.number, o.total),
      'html', html
    )
  );
exception when others then
  -- Never let an email problem block an order.
  raise warning 'order email failed: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------
revoke execute on function public._normalize_phone(text) from public, anon, authenticated;
revoke execute on function public._km(float8, float8, float8, float8) from public, anon, authenticated;
revoke execute on function public._delivery(float8, float8) from public, anon, authenticated;
revoke execute on function public._compute_order(jsonb) from public, anon, authenticated;
revoke execute on function public._notify_new_order(uuid) from public, anon, authenticated;
revoke execute on function public.store_quote(jsonb) from public;
revoke execute on function public.place_order(jsonb) from public;
revoke execute on function public.store_order(uuid) from public;
revoke execute on function public.store_track_checkout(jsonb) from public;
revoke execute on function public.admin_set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.store_quote(jsonb) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.store_order(uuid) to anon, authenticated;
grant execute on function public.store_track_checkout(jsonb) to anon, authenticated;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;
