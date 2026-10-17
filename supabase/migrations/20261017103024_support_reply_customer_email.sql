-- Destek yanıtı artık müşteriye HEM push HEM e-posta olarak gidiyor.
-- Push'u fn_notify_support_reply zaten atıyor; buraya e-posta çağrısı ekleniyor.
-- E-posta, uygulamayı silmiş ya da bildirimi kapatmış müşteriye de ulaşır.

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

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_notify_support_reply: service_role_key Vault''ta yok';
    return new;
  end if;

  -- 1) Push (uygulama acikken/yukluyken en hizli kanal)
  if new.user_id is not null then
    select net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      body := jsonb_build_object(
        'mode','by_content',
        'user_ids', jsonb_build_array(new.user_id),
        'title','Destek talebine yanıt verdik',
        'body', left(regexp_replace(new.admin_reply, '\s+', ' ', 'g'), 120),
        'deep_link','ProfileSupport',
        'category','transactional',
        'data', jsonb_build_object('ticket_id', new.id)
      )
    ) into v_req;
  end if;

  -- 2) E-posta (kalici kanal; push kapaliysa ya da uygulama silinmisse tek yol)
  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/order-alert',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object('type','support_reply','ticket_id', new.id)
  ) into v_req;

  return new;
exception when others then
  raise warning 'fn_notify_support_reply failed: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;;
