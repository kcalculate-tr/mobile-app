-- G60-S1 md.4 — eatkcal konum kapısı: arama boşken seçili ülkenin en kalabalık şehirleri.
-- version: 20261117230500  name: g60_top_cities
--
-- DURUM: YALNIZ DOSYA. Canlıya uygulanmadı. Geri alma:
--   supabase/rollbacks/20261117230500_g60_top_cities_rollback.sql
-- Önkoşul: 20261110100100_g22_s2_geo.sql + 20261110190100_g23_geo_admin1.sql (geo_cities.admin1;
-- geo_cities_country_pop indeksi (country_iso2, population desc) zaten var).
--
-- Kök neden (17 Kas, canlıda doğrulandı): Türkiye dışı ülkede şehir listesi yalnız search_cities
-- sonucundan doluyordu; arama kutusu boşken liste BOŞ ("Eşleşme yok"), RPC < 2 harfte 0 satır.
-- KARAR: search_cities'e DOKUNULMAZ (eski sürümler aynı imzayı çağırır); ayrı top_cities.
-- Dönüş kolonları search_cities ile aynı (istemci aynı parseCityRows'u kullanır).
-- Kapı oturumsuz da açılır → execute anon + authenticated. security invoker (geo_cities RLS: SELECT açık).
-- 0 satır = ülkenin şehir verisi yok → istemci serbest yazım alanı ("Şehrini yaz") gösterir.
-- İdempotent.
begin;

create or replace function public.top_cities(p_country text, p_limit int default 30)
returns table (
  geonameid    integer,
  name         text,
  ascii_name   text,
  country_iso2 text,
  population   integer,
  lat          double precision,
  lng          double precision,
  admin1       text
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.geonameid, c.name, c.ascii_name, c.country_iso2, c.population, c.lat, c.lng, c.admin1
    from public.geo_cities c
   where c.country_iso2 = pg_catalog.upper(pg_catalog.btrim(coalesce(p_country, '')))
   order by c.population desc, c.geonameid
   limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

comment on function public.top_cities(text, int) is
  'G60-S1: eatkcal kapısı — ülkenin en kalabalık şehirleri (nüfus azalan, en çok 50; varsayılan 30). 0 satır = veri yok.';

revoke all on function public.top_cities(text, int) from public;
grant execute on function public.top_cities(text, int) to anon, authenticated;

commit;
