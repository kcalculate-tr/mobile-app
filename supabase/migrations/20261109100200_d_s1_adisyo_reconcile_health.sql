-- D-S1 — Adisyo gece mutabakatı (pg_cron 04:00 İstanbul) + webhook sağlık alarmı
-- version: 20261109100200  name: d_s1_adisyo_reconcile_health
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- PGlite ile 2 kez (idempotent) denendi: supabase/tests/d_s1.check.mjs
-- Önkoşul: 20261109100100_d_s1_adisyo_orders.sql; edge function
--          adisyo-reconcile DEPLOY edilmiş olmalı (yoksa cron 404 alır, zararsız).
-- Geri alma: supabase/rollbacks/20261109100200_d_s1_adisyo_reconcile_health_rollback.sql
--
-- 1) adisyo-reconcile her gece 01:00 UTC = 04:00 İstanbul (Türkiye UTC+3, yaz
--    saati yok). Ayar: app_settings.adisyo_reconcile.
-- 2) Sağlık: 15 dk'da bir. Açık saatlerde (09:00–21:30 İstanbul) son webhook
--    olayından (ya da bugünkü açılıştan, hangisi yeniyse) bu yana > 90 dk geçtiyse
--    order-alert 'webhook_health' ile yöneticilere TEK e-posta. Aynı kesinti için
--    tekrar göndermez (last_alert_for = son olay zamanı); olay gelince sıfırlanır.

begin;

-- ── Ayarlar (varsa dokunma) ────────────────────────────────────────────────
insert into public.app_settings (key, value, description) values
  ('adisyo_reconcile',
   '{"batch":150,"max_attempts":8,"recheck_open_hours":48,"delay_ms":150,"time_budget_ms":110000,
     "list_endpoint_enabled":false,"list_endpoint_path":"Orders","list_query":"?startDate={from}&endDate={to}"}'::jsonb,
   'D-S1: adisyo-reconcile ayarı. list_endpoint_* DOĞRULANMADI — adisyo-debug ile denenmeden açma (D-S1-LOG).'),
  ('adisyo_webhook_health',
   '{"enabled":true,"open_from":"09:00","open_to":"21:30","max_gap_minutes":90,"last_alert_for":null,"last_alert_at":null}'::jsonb,
   'D-S1: Adisyo webhook sessizlik alarmı (açık saat, eşik dk). last_alert_* sistem yazar.')
on conflict (key) do nothing;

