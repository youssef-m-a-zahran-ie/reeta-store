-- Reeta store: starting data. Everything here can be edited from the admin.

insert into public.admins (email) values ('reetadeserts@gmail.com');

insert into public.settings (id, notify_emails, min_shipping_fee, distance_factor, fee_round_to)
values (1, array['reetadeserts@gmail.com'], 0, 1.3, 5);

insert into public.categories (slug, name_en, name_ar, sort)
values ('nuts', 'Nuts', 'مكسرات', 1);

insert into public.bases (slug, name_en, name_ar, category_id, sort)
select v.slug, v.en, v.ar, c.id, v.sort
from (values ('cashew','Cashew','كاجو',1), ('almond','Almond','لوز',2), ('peanut','Peanut','سوداني',3)) as v(slug,en,ar,sort)
cross join public.categories c where c.slug = 'nuts';

insert into public.coatings (slug, name_en, name_ar, color, sort) values
  ('dark',  'Dark chocolate',  'شوكولاتة دارك', '#3a2420', 1),
  ('white', 'White chocolate', 'شوكولاتة وايت', '#f5ead8', 2),
  ('milk',  'Milk chocolate',  'شوكولاتة ميلك', '#a0673f', 3);

insert into public.option_types (slug, name_en, name_ar, unit)
values ('weight', 'Weight', 'الوزن', 'g');

insert into public.option_values (option_type_id, label_en, label_ar, amount, sort)
select t.id, v.en, v.ar, v.amount, v.sort
from (values ('50 g','50 جرام',50,1), ('100 g','100 جرام',100,2), ('250 g','250 جرام',250,3), ('350 g','350 جرام',350,4)) as v(en,ar,amount,sort)
cross join public.option_types t where t.slug = 'weight';

-- One price template per nut, prices left empty for the admin to fill.
insert into public.price_templates (name, option_type_id, base_id)
select b.name_en, t.id, b.id
from public.bases b cross join public.option_types t where t.slug = 'weight';

insert into public.price_template_items (template_id, option_value_id)
select pt.id, ov.id
from public.price_templates pt
join public.option_values ov on ov.option_type_id = pt.option_type_id;

-- The six launch products, as drafts until prices, photos and stock are in.
insert into public.products (slug, category_id, name_en, name_ar, base_id, coating_id, option_type_id, price_template_id, stock_unit, low_stock_threshold, sort, short_en, short_ar)
select
  b.slug || '-' || co.slug,
  b.category_id,
  split_part(co.name_en, ' ', 1) || ' ' || b.name_en,
  b.name_ar || ' ب' || replace(co.name_ar, 'شوكولاتة ', 'ال'),
  b.id, co.id, t.id, pt.id, 'grams', 1000,
  b.sort * 10 + co.sort,
  b.name_en || 's coated in ' || lower(co.name_en) || '.',
  b.name_ar || ' متغطي ب' || co.name_ar || '.'
from public.bases b
cross join public.coatings co
cross join public.option_types t
join public.price_templates pt on pt.base_id = b.id
where t.slug = 'weight' and co.slug in ('dark','white');

insert into public.variants (product_id, option_value_id, sort)
select p.id, ov.id, ov.sort
from public.products p
join public.option_values ov on ov.option_type_id = p.option_type_id;

insert into public.pages (slug, title_en, title_ar) values
  ('about', 'About Reeta', 'عن ريتا'),
  ('shipping-returns', 'Shipping & returns', 'الشحن والاسترجاع'),
  ('privacy', 'Privacy policy', 'سياسة الخصوصية'),
  ('terms', 'Terms', 'الشروط والأحكام');
