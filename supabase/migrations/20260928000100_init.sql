-- Reeta store: initial schema
-- Every table has RLS on. Admin = signed-in user whose email is in public.admins.
-- Storefront reads go through public policies or (from phase 3) dedicated views.

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------
create table public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Brand palette: product and coating colors can only come from here.
create domain public.brand_color as text
  check (value in ('#5b4659','#f2d0e3','#f5ead8','#3a2420','#a0673f','#8a9a62','#c9955f','#d9607a'));

create type public.product_status as enum ('draft','active','archived');
create type public.stock_unit as enum ('grams','pieces');
create type public.order_status as enum ('new','confirmed','preparing','out_for_delivery','delivered','cancelled','refused');
create type public.payment_method as enum ('cod','instapay');
create type public.payment_status as enum ('unpaid','paid');
create type public.discount_type as enum ('percent','fixed','free_shipping');
create type public.movement_reason as enum ('order','cancelled','refused','batch','adjustment','initial');
create type public.ad_platform as enum ('meta','tiktok','google','snapchat','other');

-- ---------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  image_path text,
  sort int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What gets coated: cashew, almond, peanut...
create table public.bases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  category_id uuid references public.categories(id) on delete set null,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What it's coated with: dark, white, milk...
create table public.coatings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  color public.brand_color not null,
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Option dimension a product is sold by: weight, size, piece...
create table public.option_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  unit text,               -- 'g', 'ml', 'pcs' or null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.option_values (
  id uuid primary key default gen_random_uuid(),
  option_type_id uuid not null references public.option_types(id) on delete cascade,
  label_en text not null,
  label_ar text not null,
  amount numeric(10,2),    -- grams for weight, ml for size; used for stock deduction
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (option_type_id, label_en)
);

-- Price templates: price and cost per option value, shared by many products.
create table public.price_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  option_type_id uuid not null references public.option_types(id) on delete restrict,
  base_id uuid references public.bases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_template_items (
  template_id uuid not null references public.price_templates(id) on delete cascade,
  option_value_id uuid not null references public.option_values(id) on delete cascade,
  price numeric(10,2) check (price is null or price >= 0),
  cost numeric(10,2) check (cost is null or cost >= 0),
  primary key (template_id, option_value_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id uuid not null references public.categories(id) on delete restrict,
  name_en text not null,
  name_ar text not null,
  short_en text,
  short_ar text,
  description_en text,
  description_ar text,
  ingredients_en text,
  ingredients_ar text,
  allergens_en text,
  allergens_ar text,
  storage_en text,
  storage_ar text,
  base_id uuid references public.bases(id) on delete set null,
  coating_id uuid references public.coatings(id) on delete set null,
  color public.brand_color,               -- band color; falls back to the coating color
  option_type_id uuid references public.option_types(id) on delete restrict,
  price_template_id uuid references public.price_templates(id) on delete set null,
  stock_unit public.stock_unit not null default 'pieces',
  stock_grams numeric(12,2) not null default 0,   -- balance when stock_unit = grams
  low_stock_threshold numeric(12,2) not null default 0,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  sort int not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create index products_status_idx on public.products(status);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  alt_en text,
  alt_ar text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort);

-- One row per sellable option of a product. Null price/cost = use the price template.
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  option_value_id uuid references public.option_values(id) on delete restrict,
  label_en text,           -- only for products without an option type
  label_ar text,
  price numeric(10,2) check (price is null or price >= 0),
  cost numeric(10,2) check (cost is null or cost >= 0),
  stock_qty int not null default 0,   -- balance when stock_unit = pieces
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, option_value_id)
);
create index variants_product_idx on public.variants(product_id);

-- Resolved price/cost for every variant (admin use; storefront gets a price-only view later).
create view public.variant_prices
with (security_invoker = true)
as
select
  v.id as variant_id,
  v.product_id,
  v.option_value_id,
  coalesce(v.price, pti.price) as price,
  coalesce(v.cost, pti.cost) as cost,
  (v.price is not null) as price_overridden,
  (v.cost is not null) as cost_overridden
from public.variants v
join public.products p on p.id = v.product_id
left join public.price_template_items pti
  on pti.template_id = p.price_template_id
 and pti.option_value_id = v.option_value_id;

-- ---------------------------------------------------------------
-- Bundles and build-your-own-box
-- ---------------------------------------------------------------
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  price numeric(10,2) not null check (price >= 0),
  status public.product_status not null default 'draft',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete restrict,
  qty int not null default 1 check (qty > 0),
  unique (bundle_id, variant_id)
);

