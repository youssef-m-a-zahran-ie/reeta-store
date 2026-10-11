-- The Atelier: shoppers compose their own pouch (nut + coating + size).
-- Everything that sets the price, weight, cost and stock lives here and is edited in the admin.
--
-- price of a pouch = base price at that size + coating price at that size (same for cost)
-- grams of a pouch = the base's net weight at that size
-- stock: the base's nuts and the coating are tracked in grams; coating_share splits the weight between them.

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table public.custom_sizes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  tier smallint not null default 2 check (tier between 1 and 3),   -- how big the bowl looks: 1 small, 2 medium, 3 large
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A base offered in the Atelier. `visual` picks its photo set in the store code.
create table public.custom_bases (
  base_id uuid primary key references public.bases(id) on delete cascade,
  visual text check (visual ~ '^[a-z0-9-]+$'),
  display text not null default 'weight' check (display in ('weight', 'size')),   -- show grams, or only the size name
  coating_share numeric(5,2) not null default 35 check (coating_share between 0 and 90), -- % of the weight that is coating
  note_en text,
  note_ar text,
  sort int not null default 0,
  is_active boolean not null default true,
  stock_grams numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 0,
  track_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custom_coatings (
  coating_id uuid primary key references public.coatings(id) on delete cascade,
  visual text check (visual ~ '^[a-z0-9-]+$'),
  note_en text,
  note_ar text,
  sort int not null default 0,
  is_active boolean not null default true,
  stock_grams numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 0,
  track_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Null price = this base isn't sold at this size.
create table public.custom_base_prices (
  base_id uuid not null references public.custom_bases(base_id) on delete cascade,
  size_id uuid not null references public.custom_sizes(id) on delete cascade,
  grams numeric(10,2) check (grams is null or grams > 0),
  price numeric(10,2) check (price is null or price >= 0),
  cost numeric(10,2) check (cost is null or cost >= 0),
  primary key (base_id, size_id)
);

create table public.custom_coating_prices (
  coating_id uuid not null references public.custom_coatings(coating_id) on delete cascade,
  size_id uuid not null references public.custom_sizes(id) on delete cascade,
  price numeric(10,2) check (price is null or price >= 0),
  cost numeric(10,2) check (cost is null or cost >= 0),
  primary key (coating_id, size_id)
);
create index custom_base_prices_size_idx on public.custom_base_prices(size_id);
create index custom_coating_prices_size_idx on public.custom_coating_prices(size_id);

alter table public.settings add column custom_enabled boolean not null default true;

create trigger custom_sizes_updated_at before update on public.custom_sizes for each row execute function public.set_updated_at();
create trigger custom_bases_updated_at before update on public.custom_bases for each row execute function public.set_updated_at();
create trigger custom_coatings_updated_at before update on public.custom_coatings for each row execute function public.set_updated_at();

-- Admin only. Shoppers read through store_customizer().
do $$
declare t text;
begin
  foreach t in array array['custom_sizes','custom_bases','custom_coatings','custom_base_prices','custom_coating_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin full access" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Orders and stock know about made-to-order lines
-- ---------------------------------------------------------------
alter table public.order_items
  add column base_id uuid references public.bases(id) on delete set null,
  add column coating_id uuid references public.coatings(id) on delete set null,
  add column custom_size_id uuid references public.custom_sizes(id) on delete set null,
  add column option_label_ar text;

alter table public.stock_movements
  alter column product_id drop not null,
  add column base_id uuid references public.bases(id) on delete cascade,
  add column coating_id uuid references public.coatings(id) on delete cascade,
  add constraint stock_movements_one_target check (num_nonnulls(product_id, base_id, coating_id) = 1);
create index stock_movements_base_idx on public.stock_movements(base_id, created_at desc) where base_id is not null;
create index stock_movements_coating_idx on public.stock_movements(coating_id, created_at desc) where coating_id is not null;
create index order_items_base_idx on public.order_items(base_id) where base_id is not null;
create index order_items_coating_idx on public.order_items(coating_id) where coating_id is not null;
create index order_items_custom_size_idx on public.order_items(custom_size_id) where custom_size_id is not null;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unit public.stock_unit;
begin
  if new.base_id is not null then
    update public.custom_bases set stock_grams = stock_grams + new.delta where base_id = new.base_id;
  elsif new.coating_id is not null then
    update public.custom_coatings set stock_grams = stock_grams + new.delta where coating_id = new.coating_id;
  else
    select p.stock_unit into unit from public.products p where p.id = new.product_id;
    if unit = 'grams' then
      update public.products set stock_grams = stock_grams + new.delta where id = new.product_id;
    else
      if new.variant_id is null then
        raise exception 'Pieces stock needs a variant';
      end if;
      update public.variants set stock_qty = stock_qty + new.delta::int
        where id = new.variant_id and product_id = new.product_id;
    end if;
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.apply_stock_movement() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Storefront read API (no costs, no stock numbers)
-- ---------------------------------------------------------------

-- Every combination a shopper can buy right now, with its price. Internal.
create or replace function public._custom_combos()
returns table (base_id uuid, coating_id uuid, size_id uuid, price numeric, available boolean)
language sql
stable
set search_path = ''
as $$
  select cb.base_id, cc.coating_id, z.id, bp.price + cp.price,
         (not cb.track_stock or cb.stock_grams >= bp.grams * (100 - cb.coating_share) / 100)
         and (not cc.track_stock or cc.stock_grams >= bp.grams * cb.coating_share / 100)
  from public.custom_bases cb
  join public.bases b on b.id = cb.base_id
  join public.custom_base_prices bp on bp.base_id = cb.base_id and bp.price is not null and bp.grams is not null
  join public.custom_sizes z on z.id = bp.size_id and z.is_active
  join public.custom_coating_prices cp on cp.size_id = z.id and cp.price is not null
  join public.custom_coatings cc on cc.coating_id = cp.coating_id and cc.is_active and cc.visual is not null
  join public.coatings c on c.id = cc.coating_id
  where cb.is_active and cb.visual is not null;
$$;
revoke execute on function public._custom_combos() from public, anon, authenticated;

create or replace function public._custom_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public._custom_combos());
$$;
revoke execute on function public._custom_ready() from public, anon, authenticated;

-- Everything the Atelier page needs, in one call. Null when it's switched off or nothing is priced yet.
create or replace function public.store_customizer()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with combos as (select * from public._custom_combos()),
  live as (select s.custom_enabled as on_ from public.settings s where s.id = 1)
  select case when not (select on_ from live) or not exists (select 1 from combos) then null else jsonb_build_object(
    'sizes', (
      select jsonb_agg(jsonb_build_object('id', z.id, 'slug', z.slug, 'name_en', z.name_en, 'name_ar', z.name_ar, 'tier', z.tier)
                       order by z.sort, z.tier)
      from public.custom_sizes z where z.id in (select size_id from combos)
    ),
    'bases', (
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'slug', b.slug, 'name_en', b.name_en, 'name_ar', b.name_ar,
        'visual', cb.visual, 'display', cb.display, 'note_en', cb.note_en, 'note_ar', cb.note_ar,
        'sizes', (
          select jsonb_agg(jsonb_build_object('size_id', bp.size_id, 'grams', bp.grams, 'price', bp.price))
          from public.custom_base_prices bp
          where bp.base_id = cb.base_id and bp.size_id in (select size_id from combos k where k.base_id = cb.base_id)
        )
      ) order by cb.sort, b.name_en)
      from public.custom_bases cb join public.bases b on b.id = cb.base_id
      where cb.base_id in (select base_id from combos)
    ),
    'coatings', (
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar, 'color', c.color,
        'visual', cc.visual, 'note_en', cc.note_en, 'note_ar', cc.note_ar,
        'prices', (
          select jsonb_agg(jsonb_build_object('size_id', cp.size_id, 'price', cp.price))
          from public.custom_coating_prices cp
          where cp.coating_id = cc.coating_id and cp.size_id in (select size_id from combos k where k.coating_id = cc.coating_id)
        )
      ) order by cc.sort, c.name_en)
      from public.custom_coatings cc join public.coatings c on c.id = cc.coating_id
      where cc.coating_id in (select coating_id from combos)
    ),
    -- Combinations that exist but are out of stock right now: "<base>.<coating>.<size>"
    'sold_out', (
      select coalesce(jsonb_agg(k.base_id::text || '.' || k.coating_id::text || '.' || k.size_id::text), '[]'::jsonb)
      from combos k where not k.available
    )
  ) end;
