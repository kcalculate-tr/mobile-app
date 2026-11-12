-- G38-S1 md.3 — 20261112140200_g38_soslar GERİ ALMA: 5 sos ürünü silinir (slug + marka ile).
-- DİKKAT: Ürün açılıp sipariş aldıysa order_items/branch_product_adisyo satırları ürün id'sine
-- bağlıdır. Silmek yerine gizlemek daha güvenlidir:
--   update public.products set is_available = false
--   where brand = 'kcalculate' and slug in ('aci-sweet-chili-sos','ranch-sos','balli-hardal-sos','remoulade-sos','chipotle-sos');
-- Aşağıdaki silme, yalnız siparişte/şube eşlemesinde kullanılmamış sos satırlarını siler.
-- "Soslar" kategorisi bu migration'da eklenmez (manuel açma dosyası ekler; onun rollback'i siler).
begin;

delete from public.products p
where p.brand = 'kcalculate'
  and p.slug in ('aci-sweet-chili-sos', 'ranch-sos', 'balli-hardal-sos', 'remoulade-sos', 'chipotle-sos')
  and not exists (select 1 from public.order_items oi where oi.product_id = p.id)
  and not exists (select 1 from public.branch_product_adisyo b where b.product_id = p.id);

-- Kullanılmış olanlar gizlenir.
update public.products
set is_available = false
where brand = 'kcalculate'
  and slug in ('aci-sweet-chili-sos', 'ranch-sos', 'balli-hardal-sos', 'remoulade-sos', 'chipotle-sos');

commit;
