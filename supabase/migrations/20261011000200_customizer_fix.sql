-- Made-to-order lines: table aliases renamed so they don't collide with the function's own variables (b, d).

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
