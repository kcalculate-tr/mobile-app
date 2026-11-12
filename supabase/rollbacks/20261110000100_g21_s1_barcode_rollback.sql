-- Geri alma: 20261110000100_g21_s1_barcode.sql
-- 1) 3 barkod olay adı silinir (analytics_events satırlarına dokunulmaz).
-- 2) CHECK'ten 'barcode' çıkarılır — YALNIZ hiç barkod kaydı yoksa (kullanıcı verisi
--    silinmez; kayıt varsa NOTICE ile atlanır, önce istemci geri alınmalı).
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names
     where name in ('barcode_scan', 'barcode_found', 'barcode_not_found');
  end if;
end $$;

do $$
declare
  vals text[];
begin
  if exists (select 1 from public.meal_consumptions where source = 'barcode') then
    raise notice 'g21_s1_barcode rollback: barcode kayıtları var — CHECK değiştirilmedi';
    return;
  end if;
  select array_agg(v order by v) into vals
  from (
    select unnest(array['manual', 'pantry', 'post', 'ai_scan', 'day_card']) as v
    union
    select distinct source from public.meal_consumptions where source is not null
  ) s;
  alter table public.meal_consumptions drop constraint if exists meal_consumptions_source_check;
  execute format(
    'alter table public.meal_consumptions add constraint meal_consumptions_source_check check (source = any (%L::text[]))',
    vals
  );
end $$;

commit;
