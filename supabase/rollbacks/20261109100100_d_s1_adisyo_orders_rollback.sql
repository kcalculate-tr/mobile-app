-- D-S1 — 20261109100100_d_s1_adisyo_orders.sql geri alma. UYGULANMADI (yalnız dosya).
-- Önce 20261109100300 ve 20261109100200 geri alınmalı (KPI görünümleri ve
-- reconcile bu tabloya bağlı). adisyo_orders verisi SİLİNİR (yeniden
-- adisyo-reconcile ile doldurulabilir; kaynak Adisyo).
begin;
delete from public.app_settings where key = 'adisyo_orders';
drop function if exists public.adisyo_orders_relink();
drop function if exists public.adisyo_order_upsert(jsonb);
drop function if exists public.adisyo_resolve_branch(text);
drop index if exists public.adisyo_webhook_events_ao_queue_idx;
drop index if exists public.adisyo_webhook_events_received_idx;
alter table public.adisyo_webhook_events
  drop column if exists ao_synced_at,
  drop column if exists ao_attempts,
  drop column if exists ao_next_retry_at,
  drop column if exists ao_error;
drop table if exists public.adisyo_orders;
commit;
