-- Geri alma: 20261117230400_g60_post_views.sql
-- DİKKAT: toplanan görüntülenme verisi silinir (yalnız ölçüm; puana girmiyordu).
-- İstemci RPC yoksa sessizce vazgeçer (impressions.ts: fonksiyon bulunamadı → gönderimi durdurur).
begin;
drop function if exists public.record_post_views(jsonb);
drop table if exists public.post_views;
commit;
