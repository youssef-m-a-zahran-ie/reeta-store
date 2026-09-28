-- InstaPay payment link: customers tap it on their order page to open InstaPay.
alter table public.settings add column if not exists instapay_link text
  check (instapay_link is null or instapay_link ~ '^https://');
update public.settings set instapay_link = 'https://ipn.eg/S/youssefzahran03/instapay/9zgcWg' where id = 1;

create or replace function public.store_order(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'created_at', o.created_at, 'status', o.status,
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'customer_name', o.customer_name, 'phone', o.phone,
    'address_line', o.address_line, 'building', o.building, 'floor', o.floor, 'apartment', o.apartment, 'landmark', o.landmark,
    'subtotal', o.subtotal, 'discount_total', o.discount_total, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'discount_code', o.discount_code,
    'items', (select jsonb_agg(jsonb_build_object('name_en', i.name_en, 'name_ar', i.name_ar, 'label', i.option_label, 'qty', i.qty, 'line_total', i.line_total) order by i.id)
              from public.order_items i where i.order_id = o.id),
    'instapay_handle', s.instapay_handle, 'instapay_name', s.instapay_name, 'instapay_link', s.instapay_link,
    'whatsapp_number', s.whatsapp_number
  )
  from public.orders o cross join public.settings s
  where o.id = p_id and s.id = 1 and o.created_at > now() - interval '60 days';
$$;
