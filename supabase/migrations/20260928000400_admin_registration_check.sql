-- Lets the login page check, before sign-up, that an email is on the admin list.
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.email = lower(trim(p_email)));
$$;
revoke execute on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;
