-- Trigger functions are never called through the API; is_admin is only needed by signed-in users (RLS checks).
revoke execute on function public.apply_stock_movement() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
