-- The order page shows the size label in the shopper's language ("60 جرام", not "60 g").
-- order_items keeps the English label as the snapshot; the Arabic one is read from the variant.
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
                                                  'label_ar', (select coalesce(ov.label_ar, vv.label_ar)
                                                               from public.variants vv
                                                               left join public.option_values ov on ov.id = vv.option_value_id
                                                               where vv.id = i.variant_id),
                                                  'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.id)
              from public.order_items i where i.order_id = o.id),
    'instapay_handle', s.instapay_handle, 'instapay_name', s.instapay_name, 'instapay_link', s.instapay_link,
    'whatsapp_number', s.whatsapp_number
  )
  from public.orders o cross join public.settings s
  where o.id = p_id and s.id = 1 and o.created_at > now() - interval '60 days';
$function$;
