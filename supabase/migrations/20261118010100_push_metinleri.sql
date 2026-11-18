-- 18 Kas (İlter onayı): sosyal push metinleri.
--   beğeni  : "%{ad} gönderini beğendi"            (aynı)
--   yorum   : "%{ad} yorum yaptı: %{alıntı}"       (alıntı = yorumun ilk 80 karakteri)
--   yanıt   : "%{ad} yanıt verdi: %{alıntı}"
--   takip   : "%{ad} seni takip etmeye başladı"    (aynı)
--   istek   : "%{ad} seni takip etmek istiyor"
-- Yalnız fn_push_social_notification gövdesi; tablo/tetikleyici değişmez. Geri alma: g8 gövdesi.
create or replace function public.fn_push_social_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key    text;
  v_actor  text;
  v_handle text;
  v_title  text;
  v_body   text;
  v_link   text;
  v_quote  text;
  v_req    bigint;
begin
  if not public.feed_flag_enabled('sosyal_bildirim') then
    return NEW;
  end if;

  select coalesce(
           pr.full_name,
           nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
           pr.handle, 'Biri'),
         pr.handle
    into v_actor, v_handle
  from public.profiles pr where pr.id = NEW.actor_id;
  v_actor := coalesce(v_actor, 'Biri');

  if NEW.comment_id is not null and NEW.kind in ('comment', 'reply') then
    select nullif(btrim(regexp_replace(c.body, '\s+', ' ', 'g')), '') into v_quote
      from public.post_comments c where c.id = NEW.comment_id;
    if v_quote is not null and char_length(v_quote) > 80 then
      v_quote := left(v_quote, 79) || '…';
    end if;
  end if;

  v_body := case NEW.kind
    when 'like'           then v_actor || ' gönderini beğendi'
    when 'comment'        then v_actor || ' yorum yaptı' || coalesce(': ' || v_quote, '')
    when 'reply'          then v_actor || ' yanıt verdi' || coalesce(': ' || v_quote, '')
    when 'follow'         then v_actor || ' seni takip etmeye başladı'
    when 'follow_request' then v_actor || ' seni takip etmek istiyor'
    when 'follow_accept'  then v_actor || ' takip isteğini kabul etti'
    when 'add_to_day'     then v_actor || ' öğününü gününe ekledi'
    when 'did_it'         then v_actor || ' etkinliğini denedi'
    else v_actor || ' seninle etkileşti'
  end;
  v_title := 'Kcalculate';
  v_link  := case
    when NEW.post_id is not null then 'kcal://p/' || NEW.post_id::text
    when v_handle is not null    then 'kcal://u/' || v_handle
    else 'kcal://kesfet'
  end;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_push_social_notification: service_role_key Vault''ta yok';
    return NEW;
  end if;

  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'mode', 'by_content',
      'user_ids', jsonb_build_array(NEW.user_id),
      'title', v_title,
      'body', v_body,
      'deep_link', v_link,
      'category', 'behavioral',
      'data', jsonb_build_object('social_notification_id', NEW.id, 'kind', NEW.kind)
    )
  ) into v_req;
  return NEW;
exception when others then
  raise warning 'fn_push_social_notification failed: % (%)', sqlerrm, sqlstate;
  return NEW;
end;
$function$;
