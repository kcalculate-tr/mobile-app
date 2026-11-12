-- G38-S1 md.3 — 20261112T1403_g38_soslar_ac GERİ ALMA (MANUEL): sosları gizler, "Soslar"
-- kategorisini (başka ürün kullanmıyorsa) siler.
begin;

update public.products
set is_available = false
where brand = 'kcalculate'
  and slug in ('aci-sweet-chili-sos', 'ranch-sos', 'balli-hardal-sos', 'remoulade-sos', 'chipotle-sos');

delete from public.categories c
where c.name = 'Soslar'
  and not exists (
    select 1 from public.products p
    where p.category = 'Soslar'
      and p.slug not in ('aci-sweet-chili-sos', 'ranch-sos', 'balli-hardal-sos', 'remoulade-sos', 'chipotle-sos')
  );

commit;
