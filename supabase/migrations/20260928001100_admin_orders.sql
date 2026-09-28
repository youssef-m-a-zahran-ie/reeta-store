-- Orders the team takes by hand (WhatsApp, Instagram, phone) go through the same pricing,
-- stock and discount rules as web orders. Admins may also skip the map (typing a delivery fee)
-- and sell past the recorded stock when the shelf and the numbers disagree.

create or replace function public._admin_compute(p jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c jsonb := public._compute_order(p);
  v_fee numeric;
begin
  if coalesce(p ->> 'shipping_fee', '') <> '' then
    v_fee := greatest((p ->> 'shipping_fee')::numeric, 0);
    c := c || jsonb_build_object(
      'shipping_fee', v_fee,
      'fee_overridden', true,
      'total', (c ->> 'subtotal')::numeric - (c ->> 'discount_total')::numeric + v_fee
    );
  end if;
  if coalesce((p ->> 'allow_short_stock')::boolean, false) then
    c := c || jsonb_build_object(
      'short_stock', coalesce((select jsonb_agg(e) from jsonb_array_elements(c -> 'errors') e where e ->> 'code' = 'out_of_stock'), '[]'::jsonb),
      'errors', coalesce((select jsonb_agg(e) from jsonb_array_elements(c -> 'errors') e where e ->> 'code' <> 'out_of_stock'), '[]'::jsonb)
    );
  end if;
  return c;
end;
$$;

-- Live preview for the admin order form (costs included; admins may see them).
create or replace function public.admin_quote(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return public._admin_compute(p) - 'needs';
end;
$$;

create or replace function public.admin_place_order(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := public._normalize_phone(p ->> 'phone');
  v_name text := left(trim(coalesce(p ->> 'name', '')), 80);
  v_addr text := left(trim(coalesce(p ->> 'address_line', '')), 300);
  v_lat float8 := nullif(p ->> 'lat', '')::float8;
  v_lng float8 := nullif(p ->> 'lng', '')::float8;
  v_source text := coalesce(nullif(p ->> 'source', ''), 'whatsapp');
  v_status public.order_status := case when p ->> 'status' = 'new' then 'new' else 'confirmed' end;
  v_paid boolean := coalesce((p ->> 'paid')::boolean, false);
  pay public.payment_method;
  c jsonb;
  fatal jsonb;
  cust uuid;
  o public.orders;
  l jsonb;
  n record;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;
  if length(v_addr) < 3 then raise exception 'invalid_address'; end if;
  if (v_lat is null) <> (v_lng is null)
     or (v_lat is not null and (v_lat not between 21.5 and 32 or v_lng not between 24.5 and 37)) then
    raise exception 'invalid_location';
  end if;
  if v_lat is null and coalesce(p ->> 'shipping_fee', '') = '' then
    raise exception 'needs_fee';
  end if;
  if v_source not in ('whatsapp', 'instagram', 'phone', 'other') then raise exception 'invalid_source'; end if;
  begin
    pay := (p ->> 'payment_method')::public.payment_method;
  exception when others then
    raise exception 'invalid_payment';
  end;
  if pay is null then raise exception 'invalid_payment'; end if;

  perform 1 from public.products pr
  where pr.id in (select (x ->> 'product_id')::uuid from jsonb_array_elements((public._compute_order(p)) -> 'needs') x)
  for update;

  c := public._admin_compute(p);
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
    discount_id, discount_code, payment_method, payment_status, status, confirmed_at,
    customer_note, internal_note, source, lang
  ) values (
    cust, v_name, v_phone, v_addr,
    nullif(left(trim(coalesce(p ->> 'building', '')), 60), ''),
    nullif(left(trim(coalesce(p ->> 'floor', '')), 30), ''),
    nullif(left(trim(coalesce(p ->> 'apartment', '')), 30), ''),
    nullif(left(trim(coalesce(p ->> 'landmark', '')), 200), ''),
    v_lat, v_lng, nullif(c ->> 'distance_km', '')::numeric, case when v_lat is not null then 'straight' end,
    (c ->> 'subtotal')::numeric, (c ->> 'discount_total')::numeric, (c ->> 'shipping_fee')::numeric, (c ->> 'total')::numeric,
    (c -> 'discount' ->> 'id')::uuid, c -> 'discount' ->> 'code', pay,
    case when v_paid then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
    v_status, case when v_status = 'confirmed' then now() end,
    nullif(left(trim(coalesce(p ->> 'note', '')), 500), ''),
    nullif(left(trim(coalesce(p ->> 'internal_note', '')), 1000), ''),
    v_source,
    case when p ->> 'lang' = 'en' then 'en' else 'ar' end
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

  insert into public.order_events (order_id, type, to_value, note, created_by)
  values (o.id, 'created', 'new', 'Added by the team (' || v_source || ')', auth.uid());
  if v_status = 'confirmed' then
    insert into public.order_events (order_id, type, from_value, to_value, created_by)
    values (o.id, 'status', 'new', 'confirmed', auth.uid());
  end if;
  if v_paid then
    insert into public.order_events (order_id, type, from_value, to_value, created_by)
    values (o.id, 'payment', 'unpaid', 'paid', auth.uid());
  end if;

  update public.abandoned_checkouts set recovered_order_id = o.id
  where public.abandoned_checkouts.phone = v_phone and recovered_order_id is null and created_at > now() - interval '3 days';

  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total);
end;
$$;

revoke execute on function public._admin_compute(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_quote(jsonb) from public, anon;
revoke execute on function public.admin_place_order(jsonb) from public, anon;
grant execute on function public.admin_quote(jsonb) to authenticated;
grant execute on function public.admin_place_order(jsonb) to authenticated;