create table public.bundle_images (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  path text not null,
  alt_en text,
  alt_ar text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.box_configs (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  slots int not null check (slots > 0),
  option_value_id uuid references public.option_values(id) on delete restrict, -- weight per slot
  price numeric(10,2) check (price is null or price >= 0), -- null = sum of chosen items
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.box_config_products (
  box_config_id uuid not null references public.box_configs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (box_config_id, product_id)
);

-- ---------------------------------------------------------------
-- Customers, orders
-- ---------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  notes text,
  refused_count int not null default 0,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text unique check (code is null or code = upper(code)),  -- null = automatic (e.g. free shipping over X)
  description text,
  type public.discount_type not null,
  value numeric(10,2) not null default 0 check (value >= 0),
  min_subtotal numeric(10,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  used_count int not null default 0,
  product_ids uuid[],      -- null = whole order
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 100)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address_line text not null,
  building text,
  floor text,
  apartment text,
  landmark text,
  lat double precision,
  lng double precision,
  distance_km numeric(8,2),
  distance_method text check (distance_method in ('road','straight')),
  subtotal numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  discount_id uuid references public.discounts(id) on delete set null,
  discount_code text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  status public.order_status not null default 'new',
  customer_note text,
  internal_note text,
  source text not null default 'web' check (source in ('web','whatsapp','instagram','phone','other')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  lang text not null default 'en' check (lang in ('en','ar')),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_created_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status);
create index orders_phone_idx on public.orders(phone);

-- Snapshot of what was sold, at the price and cost of that moment.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.variants(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  name_en text not null,
  name_ar text not null,
  option_label text,
  grams numeric(10,2),
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2),
  line_total numeric(10,2) not null
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,          -- 'created','status','payment','edit','note'
  from_value text,
  to_value text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);

create table public.abandoned_checkouts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  cart jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  contacted boolean not null default false,
  recovered_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index abandoned_created_idx on public.abandoned_checkouts(created_at desc);

-- ---------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------
-- Every stock change is a movement; balances are updated by trigger.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete cascade,
  delta numeric(12,2) not null check (delta <> 0),
  reason public.movement_reason not null,
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements(product_id, created_at desc);

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unit public.stock_unit;
begin
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
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger stock_movements_apply
  before insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------------------------------------------------------------
-- Marketing, content, settings
-- ---------------------------------------------------------------
create table public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  platform public.ad_platform not null,
  campaign text,
  period_start date not null,
  period_end date not null,
  amount numeric(12,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.content_blocks (
  key text primary key,          -- e.g. 'home.hero', 'home.why'
  page text not null default 'home',
  sort int not null default 0,
  is_visible boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.pages (
  slug text primary key,         -- 'about', 'shipping-returns', 'privacy', 'terms'
  title_en text not null,
  title_ar text not null,
  body_en text not null default '',
  body_ar text not null default '',
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question_en text not null,
  question_ar text not null,
  answer_en text not null,
  answer_ar text not null,
  sort int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text,
  text_en text,
  text_ar text,
  image_path text,
  sort int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  store_lat double precision,
  store_lng double precision,
  store_address text,
  fee_per_km numeric(10,2),
  min_shipping_fee numeric(10,2) not null default 0,
  distance_factor numeric(4,2) not null default 1.3,
  fee_round_to int not null default 5 check (fee_round_to > 0),
  instapay_handle text,
  instapay_name text,
  notify_emails text[] not null default '{}',
  whatsapp_number text,
  whatsapp_button boolean not null default true,
  instagram_url text,
  tiktok_url text,
  facebook_url text,
  meta_pixel_id text,
  tiktok_pixel_id text,
  ga4_id text,
  orders_paused boolean not null default false,
  paused_message_en text,
  paused_message_ar text,
  announcement_en text,
  announcement_ar text,
  announcement_visible boolean not null default false,
  build_box_enabled boolean not null default false,
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','bases','coatings','option_types','price_templates','products','variants',
    'bundles','box_configs','customers','discounts','orders','abandoned_checkouts','content_blocks','pages','settings']
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admins','categories','bases','coatings','option_types','option_values','price_templates',
    'price_template_items','products','product_images','variants','bundles','bundle_items','bundle_images',
    'box_configs','box_config_products','customers','discounts','orders','order_items','order_events',
    'abandoned_checkouts','stock_movements','ad_spend','content_blocks','pages','faqs','testimonials','messages','settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin full access" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Public read for storefront data that holds no costs, stock or private info.
create policy "public read visible" on public.categories for select to anon, authenticated using (is_visible);
create policy "public read active" on public.bases for select to anon, authenticated using (is_active);
create policy "public read active" on public.coatings for select to anon, authenticated using (is_active);
create policy "public read" on public.option_types for select to anon, authenticated using (true);
create policy "public read" on public.option_values for select to anon, authenticated using (true);
create policy "public read images of active" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "public read active" on public.bundles for select to anon, authenticated using (status = 'active');
create policy "public read images of active" on public.bundle_images for select to anon, authenticated
  using (exists (select 1 from public.bundles b where b.id = bundle_id and b.status = 'active'));
create policy "public read visible" on public.content_blocks for select to anon, authenticated using (is_visible);
create policy "public read published" on public.pages for select to anon, authenticated using (is_published);
create policy "public read visible" on public.faqs for select to anon, authenticated using (is_visible);
create policy "public read visible" on public.testimonials for select to anon, authenticated using (is_visible);

revoke all on public.variant_prices from anon;

-- ---------------------------------------------------------------
-- Storage: one public bucket for all site images; only admins write.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp','image/png','image/jpeg','image/svg+xml','video/mp4','video/webm'])
on conflict (id) do nothing;

create policy "admins upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy "admins update media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
create policy "admins delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
