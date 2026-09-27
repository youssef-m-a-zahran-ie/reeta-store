-- Storefront read API.
-- Shoppers never read the catalog tables directly: costs, exact stock and drafts stay private.
-- These read-only functions return exactly what the store shows, as JSON.

-- Price of a variant: its own override, else its template price.
create or replace function public._variant_price(v public.variants, p public.products)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    v.price,
    (select pti.price from public.price_template_items pti
      where pti.template_id = p.price_template_id and pti.option_value_id = v.option_value_id)
  );
$$;
revoke execute on function public._variant_price(public.variants, public.products) from public, anon, authenticated;

create or replace function public._store_variants(p public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.sort), '[]'::jsonb)
  from (
    select
      v.id,
      coalesce(ov.label_en, v.label_en, 'Standard') as label_en,
      coalesce(ov.label_ar, v.label_ar, 'عادي') as label_ar,
      ov.amount,
      public._variant_price(v, p) as price,
      case
        when p.stock_unit = 'grams' then p.stock_grams >= coalesce(ov.amount, 0) and p.stock_grams > 0
        else v.stock_qty > 0
      end as available,
      coalesce(ov.sort, v.sort) as sort
    from public.variants v
    left join public.option_values ov on ov.id = v.option_value_id
    where v.product_id = p.id
      and v.is_active
      and public._variant_price(v, p) is not null
  ) x;
$$;
revoke execute on function public._store_variants(public.products) from public, anon, authenticated;

create or replace function public._store_images(p_product uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('path', i.path, 'alt_en', i.alt_en, 'alt_ar', i.alt_ar) order by i.sort), '[]'::jsonb)
  from public.product_images i where i.product_id = p_product;
$$;
revoke execute on function public._store_images(uuid) from public, anon, authenticated;

create or replace function public._store_product_card(p public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'category_id', p.category_id,
    'category_slug', c.slug,
    'name_en', p.name_en,
    'name_ar', p.name_ar,
    'short_en', p.short_en,
    'short_ar', p.short_ar,
    'base_slug', b.slug,
    'coating_slug', co.slug,
    'color', coalesce(p.color, co.color),
    'is_featured', p.is_featured,
    'sort', p.sort,
    'created_at', p.created_at,
    'images', public._store_images(p.id),
    'variants', public._store_variants(p)
  )
  from public.categories c
  left join public.bases b on b.id = p.base_id
  left join public.coatings co on co.id = p.coating_id
  where c.id = p.category_id;
$$;
revoke execute on function public._store_product_card(public.products) from public, anon, authenticated;

-- Everything the shop and home pages need, in one call.
create or replace function public.store_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cards as (
    select public._store_product_card(p) as card
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_visible
    where p.status = 'active'
  ),
  sellable as (
    select card from cards where jsonb_array_length(card -> 'variants') > 0
  )
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar,
        'description_en', c.description_en, 'description_ar', c.description_ar, 'image_path', c.image_path
      ) order by c.sort, c.name_en)
      from public.categories c
      where c.is_visible and exists (select 1 from sellable s where (s.card ->> 'category_id')::uuid = c.id)
    ), '[]'::jsonb),
    'bases', coalesce((
      select jsonb_agg(jsonb_build_object('slug', b.slug, 'name_en', b.name_en, 'name_ar', b.name_ar) order by b.sort)
      from public.bases b
      where b.is_active and exists (select 1 from sellable s where s.card ->> 'base_slug' = b.slug)
    ), '[]'::jsonb),
    'coatings', coalesce((
      select jsonb_agg(jsonb_build_object('slug', co.slug, 'name_en', co.name_en, 'name_ar', co.name_ar, 'color', co.color) order by co.sort)
      from public.coatings co
      where co.is_active and exists (select 1 from sellable s where s.card ->> 'coating_slug' = co.slug)
    ), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(card order by (card ->> 'sort')::int, card ->> 'name_en') from sellable), '[]'::jsonb)
  );
$$;

-- One product page, or null when it isn't live.
create or replace function public.store_product(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public._store_product_card(p) || jsonb_build_object(
    'description_en', p.description_en, 'description_ar', p.description_ar,
    'ingredients_en', p.ingredients_en, 'ingredients_ar', p.ingredients_ar,
    'allergens_en', p.allergens_en, 'allergens_ar', p.allergens_ar,
    'storage_en', p.storage_en, 'storage_ar', p.storage_ar,
    'seo_title', p.seo_title, 'seo_description', p.seo_description,
    'category_name_en', c.name_en, 'category_name_ar', c.name_ar,
    'base_name_en', b.name_en, 'base_name_ar', b.name_ar,
    'coating_name_en', co.name_en, 'coating_name_ar', co.name_ar
  )
  from public.products p
  join public.categories c on c.id = p.category_id and c.is_visible
  left join public.bases b on b.id = p.base_id
  left join public.coatings co on co.id = p.coating_id
  where p.slug = p_slug and p.status = 'active';
$$;

-- Live bundles with their contents, price and what they'd cost bought separately.
create or replace function public.store_bundles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.sort), '[]'::jsonb)
  from (
    select
      bu.id, bu.slug, bu.name_en, bu.name_ar, bu.description_en, bu.description_ar, bu.price, bu.sort,
      coalesce((
        select jsonb_agg(jsonb_build_object('path', i.path, 'alt_en', i.alt_en, 'alt_ar', i.alt_ar) order by i.sort)
        from public.bundle_images i where i.bundle_id = bu.id
      ), '[]'::jsonb) as images,
      (
        select jsonb_agg(jsonb_build_object(
          'product_slug', p.slug, 'name_en', p.name_en, 'name_ar', p.name_ar,
          'color', coalesce(p.color, co.color),
          'label_en', coalesce(ov.label_en, v.label_en), 'label_ar', coalesce(ov.label_ar, v.label_ar),
          'qty', bi.qty
        ) order by bi.id)
        from public.bundle_items bi
        join public.variants v on v.id = bi.variant_id
        join public.products p on p.id = v.product_id
        left join public.coatings co on co.id = p.coating_id
        left join public.option_values ov on ov.id = v.option_value_id
        where bi.bundle_id = bu.id
      ) as items,
      (
        select sum(public._variant_price(v, p) * bi.qty)
        from public.bundle_items bi
        join public.variants v on v.id = bi.variant_id
        join public.products p on p.id = v.product_id
        where bi.bundle_id = bu.id
      ) as separate_price,
      not exists (
        select 1
        from public.bundle_items bi
        join public.variants v on v.id = bi.variant_id
        join public.products p on p.id = v.product_id
        left join public.option_values ov on ov.id = v.option_value_id
        where bi.bundle_id = bu.id
          and (
            p.status <> 'active' or not v.is_active
            or (p.stock_unit = 'grams' and p.stock_grams < coalesce(ov.amount, 0) * bi.qty)
            or (p.stock_unit = 'pieces' and v.stock_qty < bi.qty)
          )
      ) as available
    from public.bundles bu
    where bu.status = 'active'
      and exists (select 1 from public.bundle_items bi where bi.bundle_id = bu.id)
  ) x;
$$;

-- Public site settings (no private emails or delivery costs).
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

revoke execute on function public.store_catalog() from public;
revoke execute on function public.store_product(text) from public;
revoke execute on function public.store_bundles() from public;
revoke execute on function public.store_settings() from public;
grant execute on function public.store_catalog() to anon, authenticated;
grant execute on function public.store_product(text) to anon, authenticated;
grant execute on function public.store_bundles() to anon, authenticated;
grant execute on function public.store_settings() to anon, authenticated;
