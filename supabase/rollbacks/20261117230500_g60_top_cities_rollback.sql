-- Geri alma: 20261117230500_g60_top_cities.sql
-- İstemci top_cities yoksa (fonksiyon bulunamadı) serbest yazım alanına düşer; arama aynen çalışır.
begin;
drop function if exists public.top_cities(text, int);
commit;
