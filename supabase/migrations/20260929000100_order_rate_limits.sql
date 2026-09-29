-- Store-wide caps, so rotating phone numbers can't flood orders or abandoned checkouts.
-- place_order is unchanged apart from the store_busy check.

create or replace function public.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  if (select count(*) from public.orders where public.orders.phone = v_phone and created_at > now() - interval '30 minutes') >= 3 then
    raise exception 'too_many_orders';
  end if;

  -- Store-wide cap: far above real traffic, low enough to stop a script.
  if (select count(*) from public.orders where source = 'web' and created_at > now() - interval '15 minutes') >= 20 then
    raise exception 'store_busy';
  end if;

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
$function$;

-- Abandoned checkouts: cap new rows per hour, cap cart size, keep subtotal sane.
create or replace function public.store_track_checkout(p jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  ph text := public._normalize_phone(p ->> 'phone');
  existing uuid;
  v_sub numeric;
begin
  if ph is null or jsonb_typeof(p -> 'cart') <> 'array' then return; end if;
  if pg_column_size(p -> 'cart') > 16384 then return; end if;
  begin
    v_sub := least(greatest(coalesce((p ->> 'subtotal')::numeric, 0), 0), 1000000);
  exception when others then
    v_sub := 0;
  end;

  select id into existing from public.abandoned_checkouts
  where phone = ph and recovered_order_id is null and created_at > now() - interval '1 day'
  order by created_at desc limit 1;

  if existing is null then
    if (select count(*) from public.abandoned_checkouts where created_at > now() - interval '1 hour') >= 100 then
      return;
    end if;
    insert into public.abandoned_checkouts (phone, name, cart, subtotal, utm_source, utm_medium, utm_campaign)
    values (ph, left(p ->> 'name', 80), (select jsonb_agg(x) from (select x from jsonb_array_elements(p -> 'cart') x limit 50) y),
            v_sub, left(p ->> 'utm_source', 100), left(p ->> 'utm_medium', 100), left(p ->> 'utm_campaign', 150));
  else
    update public.abandoned_checkouts set
      name = coalesce(left(p ->> 'name', 80), name),
      cart = (select jsonb_agg(x) from (select x from jsonb_array_elements(p -> 'cart') x limit 50) y),
      subtotal = v_sub
    where id = existing;
  end if;
end;
$function$;