$$;
revoke execute on function public.store_customizer() from public;
grant execute on function public.store_customizer() to anon, authenticated;

-- ---------------------------------------------------------------
-- Starting setup: three sizes and the nuts and coatings we have photos for.
-- Prices, weights and costs are left empty for the admin.
-- ---------------------------------------------------------------
insert into public.custom_sizes (slug, name_en, name_ar, tier, sort) values
  ('small', 'Small', 'صغير', 1, 1),
  ('medium', 'Medium', 'وسط', 2, 2),
  ('large', 'Large', 'كبير', 3, 3);

insert into public.bases (slug, name_en, name_ar, category_id, sort)
select 'hazelnut', 'Hazelnut', 'بندق', (select category_id from public.bases where slug = 'cashew'), 5
where not exists (select 1 from public.bases where slug = 'hazelnut');

insert into public.custom_bases (base_id, visual, sort)
select b.id, b.slug, x.sort
from public.bases b
join (values ('hazelnut', 1), ('almond', 2), ('cashew', 3), ('peanut', 4)) as x(slug, sort) on x.slug = b.slug;

insert into public.custom_coatings (coating_id, visual, sort)
select c.id, c.slug, x.sort
from public.coatings c
join (values ('dark', 1), ('milk', 2), ('white', 3), ('pistachio', 4)) as x(slug, sort) on x.slug = c.slug;

