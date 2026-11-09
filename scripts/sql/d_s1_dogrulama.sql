-- D-S1 — canlıya uygulandıktan SONRA doğrulama (salt-okunur; kişisel veri döndürmez).
-- Sıra: 20261109100100 → 20261109100200 → 20261109100300 migration'ları + deploy
-- (adisyo-webhook-receiver, adisyo-reconcile, order-alert). Ayrıntı: docs/night/D-S1-LOG.md

-- 1) Nesneler var mı
select to_regclass('public.adisyo_orders')          as adisyo_orders,
       to_regclass('public.analytics_event_names')  as event_names,
       to_regclass('public.kpi_orders_unified')     as kpi_view,
       to_regprocedure('public.admin_kpi(date,date,uuid)') as admin_kpi;

-- 2) Cron işleri (2 adet)
select jobname, schedule, active from cron.job where jobname like 'adisyo-%' order by 1;

-- 3) Kuyruk büyüklüğü (eski uygulama dışı olaylar dahil) ve son mutabakat özeti
select count(*) filter (where ao_synced_at is null) as kuyrukta,
       count(*) filter (where ao_synced_at is not null) as yazildi,
       count(*) filter (where ao_attempts >= 8) as vazgecildi
  from public.adisyo_webhook_events
 where signature_valid is true and adisyo_order_id is not null
   and event_type in ('order.created', 'order.updated');
select created_at, request_body from public.adisyo_api_log
 where event_type in ('Reconcile.summary', 'Reconcile.error') order by id desc limit 3;

-- 4) Kanal dağılımı ve şubesi eşlenmemiş restaurantKey'ler (anahtar kişisel değil)
select channel, count(*), min(inserted_at), max(inserted_at) from public.adisyo_orders group by 1 order by 2 desc;
select restaurant_key, count(*) from public.adisyo_orders where branch_id is null group by 1 order by 2 desc;
-- Tanınmayan kanal adları (normalize kuralına eklenecekler):
select channel_raw, count(*) from public.adisyo_orders where channel = 'diger' group by 1 order by 2 desc limit 20;

-- 5) Webhook sağlığı (şimdi alarm verir miydi?) — yalnız okur, e-posta göndermez:
select public.adisyo_webhook_health_decide(now(),
         (select max(received_at) from public.adisyo_webhook_events),
         (select value from public.app_settings where key = 'adisyo_webhook_health'));

-- 6) KPI örneği (service_role / SQL editöründe):
--    select set_config('request.jwt.claims', '{"role":"service_role"}', true);
--    select jsonb_pretty(public.admin_kpi(current_date - 7, current_date));

-- ── ŞABLON (YAZAR — elle, onaylı): restaurantKey → şube eşlemesi ──────────
-- 4. sorgudaki eşlenmemiş anahtarları şubelere yazın (adisyo_config'teki diğer
-- alanlar korunur), sonra relink:
--   update public.branches set adisyo_config = coalesce(adisyo_config, '{}'::jsonb)
--          || jsonb_build_object('restaurantKey', '<ANAHTAR>')
--    where slug = '<sube-slug>';
--   select public.adisyo_orders_relink();
