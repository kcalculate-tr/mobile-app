-- Geri alma: 20261110190100_g23_geo_admin1.sql
-- search_cities G22-S2 gövdesine (admin1'siz) döner, geo_cities.admin1 kolonu düşer.
-- Kullanıcı verisi YOK (yalnız GeoNames referans verisi). İstemci admin1 yoksa yalnız
-- ülke adını gösterir.
begin;

drop function if exists public.search_cities(text, text);

create function public.search_cities(q text, country text default null)
returns table (
  geonameid    integer,
  name         text,
  ascii_name   text,
  country_iso2 text,
  population   integer,
  lat          double precision,
  lng          double precision
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
  select c.geonameid, c.name, c.ascii_name, c.country_iso2, c.population, c.lat, c.lng
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

revoke all on function public.search_cities(text, text) from public;
grant execute on function public.search_cities(text, text) to anon, authenticated;

alter table public.geo_cities drop column if exists admin1;

commit;
