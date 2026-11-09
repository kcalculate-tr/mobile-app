-- G21-S1 md.2 — Barkod → Open Food Facts (İlter 10 Kas 00:45).
-- version: 20261110000100  name: g21_s1_barcode
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- İdempotent: tekrar çalıştırmak güvenli.
-- Geri alma: supabase/rollbacks/20261110000100_g21_s1_barcode_rollback.sql
--
-- 1) meal_consumptions_source_check → 'barcode' izinli. İstemci barkod kaydını
--    `source = 'barcode'` ile yazar (Tara › Barkod › "Günüme ekle"). Bu migration
--    UYGULANMADAN önce gelen OTA'da barkod kaydı CHECK'e takılır (istemci "Kaydedilemedi"
--    toast'ı gösterir, veri bozulmaz) → OTA'dan ÖNCE uygulanmalı.
--    Küme: repodaki son tanım (g7: manual, pantry, post, ai_scan, day_card) + 'barcode'
--    + canlı tabloda ZATEN bulunan her değer (canlıda repoda olmayan bir kaynak varsa
--    ADD CONSTRAINT patlamasın diye). Kontrol: select distinct source from public.meal_consumptions;
-- 2) analytics_event_names (D-S1) VARSA 3 olay: barcode_scan, barcode_found, barcode_not_found
--    (istemci sözlüğü src/lib/metrics/events.ts; test metricsDictionary eşler).
begin;

do $$
declare
  vals text[];
begin
  select array_agg(v order by v) into vals
  from (
    select unnest(array['manual', 'pantry', 'post', 'ai_scan', 'day_card', 'barcode']) as v
    union
    select distinct source from public.meal_consumptions where source is not null
  ) s;
  alter table public.meal_consumptions drop constraint if exists meal_consumptions_source_check;
  execute format(
    'alter table public.meal_consumptions add constraint meal_consumptions_source_check check (source = any (%L::text[]))',
    vals
  );
end $$;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g21_s1_barcode: public.analytics_event_names yok (D-S1 uygulanmamış) — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('barcode_scan', 'tracking', 'client', 'Barkod okundu (Tara)', 'Barcode read (Scan)', 'offline', null, false),
    ('barcode_found', 'tracking', 'client', 'Barkodlu ürün Open Food Facts’te bulundu', 'Barcode product found on Open Food Facts', 'cached, has_serving', null, false),
    ('barcode_not_found', 'tracking', 'client', 'Barkodlu ürün bulunamadı (yok / kcal yok / bağlantı)', 'Barcode product not found (missing / no kcal / connection)', 'reason: missing|no_kcal|timeout|network|http|offline', null, false)
  on conflict (name) do nothing;
end $$;

commit;
