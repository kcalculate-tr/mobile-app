-- G8-S1 — AI denetim yeniden deneme cron'u (moderate-content).
-- version: 20261104002100  name: g8_moderation_cron
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı, staging'de test edilmedi (gece kuralı).
-- Geri alma: supabase/rollbacks/20261104002100_g8_moderation_cron_rollback.sql
-- Önkoşul: 20261104002000_g8_social.sql (moderation_queue) + moderate-content edge
-- function deploy edilmiş + Vault'ta 'service_role_key' olmalı. (Edge deploy ayrı iş.)
--
-- İstemci create_post/add_comment sonrası moderate-content'i çağırır. Çağrı hiç
-- yapılmadıysa ya da hata/zaman aşımı yüzünden hedef 'pending' kaldıysa, bu cron
-- her 5 dk'da 10 dk'dan eski 'pending' kuyruk satırlarını EN FAZLA 3 kez yeniden
-- dener. attempts cron'da artırılır (edge function erişilemese bile sınır tutar);
-- moderate-content nihai karar verince moderation_queue.status='done' yapar.

begin;

create or replace function public.fn_moderate_pending_retry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key  text;
  v_row  record;
  v_n    integer := 0;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_moderate_pending_retry: service_role_key Vault''ta yok';
    return 0;
  end if;

  for v_row in
    select target_type, target_id
      from public.moderation_queue
     where status = 'pending'
       and attempts < 3
       and created_at < now() - interval '10 minutes'
       and (last_attempt_at is null or last_attempt_at < now() - interval '5 minutes')
     order by created_at asc
     limit 50          -- her tik en fazla 50 hedef (maliyet/timeout koruması)
  loop
    -- Denemeyi ÖNCE say (edge erişilemese bile 3 sınırı tutsun).
    update public.moderation_queue
       set attempts = attempts + 1, last_attempt_at = now()
     where target_type = v_row.target_type and target_id = v_row.target_id;

    perform net.http_post(
      url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/moderate-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'target_type', v_row.target_type,
        'target_id',   v_row.target_id
      )
    );
    v_n := v_n + 1;
  end loop;

  return v_n;
exception when others then
  raise warning 'fn_moderate_pending_retry failed: % (%)', sqlerrm, sqlstate;
  return -1;
end;
$$;

revoke all on function public.fn_moderate_pending_retry() from public, anon, authenticated;

-- Her 5 dakikada bir. İş adı: moderate_pending_retry (G8-S1 görevi).
select cron.schedule(
  'moderate_pending_retry',
  '*/5 * * * *',
  $cron$ select public.fn_moderate_pending_retry(); $cron$
);

commit;
