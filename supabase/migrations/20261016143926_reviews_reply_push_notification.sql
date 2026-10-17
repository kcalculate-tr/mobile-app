-- Yanıt yazıldığında müşteriye push. send-notification'ın by_content kipini
-- kullanıyor; deep_link müşteriyi doğrudan "Değerlendirmelerim" ekranına açar.
--
-- SECURITY DEFINER zorunlu: fonksiyon vault.decrypted_secrets okuyor ve
-- `authenticated` rolünün vault erişimi yok. (Trendyol GO tetikleyicisinde
-- aynı hata sessizce yutulmuştu — bkz. 20261013144500.)

create or replace function public.fn_notify_review_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_req bigint;
begin
  if coalesce(new.admin_reply, '') = '' then return new; end if;
  if coalesce(old.admin_reply, '') = coalesce(new.admin_reply, '') then return new; end if;
  if new.user_id is null then return new; end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    raise warning 'fn_notify_review_reply: service_role_key Vault''ta yok';
    return new;
  end if;

  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'mode', 'by_content',
      'user_ids', jsonb_build_array(new.user_id),
      'title', 'Değerlendirmene yanıt verdik',
      'body', left(regexp_replace(new.admin_reply, '\s+', ' ', 'g'), 120),
      'deep_link', 'kcal://reviews',
      'category', 'transactional',
      'data', jsonb_build_object('review_id', new.id)
    )
  ) into v_req;

  raise notice 'review yanit push tetiklendi (review_id=%, request_id=%)', new.id, v_req;
  return new;

exception when others then
  -- Bildirim gönderilemezse yanıtın kaydı engellenmemeli.
  raise warning 'fn_notify_review_reply failed: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;

create trigger trg_notify_review_reply
after update of admin_reply on public.reviews
for each row execute function public.fn_notify_review_reply();;
