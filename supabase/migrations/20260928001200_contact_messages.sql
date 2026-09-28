-- Contact form: shoppers send a message, it lands in the admin Inbox and the order-email list.

alter table public.messages add column if not exists lang text not null default 'en' check (lang in ('en', 'ar'));
alter table public.messages add column if not exists replied_at timestamptz;
create index if not exists messages_created_idx on public.messages(created_at desc);

create or replace function public._notify_new_message(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
  m public.messages;
  s public.settings;
  esc text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then return; end if;
  select * into m from public.messages where id = p_id;
  select * into s from public.settings where id = 1;
  if m.id is null or coalesce(array_length(s.notify_emails, 1), 0) = 0 then return; end if;
  esc := replace(replace(replace(m.body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Reeta Website <onboarding@resend.dev>',
      'to', to_jsonb(s.notify_emails),
      'subject', format('New message from %s', m.name),
      'html', format($h$
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#3a2420">
  <div style="background:#5b4659;color:#f2d0e3;padding:18px 22px;border-radius:18px 18px 0 0">
    <div style="font-size:13px;letter-spacing:.08em">REETA · NEW MESSAGE</div>
    <div style="font-size:22px;font-weight:bold">%s</div>
  </div>
  <div style="background:#fef9f1;padding:18px 22px;border:1px solid #f2d0e3;border-top:0;border-radius:0 0 18px 18px">
    <p style="margin:0 0 12px">%s</p>
    <p style="margin:0 0 16px;white-space:pre-wrap">%s</p>
    <a href="%s/admin/inbox" style="display:inline-block;background:#5b4659;color:#f2d0e3;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open the inbox</a>
  </div>
</div>$h$,
        replace(replace(m.name, '<', '&lt;'), '>', '&gt;'),
        replace(replace(concat_ws(' · ', m.phone, m.email), '<', '&lt;'), '>', '&gt;'),
        esc, s.site_url)
    )
  );
exception when others then
  raise warning 'message email failed: %', sqlerrm;
end;
$$;

create or replace function public.store_contact(p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := left(trim(coalesce(p ->> 'name', '')), 80);
  v_phone text := nullif(left(trim(coalesce(p ->> 'phone', '')), 30), '');
  v_email text := nullif(lower(left(trim(coalesce(p ->> 'email', '')), 120)), '');
  v_body text := left(trim(coalesce(p ->> 'body', '')), 2000);
  v_id uuid;
begin
  if coalesce(p ->> 'website', '') <> '' then raise exception 'rejected'; end if;
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_phone is null and v_email is null then raise exception 'needs_contact'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then raise exception 'invalid_phone'; end if;
  if length(v_body) < 5 then raise exception 'invalid_body'; end if;

  -- Keep the inbox usable if someone hammers the form.
  if (select count(*) from public.messages where created_at > now() - interval '1 hour') >= 40
     or (select count(*) from public.messages
         where created_at > now() - interval '1 hour'
           and ((v_phone is not null and phone = v_phone) or (v_email is not null and email = v_email))) >= 3 then
    raise exception 'too_many_messages';
  end if;

  insert into public.messages (name, phone, email, body, lang)
  values (v_name, v_phone, v_email, v_body, case when p ->> 'lang' = 'ar' then 'ar' else 'en' end)
  returning id into v_id;

  perform public._notify_new_message(v_id);
end;
$$;

revoke execute on function public._notify_new_message(uuid) from public, anon, authenticated;
revoke execute on function public.store_contact(jsonb) from public;
grant execute on function public.store_contact(jsonb) to anon, authenticated;
