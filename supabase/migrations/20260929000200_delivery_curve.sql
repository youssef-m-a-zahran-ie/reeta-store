-- Delivery pricing: a fee curve between a minimum and a maximum, and a delivery radius.
--
-- fee(d) = max · (1 − e^(−d/k)) / (1 − e^(−max_km/k))
-- starts at per_km per km near the store, eases off, and reaches max exactly at max_km.
-- k is solved from per_km. Then rounded up and kept between min and max.
-- Beyond max_km there's no delivery: _compute_order adds 'out_of_range'.

alter table public.settings
  add column max_shipping_fee numeric(10, 2) check (max_shipping_fee is null or max_shipping_fee >= 0),
  add column max_delivery_km numeric(6, 1) check (max_delivery_km is null or max_delivery_km > 0);

update public.settings set min_shipping_fee = 50, max_shipping_fee = 200, max_delivery_km = 60 where id = 1;

create or replace function public._delivery_fee(
  p_km numeric, p_per_km numeric, p_min numeric, p_max numeric, p_max_km numeric, p_round int
)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  d float8 := p_km;
  big float8 := p_max_km;
  target float8;
  lo float8 := 0.001;
  hi float8;
  k float8;
  raw float8;
  r int := greatest(coalesce(p_round, 1), 1);
begin
  if p_max is null or p_max_km is null or p_per_km <= 0 or p_per_km * p_max_km <= p_max then
    -- No curve needed: a straight line never passes the maximum inside the radius.
    raw := p_per_km * d;
  else
    -- Solve k·(1 − e^(−max_km/k)) = max/per_km, so the curve starts at per_km per km.
    target := p_max / p_per_km;
    hi := big * 1000;
    for i in 1..60 loop
      k := (lo + hi) / 2;
      if k * (1 - exp(-big / k)) < target then lo := k; else hi := k; end if;
    end loop;
    raw := p_max * (1 - exp(-d / k)) / (1 - exp(-big / k));
  end if;
  return least(coalesce(p_max, 'infinity'::numeric), greatest(p_min, ceil(raw::numeric / r) * r));
end;
$function$;

create or replace function public._delivery(p_lat double precision, p_lng double precision)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select case
    when p_lat is null or p_lng is null then null
    when s.store_lat is null or s.fee_per_km is null then
      jsonb_build_object('distance_km', null, 'fee', s.min_shipping_fee)
    else (
      select case
        when s.max_delivery_km is not null and d > s.max_delivery_km then
          jsonb_build_object('distance_km', round(d, 1), 'fee', null, 'out_of_range', true)
        else
          jsonb_build_object('distance_km', round(d, 1),
            'fee', public._delivery_fee(d, s.fee_per_km, s.min_shipping_fee, s.max_shipping_fee, s.max_delivery_km, s.fee_round_to))
      end
      from (select (public._km(s.store_lat, s.store_lng, p_lat, p_lng) * s.distance_factor)::numeric as d) x
    )
  end
  from public.settings s where s.id = 1;
$function$;

-- Same as before, plus the out_of_range error.
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

-- Manual orders: a fee typed by the admin overrides the delivery radius too.
create or replace function public._admin_compute(p jsonb)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  c jsonb := public._compute_order(p);
  v_fee numeric;
begin
  if coalesce(p ->> 'shipping_fee', '') <> '' then
    v_fee := greatest((p ->> 'shipping_fee')::numeric, 0);
    c := c || jsonb_build_object(
      'shipping_fee', v_fee,
      'fee_overridden', true,
      'total', (c ->> 'subtotal')::numeric - (c ->> 'discount_total')::numeric + v_fee,
      'errors', coalesce((select jsonb_agg(e) from jsonb_array_elements(c -> 'errors') e where e ->> 'code' <> 'out_of_range'), '[]'::jsonb)
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
$function$;
