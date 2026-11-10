-- G22-S2 md.3 — eatkcal konum: Avrupa + Amerika (Kuzey, Orta, Güney) ülke + şehir araması.
-- version: 20261110100100  name: g22_s2_geo
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- İdempotent: tekrar çalıştırmak güvenli.
-- Geri alma: supabase/rollbacks/20261110100100_g22_s2_geo_rollback.sql
-- Tohum verisi (AYRI, migration'dan SONRA, sırayla):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_countries.sql
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_cities.sql
--
-- Veri: GeoNames cities15000 + countryInfo (CC BY 4.0, https://www.geonames.org/).
-- Atıf istemcide: Profil › Sözleşmeler altı "Şehir verisi: GeoNames (CC BY 4.0)".
--
-- 1) geo_countries (iso2 PK, name_tr, name_en, continent) — EU / NA / SA ülkeleri + TR
--    (TR GeoNames'te AS; şehirleri YOK, istemcide mevcut il/ilçe akışı aynen).
-- 2) geo_cities (geonameid PK, name, ascii_name, country_iso2 → geo_countries, population, lat, lng).
-- 3) geo_fold(text): küçük harf + Latin aksan katlama (unaccent eklentisi gerekmez,
--    IMMUTABLE → ifade indeksinde kullanılabilir). "münchen" ~ "munchen", "İzmir" ~ "izmir".
-- 4) pg_trgm GIN indeksleri: geo_fold(ascii_name), geo_fold(name) → '%q%' araması indeksli.
-- 5) RLS açık; anon + authenticated YALNIZ SELECT (yazma politikası yok).
-- 6) search_cities(q, country default null): en çok 20 satır; önce adı q ile başlayanlar,
--    sonra nüfus azalan. q < 2 karakter → boş. LIKE joker karakterleri (%, _, \) kaçışlı.
--    security invoker + sabit search_path; execute → anon, authenticated.
begin;

create extension if not exists pg_trgm with schema extensions;

-- ── 1) ülkeler ──────────────────────────────────────────────────────────────
create table if not exists public.geo_countries (
  iso2      text primary key check (iso2 ~ '^[A-Z]{2}$'),
  name_tr   text not null check (char_length(name_tr) between 1 and 120),
  name_en   text not null check (char_length(name_en) between 1 and 120),
  continent text not null check (continent in ('EU', 'NA', 'SA', 'AS', 'AF', 'OC', 'AN'))
);

comment on table public.geo_countries is
  'G22-S2: eatkcal ülke listesi (GeoNames countryInfo, CC BY 4.0). Tohum: supabase/seed/geo_countries.sql';

-- ── 2) şehirler ─────────────────────────────────────────────────────────────
create table if not exists public.geo_cities (
  geonameid    integer primary key check (geonameid > 0),
  name         text not null check (char_length(name) between 1 and 200),
  ascii_name   text not null check (char_length(ascii_name) between 1 and 200),
  country_iso2 text not null references public.geo_countries (iso2) on update cascade on delete cascade,
  population   integer not null default 0 check (population >= 0),
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180)
);

comment on table public.geo_cities is
  'G22-S2: GeoNames cities15000 (CC BY 4.0), kıta EU/NA/SA. Tohum: supabase/seed/geo_cities.sql';

-- ── 3) aksan katlama ────────────────────────────────────────────────────────
create or replace function public.geo_fold(s text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.translate(
    pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.lower(
      pg_catalog.replace(coalesce(s, ''), 'İ', 'i')), 'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe'), 'þ', 'th'),
    'áàâäãåāăąçćčďđéèêëēėęěğíìîïīįıłñńňóòôöõøōőřśšşșţțťúùûüūůűųýÿžźż',
    'aaaaaaaaacccddeeeeeeeegiiiiiiilnnnoooooooorsssstttuuuuuuuuyyzzz'
  );
$$;

comment on function public.geo_fold(text) is
  'G22-S2: küçük harf + Latin aksan katlama (şehir araması; ifade indeksi için IMMUTABLE).';

-- ── 4) indeksler ────────────────────────────────────────────────────────────
-- pg_trgm canlıda daha önce başka bir şemaya (ör. public) kurulmuşsa `create extension
-- if not exists` yerinde bırakır → operatör sınıfı eklentinin GERÇEK şemasından alınır.
do $$
declare
  trgm_schema text;
begin
  select n.nspname into trgm_schema
  from pg_catalog.pg_extension x
  join pg_catalog.pg_namespace n on n.oid = x.extnamespace
  where x.extname = 'pg_trgm';
  execute format(
    'create index if not exists geo_cities_ascii_trgm on public.geo_cities using gin (public.geo_fold(ascii_name) %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists geo_cities_name_trgm on public.geo_cities using gin (public.geo_fold(name) %I.gin_trgm_ops)',
    trgm_schema
  );
end $$;
create index if not exists geo_cities_country_pop
  on public.geo_cities (country_iso2, population desc);
create index if not exists geo_cities_pop
  on public.geo_cities (population desc);

-- ── 5) RLS: herkese açık salt okuma ─────────────────────────────────────────
alter table public.geo_countries enable row level security;
alter table public.geo_cities enable row level security;

drop policy if exists geo_countries_read on public.geo_countries;
create policy geo_countries_read on public.geo_countries
  for select to anon, authenticated using (true);

drop policy if exists geo_cities_read on public.geo_cities;
create policy geo_cities_read on public.geo_cities
  for select to anon, authenticated using (true);

revoke all on public.geo_countries from anon, authenticated;
revoke all on public.geo_cities from anon, authenticated;
grant select on public.geo_countries to anon, authenticated;
grant select on public.geo_cities to anon, authenticated;

-- ── 6) arama RPC ────────────────────────────────────────────────────────────
create or replace function public.search_cities(q text, country text default null)
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

comment on function public.search_cities(text, text) is
  'G22-S2: eatkcal şehir araması (GeoNames). En çok 20; ad başı eşleşmeleri önce, sonra nüfus azalan.';

revoke all on function public.search_cities(text, text) from public;
grant execute on function public.search_cities(text, text) to anon, authenticated;
grant execute on function public.geo_fold(text) to anon, authenticated;

commit;
