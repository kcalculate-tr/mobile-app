-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261027140108  name: fn_ad_maskele_bas_harf_buyut
-- Ad maskeleme: "firat beyde" -> "Firat B."
-- Musteriler adini kucuk harfle yazabiliyor; vitrinde ilk harf buyuk olsun.
-- Geri kalani oldugu gibi birakiliyor: Turkce'de lower()/initcap() I/i
-- harflerini bozabiliyor, adi yanlis yazmaktan iyisi dokunmamak.
create or replace function public.fn_ad_maskele(p_ad text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  with t as (select nullif(trim(coalesce(p_ad, '')), '') as ad)
  select case
    when t.ad is null then 'kcal. müşterisi'
    else
      (select upper(left(ilk, 1)) || substr(ilk, 2)
         from (select split_part(t.ad, ' ', 1) as ilk) q)
      || case
           when position(' ' in t.ad) > 0
             then ' ' || upper(left(split_part(t.ad, ' ', 2), 1)) || '.'
           else ''
         end
  end
  from t;
$$;
