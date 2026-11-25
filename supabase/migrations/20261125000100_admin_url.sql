-- The admin lives on its own address (e.g. https://admin.reeta-eg.com). Emails to the team ("Open in admin", "Open the inbox")
-- link there when settings.admin_url is set, else to the store's own address as before.
alter table public.settings add column if not exists admin_url text;

do $$
declare
  f text;
  src text;
  n int;
begin
  foreach f in array array['public._notify_new_order(uuid)', 'public._notify_new_message(uuid)'] loop
    src := pg_get_functiondef(f::regprocedure);
    n := (length(src) - length(replace(src, 's.site_url', ''))) / length('s.site_url');
    if n <> 1 then raise exception '% : expected one s.site_url, found %', f, n; end if;
    execute replace(src, 's.site_url', 'coalesce(s.admin_url, s.site_url)');
  end loop;
end $$;
