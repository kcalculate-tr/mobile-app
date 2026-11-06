-- G15-S2 — 20261106000100_g15_water.sql geri alma. UYGULANMADI (yalnız dosya).
-- Not: water_daily verisi silinir; yalnız özellik tamamen geri çekilecekse çalıştır.
begin;
delete from public.feature_flags where key = 'su_takibi';
drop function if exists public.log_water(integer);
drop table if exists public.water_daily;
commit;
