-- Destek talebi bildirimleri. İki yön:
--   1) Talep geldiğinde İŞLETMEYE e-posta (order-alert / Resend)
--   2) Yanıt yazıldığında MÜŞTERİYE push (send-notification)
--
-- Öncesinde support_tickets'ta hiçbir tetikleyici yoktu; 34 talebin 33'ü
-- yanıtsız kalmıştı çünkü kimse geldiğinden haberdar olmuyordu.

create or replace function public.fn_notify_new_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_key text; v_req bigint;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_notify_new_support_ticket: service_role_key Vault''ta yok';
    return new;
  end if;

  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/order-alert',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object('type','support_ticket','ticket_id', new.id)
  ) into v_req;
  return new;
exception when others then
  -- Bildirim gönderilemezse talebin kaydı engellenmemeli.
  raise warning 'fn_notify_new_support_ticket failed: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;

create trigger trg_notify_new_support_ticket
after insert on public.support_tickets
for each row execute function public.fn_notify_new_support_ticket();


create or replace function public.fn_notify_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_key text; v_req bigint;
begin
  if coalesce(new.admin_reply, '') = '' then return new; end if;
  if coalesce(old.admin_reply, '') = coalesce(new.admin_reply, '') then return new; end if;
  if new.user_id is null then return new; end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_notify_support_reply: service_role_key Vault''ta yok';
    return new;
  end if;

  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object(
      'mode','by_content',
      'user_ids', jsonb_build_array(new.user_id),
      'title','Destek talebine yanıt verdik',
      'body', left(regexp_replace(new.admin_reply, '\s+', ' ', 'g'), 120),
      -- Düz ekran adı: yüklü 1.0.6 build'i kcal:// şemasını tanımıyor,
      -- resolveNavigation ham adı doğrudan navigate'e veriyor.
      'deep_link','ProfileSupport',
      'category','transactional',
      'data', jsonb_build_object('ticket_id', new.id)
    )
  ) into v_req;
  return new;
exception when others then
  raise warning 'fn_notify_support_reply failed: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;

create trigger trg_notify_support_reply
after update of admin_reply on public.support_tickets
for each row execute function public.fn_notify_support_reply();;
