-- G23-S1 md.4 — şehir aramasında eyalet / bölge adı (admin1). Aynı adlı şehirler
-- (ör. ABD'de çok sayıda Springfield) ayırt edilsin.
-- version: 20261110190100  name: g23_geo_admin1
--
-- DURUM: YALNIZ DOSYA — canlı uygulama Claude'da (İlter onayıyla).
-- Geri alma: supabase/rollbacks/20261110190100_g23_geo_admin1_rollback.sql
-- Önkoşul: 20261110100100_g22_s2_geo.sql (geo_cities + search_cities).
-- Sonra tohum: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_cities_admin1.sql
--   (yalnız UPDATE, idempotent; GeoNames admin1CodesASCII, CC BY 4.0).
-- İdempotent: tekrar çalıştırmak güvenli.
--
-- search_cities dönüş tipi değiştiği için fonksiyon düşürülüp yeniden kurulur (aynı
-- imza, aynı sıralama/süzme; yalnız `admin1` kolonu eklendi). Eski istemci ek kolonu
-- yok sayar (parseCityRows), yeni istemci admin1 yoksa yalnız ülke adını gösterir.
begin;

alter table public.geo_cities
  add column if not exists admin1 text check (admin1 is null or char_length(admin1) between 1 and 200);

comment on column public.geo_cities.admin1 is
  'G23-S1: eyalet / bölge adı (GeoNames admin1CodesASCII, ASCII ad). NULL = bilinmiyor.';

drop function if exists public.search_cities(text, text);

create function public.search_cities(q text, country text default null)
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
set search_path = public, extensions
as $$
  with p as (
    select
      public.geo_fold(pg_catalog.left(pg_catalog.btrim(coalesce(q, '')), 64)) as f,
      nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(country, ''))), '') as cc
  ),
  e as (
    select
      p.f,
      p.cc,
      pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(p.f, '\', '\\'), '%', '\%'), '_', '\_') as esc
    from p
  )
  select c.geonameid, c.name, c.ascii_name, c.country_iso2, c.population, c.lat, c.lng, c.admin1
  from public.geo_cities c
  cross join e
  where pg_catalog.char_length(e.f) >= 2
    and (e.cc is null or c.country_iso2 = e.cc)
    and (
      public.geo_fold(c.ascii_name) like '%' || e.esc || '%'
      or public.geo_fold(c.name) like '%' || e.esc || '%'
    )
  order by
    (public.geo_fold(c.name) like e.esc || '%' or public.geo_fold(c.ascii_name) like e.esc || '%') desc,
    c.population desc,
    c.geonameid
  limit 20;
$$;

comment on function public.search_cities(text, text) is
  'G22-S2 + G23-S1: eatkcal şehir araması (GeoNames). En çok 20; ad başı eşleşmeleri önce, sonra nüfus azalan; admin1 = eyalet/bölge.';

revoke all on function public.search_cities(text, text) from public;
grant execute on function public.search_cities(text, text) to anon, authenticated;

commit;
