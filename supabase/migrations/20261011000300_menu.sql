-- The menu: the home page sells four nuts as plates. Tap a plate, pick a sauce, a size and how many.
-- Same pricing, cost and stock engine as before (custom_* tables); this adds the plate photos,
-- short sauce names for the buttons, macadamia, and the real pouch weights (70 / 160 / 210 g).

-- ---------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------
-- The plain plate (nut with no sauce), shown on the grid.
alter table public.custom_bases add column image_path text;

-- Short names on the sauce buttons ("Dark" instead of "Dark chocolate"). Empty = the full name.
alter table public.custom_coatings
  add column label_en text,
  add column label_ar text;

-- The plate with a sauce on it, one per nut × sauce.
create table public.custom_plate_photos (
  base_id uuid not null references public.custom_bases(base_id) on delete cascade,
  coating_id uuid not null references public.custom_coatings(coating_id) on delete cascade,
  image_path text not null,
  updated_at timestamptz not null default now(),
  primary key (base_id, coating_id)
);
create index custom_plate_photos_coating_idx on public.custom_plate_photos(coating_id);
create trigger custom_plate_photos_updated_at before update on public.custom_plate_photos for each row execute function public.set_updated_at();

alter table public.custom_plate_photos enable row level security;
create policy "admin full access" on public.custom_plate_photos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------
-- Storefront read API: same as before, plus photos and short names
-- ---------------------------------------------------------------
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
        'image', cb.image_path,
        'photos', (
          select coalesce(jsonb_object_agg(ph.coating_id::text, ph.image_path), '{}'::jsonb)
          from public.custom_plate_photos ph where ph.base_id = cb.base_id
        ),
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
        'label_en', coalesce(nullif(cc.label_en, ''), c.name_en), 'label_ar', coalesce(nullif(cc.label_ar, ''), c.name_ar),
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
    'sold_out', (
      select coalesce(jsonb_agg(k.base_id::text || '.' || k.coating_id::text || '.' || k.size_id::text), '[]'::jsonb)
      from combos k where not k.available
    )
  ) end;
$$;
revoke execute on function public.store_customizer() from public;
grant execute on function public.store_customizer() to anon, authenticated;

-- ---------------------------------------------------------------
-- The line-up: cashew, almond, hazelnut, macadamia. Peanut is switched off (kept for history).
-- ---------------------------------------------------------------
insert into public.bases (slug, name_en, name_ar, category_id, sort)
select 'macadamia', 'Macadamia', 'مكاداميا', (select category_id from public.bases where slug = 'cashew'), 6
where not exists (select 1 from public.bases where slug = 'macadamia');

insert into public.custom_bases (base_id, visual, sort)
select b.id, 'macadamia', 4 from public.bases b
where b.slug = 'macadamia' and not exists (select 1 from public.custom_bases cb where cb.base_id = b.id);

update public.custom_bases cb set sort = x.sort, is_active = x.active
from public.bases b, (values ('cashew', 1, true), ('almond', 2, true), ('hazelnut', 3, true), ('macadamia', 4, true), ('peanut', 9, false)) as x(slug, sort, active)
where b.id = cb.base_id and b.slug = x.slug;

insert into public.custom_base_prices (base_id, size_id)
select cb.base_id, z.id from public.custom_bases cb cross join public.custom_sizes z
on conflict do nothing;

-- Pouch weights: small 70 g, medium 160 g, large 210 g (only where none was entered yet).
update public.custom_base_prices bp set grams = x.g
from public.custom_sizes z, (values ('small', 70), ('medium', 160), ('large', 210)) as x(slug, g)
where z.id = bp.size_id and z.slug = x.slug and bp.grams is null;

-- Sauces in the order of the design: white, dark, milk, pistachio. Short button names.
update public.custom_coatings cc set sort = x.sort, label_en = x.en, label_ar = x.ar
from public.coatings c, (values ('white', 1, 'White', 'وايت'), ('dark', 2, 'Dark', 'دارك'), ('milk', 3, 'Milk', 'ميلك'), ('pistachio', 4, 'Pistachio', 'بستاشيو')) as x(slug, sort, en, ar)
where c.id = cc.coating_id and c.slug = x.slug;
