-- Expose whether the variant is on sale, so admin screens don't need a join.
create or replace view public.variant_prices
with (security_invoker = true)
as
select
  v.id as variant_id,
  v.product_id,
  v.option_value_id,
  coalesce(v.price, pti.price) as price,
  coalesce(v.cost, pti.cost) as cost,
  (v.price is not null) as price_overridden,
  (v.cost is not null) as cost_overridden,
  v.is_active
from public.variants v
join public.products p on p.id = v.product_id
left join public.price_template_items pti
  on pti.template_id = p.price_template_id
 and pti.option_value_id = v.option_value_id;
revoke all on public.variant_prices from anon;
