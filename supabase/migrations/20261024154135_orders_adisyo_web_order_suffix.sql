-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261024154135  name: orders_adisyo_web_order_suffix
-- Bir siparis Adisyo'ya yazildiktan sonra baska subeye tasinirsa, ayni
-- WebOrderId ile ikinci kayit Adisyo tarafindan 711 ile reddediliyor
-- (KCAL-S825-520 ornegi). Yeniden yonlendirilen siparisler icin referansa
-- ek koyabilmek adina opsiyonel bir sonek alani.
-- Bos oldugunda davranis degismez; normal siparisler ve 712/713 idempotent
-- eslesmesi aynen calismaya devam eder.
alter table public.orders
  add column if not exists adisyo_web_order_suffix text;

comment on column public.orders.adisyo_web_order_suffix is
  'Doluysa Adisyo WebOrderId''sinin sonuna eklenir. Sube degisikligi sonrasi yeniden gonderimde kullanilir.';