insert into public.custom_base_prices (base_id, size_id)
select cb.base_id, z.id from public.custom_bases cb cross join public.custom_sizes z;

insert into public.custom_coating_prices (coating_id, size_id)
select cc.coating_id, z.id from public.custom_coatings cc cross join public.custom_sizes z;

-- ---------------------------------------------------------------
-- Order engine: made-to-order lines, ingredient stock
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
        select b.id as base_id, c.id as coating_id, z.id as size_id,
               b.name_en as b_en, b.name_ar as b_ar, c.name_en as c_en, c.name_ar as c_ar,
               z.name_en as z_en, z.name_ar as z_ar, cb.display, bp.grams, cb.coating_share, c.color,
               bp.price + cp.price as price,
               case when bp.cost is null or cp.cost is null then null else bp.cost + cp.cost end as unit_cost
        into cu
        from public.custom_bases cb
        join public.bases b on b.id = cb.base_id
        join public.custom_base_prices bp on bp.base_id = cb.base_id
        join public.custom_sizes z on z.id = bp.size_id
        join public.custom_coating_prices cp on cp.size_id = z.id
        join public.custom_coatings cc on cc.coating_id = cp.coating_id
        join public.coatings c on c.id = cc.coating_id
        cross join public.settings s
        where s.id = 1 and s.custom_enabled
          and cb.base_id = split_part(it ->> 'id', '.', 1)::uuid
          and cc.coating_id = split_part(it ->> 'id', '.', 2)::uuid
          and z.id = split_part(it ->> 'id', '.', 3)::uuid
          and cb.is_active and cc.is_active and z.is_active
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
      select cb.stock_grams, cb.track_stock, b.name_en, b.name_ar into have, tracked, nm_en, nm_ar
      from public.custom_bases cb join public.bases b on b.id = cb.base_id where cb.base_id = need.base_id;
    elsif need.coating_id is not null then
      select cc.stock_grams, cc.track_stock, c.name_en, c.name_ar into have, tracked, nm_en, nm_ar
      from public.custom_coatings cc join public.coatings c on c.id = cc.coating_id where cc.coating_id = need.coating_id;
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
  lock_needs jsonb;
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

  -- Lock every stock row this order touches, so two orders can't take the same last grams.
  lock_needs := (public._compute_order(p)) -> 'needs';
  perform 1 from public.products pr
  where pr.id in (select (x ->> 'product_id')::uuid from jsonb_array_elements(lock_needs) x)
  for update;
  perform 1 from public.custom_bases cb
  where cb.base_id in (select (x ->> 'base_id')::uuid from jsonb_array_elements(lock_needs) x)
  for update;
  perform 1 from public.custom_coatings cc
  where cc.coating_id in (select (x ->> 'coating_id')::uuid from jsonb_array_elements(lock_needs) x)
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
    insert into public.order_items (order_id, product_id, variant_id, bundle_id, base_id, coating_id, custom_size_id,
                                    name_en, name_ar, option_label, option_label_ar, grams, qty, unit_price, unit_cost, line_total)
    values (
      o.id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid, (l ->> 'bundle_id')::uuid,
      (l ->> 'base_id')::uuid, (l ->> 'coating_id')::uuid, (l ->> 'size_id')::uuid,
      l ->> 'name_en', l ->> 'name_ar', l ->> 'label_en', l ->> 'label_ar', (l ->> 'grams')::numeric,
      (l ->> 'qty')::int, (l ->> 'unit_price')::numeric, (l ->> 'unit_cost')::numeric, (l ->> 'line_total')::numeric
    );
  end loop;

  for n in
    select (x ->> 'product_id')::uuid as product_id, (x ->> 'variant_id')::uuid as variant_id,
           (x ->> 'base_id')::uuid as base_id, (x ->> 'coating_id')::uuid as coating_id,
           sum((x ->> 'amount')::numeric) as amount
    from jsonb_array_elements(c -> 'needs') x group by 1, 2, 3, 4
  loop
    if n.amount > 0 then
      insert into public.stock_movements (product_id, variant_id, base_id, coating_id, delta, reason, order_id)
      values (n.product_id, n.variant_id, n.base_id, n.coating_id, -n.amount, 'order', o.id);
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
  lock_needs jsonb;
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

  -- Lock every stock row this order touches, so two orders can't take the same last grams.
  lock_needs := (public._compute_order(p)) -> 'needs';
  perform 1 from public.products pr
  where pr.id in (select (x ->> 'product_id')::uuid from jsonb_array_elements(lock_needs) x)
  for update;
  perform 1 from public.custom_bases cb
  where cb.base_id in (select (x ->> 'base_id')::uuid from jsonb_array_elements(lock_needs) x)
  for update;
  perform 1 from public.custom_coatings cc
  where cc.coating_id in (select (x ->> 'coating_id')::uuid from jsonb_array_elements(lock_needs) x)
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
    insert into public.order_items (order_id, product_id, variant_id, bundle_id, base_id, coating_id, custom_size_id,
                                    name_en, name_ar, option_label, option_label_ar, grams, qty, unit_price, unit_cost, line_total)
    values (
      o.id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid, (l ->> 'bundle_id')::uuid,
      (l ->> 'base_id')::uuid, (l ->> 'coating_id')::uuid, (l ->> 'size_id')::uuid,
      l ->> 'name_en', l ->> 'name_ar', l ->> 'label_en', l ->> 'label_ar', (l ->> 'grams')::numeric,
      (l ->> 'qty')::int, (l ->> 'unit_price')::numeric, (l ->> 'unit_cost')::numeric, (l ->> 'line_total')::numeric
    );
  end loop;

  for n in
    select (x ->> 'product_id')::uuid as product_id, (x ->> 'variant_id')::uuid as variant_id,
           (x ->> 'base_id')::uuid as base_id, (x ->> 'coating_id')::uuid as coating_id,
           sum((x ->> 'amount')::numeric) as amount
    from jsonb_array_elements(c -> 'needs') x group by 1, 2, 3, 4
  loop
    if n.amount > 0 then
      insert into public.stock_movements (product_id, variant_id, base_id, coating_id, delta, reason, order_id)
      values (n.product_id, n.variant_id, n.base_id, n.coating_id, -n.amount, 'order', o.id);
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
    for m in select product_id, variant_id, base_id, coating_id, sum(delta) as d from public.stock_movements where order_id = o.id group by 1, 2, 3, 4 loop
      if m.d < 0 then
        insert into public.stock_movements (product_id, variant_id, base_id, coating_id, delta, reason, order_id)
        values (m.product_id, m.variant_id, m.base_id, m.coating_id, -m.d, p_status::text::public.movement_reason, o.id);
      end if;
    end loop;
  elsif o.status = any (closed) and not (p_status = any (closed)) then
    for m in select product_id, variant_id, base_id, coating_id, sum(delta) as d from public.stock_movements where order_id = o.id and reason = 'order' group by 1, 2, 3, 4 loop
      insert into public.stock_movements (product_id, variant_id, base_id, coating_id, delta, reason, order_id, note)
      values (m.product_id, m.variant_id, m.base_id, m.coating_id, m.d, 'order', o.id, 'Order reopened');
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