-- ── Sağlık kararı (saf; test edilebilir) ───────────────────────────────────
-- Dönüş: {alert, reason, gap_minutes, alert_key}
--   reason: disabled | closed | ok | already_alerted | silent
create or replace function public.adisyo_webhook_health_decide(
  p_now        timestamptz,
  p_last_event timestamptz,
  p_cfg        jsonb
) returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_cfg        jsonb     := coalesce(p_cfg, '{}'::jsonb);
  v_local      timestamp := p_now at time zone 'Europe/Istanbul';
  v_from       time      := coalesce(nullif(v_cfg->>'open_from', '')::time, time '09:00');
  v_to         time      := coalesce(nullif(v_cfg->>'open_to', '')::time,   time '21:30');
  v_max        integer   := coalesce(nullif(v_cfg->>'max_gap_minutes', '')::integer, 90);
  v_open_start timestamptz;
  v_ref        timestamptz;
  v_gap_open   integer;
  v_gap_total  integer;
  v_key        text      := coalesce(to_char(p_last_event at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'none');
begin
  v_open_start := (v_local::date + v_from) at time zone 'Europe/Istanbul';
  v_ref        := greatest(coalesce(p_last_event, '-infinity'::timestamptz), v_open_start);
  v_gap_open   := floor(extract(epoch from (p_now - v_ref)) / 60);
  v_gap_total  := case when p_last_event is null then null
                       else floor(extract(epoch from (p_now - p_last_event)) / 60) end;

  if not coalesce((v_cfg->>'enabled')::boolean, true) then
    return jsonb_build_object('alert', false, 'reason', 'disabled', 'gap_minutes', v_gap_total, 'alert_key', v_key);
  end if;
  if v_local::time < v_from or v_local::time > v_to then
    return jsonb_build_object('alert', false, 'reason', 'closed', 'gap_minutes', v_gap_total, 'alert_key', v_key);
  end if;
  if v_gap_open <= v_max then
    return jsonb_build_object('alert', false, 'reason', 'ok', 'gap_minutes', v_gap_total, 'alert_key', v_key);
  end if;
  if v_cfg->>'last_alert_for' = v_key then
    return jsonb_build_object('alert', false, 'reason', 'already_alerted', 'gap_minutes', v_gap_total, 'alert_key', v_key);
  end if;
  return jsonb_build_object('alert', true, 'reason', 'silent',
                            'gap_minutes', coalesce(v_gap_total, v_gap_open), 'alert_key', v_key);
end;
$$;

-- ── Sağlık kontrolü (cron çağırır) ─────────────────────────────────────────
create or replace function public.fn_adisyo_webhook_health_check(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg   jsonb;
  v_last  timestamptz;
  v_valid timestamptz;
  v_dec   jsonb;
  v_key   text;
begin
  select value into v_cfg from public.app_settings where key = 'adisyo_webhook_health';
  select e.received_at into v_last  from public.adisyo_webhook_events e
   where e.received_at is not null order by e.received_at desc limit 1;
  select e.received_at into v_valid from public.adisyo_webhook_events e
   where e.received_at is not null and e.signature_valid is true order by e.received_at desc limit 1;

  v_dec := public.adisyo_webhook_health_decide(p_now, v_last, v_cfg);
  v_dec := v_dec || jsonb_build_object('last_event_at', v_last, 'last_valid_at', v_valid);

  if not coalesce((v_dec->>'alert')::boolean, false) then
    return v_dec;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_adisyo_webhook_health_check: service_role_key Vault''ta yok';
    return v_dec || jsonb_build_object('sent', false, 'error', 'no_service_key');
  end if;

  perform net.http_post(
    url     := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/order-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object(
      'type', 'webhook_health',
      'last_event_at', v_last,
      'last_valid_at', v_valid,
      'gap_minutes', v_dec->'gap_minutes',
      'threshold_minutes', coalesce(v_cfg->'max_gap_minutes', '90'::jsonb)
    )
  );

  update public.app_settings
     set value = coalesce(value, '{}'::jsonb)
                 || jsonb_build_object('last_alert_for', v_dec->>'alert_key', 'last_alert_at', p_now),
         updated_at = now()
   where key = 'adisyo_webhook_health';

  return v_dec || jsonb_build_object('sent', true);
exception when others then
  raise warning 'fn_adisyo_webhook_health_check failed: % (%)', sqlerrm, sqlstate;
  return jsonb_build_object('alert', false, 'reason', 'error', 'error', sqlerrm);
end;
$$;

-- ── Gece mutabakatı tetikleyici ────────────────────────────────────────────
create or replace function public.fn_adisyo_reconcile_kick()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_key text; v_req bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_adisyo_reconcile_kick: service_role_key Vault''ta yok';
    return null;
  end if;
  select net.http_post(
    url     := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
exception when others then
  raise warning 'fn_adisyo_reconcile_kick failed: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

revoke all on function public.adisyo_webhook_health_decide(timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.fn_adisyo_webhook_health_check(timestamptz) from public, anon, authenticated;
revoke all on function public.fn_adisyo_reconcile_kick() from public, anon, authenticated;
grant execute on function public.adisyo_webhook_health_decide(timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.fn_adisyo_webhook_health_check(timestamptz) to service_role;
grant execute on function public.fn_adisyo_reconcile_kick() to service_role;

-- ── Zamanlama (pg_cron varsa; idempotent: önce kaldır, sonra kur) ──────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron yok: zamanlama atlandı';
    return;
  end if;
  perform cron.unschedule(j.jobname) from cron.job j
   where j.jobname in ('adisyo-reconcile-nightly', 'adisyo-webhook-health');
  perform cron.schedule('adisyo-reconcile-nightly', '0 1 * * *',
                        $c$ select public.fn_adisyo_reconcile_kick(); $c$);
  perform cron.schedule('adisyo-webhook-health', '*/15 * * * *',
                        $c$ select public.fn_adisyo_webhook_health_check(); $c$);
end $$;

commit;
