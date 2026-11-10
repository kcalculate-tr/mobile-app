-- Geri alma: 20261110100100_g22_s2_geo.sql
-- search_cities + geo_fold fonksiyonları, geo_cities + geo_countries tabloları (tohum
-- verisiyle birlikte) düşürülür. Kullanıcı verisi YOK (yalnız GeoNames referans verisi).
-- pg_trgm eklentisine DOKUNULMAZ (başka nesneler kullanıyor olabilir).
-- İstemci: tablo/RPC yokken şehir araması hata durumuna düşer ("yazdığınla devam et"
-- seçeneği çalışır), TR il/ilçe akışı etkilenmez.
begin;

drop function if exists public.search_cities(text, text);
drop table if exists public.geo_cities;
drop table if exists public.geo_countries;
drop function if exists public.geo_fold(text);

commit;