create or replace function public.store_order(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'created_at', o.created_at, 'status', o.status,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'customer_name', o.customer_name, 'phone', o.phone,
    'address_line', o.address_line, 'building', o.building, 'floor', o.floor, 'apartment', o.apartment, 'landmark', o.landmark,
    'subtotal', o.subtotal, 'discount_total', o.discount_total, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'discount_code', o.discount_code,
    'items', (select jsonb_agg(jsonb_build_object('id', coalesce(i.variant_id, i.bundle_id), 'name_en', i.name_en, 'name_ar', i.name_ar,
                                                  'label', i.option_label,
                                                  'label_ar', coalesce(i.option_label_ar, (select coalesce(ov.label_ar, vv.label_ar)
                                                               from public.variants vv
                                                               left join public.option_values ov on ov.id = vv.option_value_id
                                                               where vv.id = i.variant_id)),
                                                  'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.id)
              from public.order_items i where i.order_id = o.id),
    'instapay_handle', s.instapay_handle, 'instapay_name', s.instapay_name, 'instapay_link', s.instapay_link,
    'whatsapp_number', s.whatsapp_number
  )
  from public.orders o cross join public.settings s
  where o.id = p_id and s.id = 1 and o.created_at > now() - interval '60 days';
$function$;

create or replace function public.store_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'whatsapp_number', s.whatsapp_number,
    'whatsapp_button', s.whatsapp_button,
    'instagram_url', s.instagram_url,
    'tiktok_url', s.tiktok_url,
    'facebook_url', s.facebook_url,
    'meta_pixel_id', s.meta_pixel_id,
    'tiktok_pixel_id', s.tiktok_pixel_id,
    'ga4_id', s.ga4_id,
    'orders_paused', s.orders_paused,
    'paused_message_en', s.paused_message_en,
    'paused_message_ar', s.paused_message_ar,
    'announcement_en', s.announcement_en,
    'announcement_ar', s.announcement_ar,
    'announcement_visible', s.announcement_visible,
    'build_box_enabled', s.build_box_enabled,
    'custom_ready', s.custom_enabled and public._custom_ready(),
    'seo_title', s.seo_title,
    'seo_description', s.seo_description,
    'free_shipping_over', (
      select min(d.min_subtotal) from public.discounts d
      where d.type = 'free_shipping' and d.code is null and d.is_active
        and (d.starts_at is null or d.starts_at <= now())
        and (d.ends_at is null or d.ends_at > now())
    )
  )
  from public.settings s where s.id = 1;
$$;

-- Same grants as before (create or replace keeps them, restated so this file stands on its own).
revoke execute on function public._compute_order(jsonb) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
revoke execute on function public.admin_place_order(jsonb) from public, anon;
grant execute on function public.admin_place_order(jsonb) to authenticated;
revoke execute on function public.admin_set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;
revoke execute on function public.store_order(uuid) from public;
grant execute on function public.store_order(uuid) to anon, authenticated;
revoke execute on function public.store_settings() from public;
grant execute on function public.store_settings() to anon, authenticated;
