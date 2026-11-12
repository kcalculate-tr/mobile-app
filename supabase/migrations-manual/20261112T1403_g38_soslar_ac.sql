-- =====================================================================
-- G38-S1 md.3 — Sosları AÇ (MANUEL, `supabase db push` ile ÇALIŞMAZ)
--
-- Bu dosya KASITLI olarak supabase/migrations/ ALTINDA DEĞİL. Önkoşullar:
--   1) 20261112140200_g38_soslar.sql uygulandı (5 sos gizli eklendi).
--   2) Adisyo'da 5 sos ürünü var (adları "(50cc)"li olabilir — eşleşme parantezi yok sayar).
--   3) adisyo-sync-products MERKEZ kipi çalıştırıldı → products.adisyo_product_unit_id doldu.
--   4) Bayraklı şubesi kendi Adisyo hesabını kullanıyor → aynı fonksiyon
--      { "branch_id": "921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0", "dry_run": false } ile çalıştırıldı
--      → branch_product_adisyo satırları oluştu.
--
-- NE YAPAR (idempotent, tekrar güvenli):
--   · "Soslar" kategorisini ekler (yoksa; sıra 55 = Detoks & Shake (50) ile Bowl's (60) arası).
--   · YALNIZ hem merkez eşlemesi hem Bayraklı eşlemesi olan sosları açar (is_available = true).
--     Eşlemesi eksik sos kapalı kalır → sipariş "unmapped_products" ile düşmez.
-- Rollback: supabase/migrations-manual/20261112T1403_g38_soslar_ac_rollback.sql
-- =====================================================================
begin;

insert into public.categories (name, "order")
select 'Soslar', 55
where not exists (select 1 from public.categories where name = 'Soslar');

update public.products p
set is_available = true
where p.brand = 'kcalculate'
  and p.slug in ('aci-sweet-chili-sos', 'ranch-sos', 'balli-hardal-sos', 'remoulade-sos', 'chipotle-sos')
  and p.adisyo_product_unit_id is not null
  and exists (
    select 1 from public.branch_product_adisyo b
    where b.product_id = p.id
      and b.branch_id = '921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0'
  );

commit;

-- Kontrol (yalnız okuma) — kapalı kalan varsa eşlemesi eksiktir:
--   select p.id, p.name, p.is_available, p.adisyo_product_unit_id,
--          exists (select 1 from public.branch_product_adisyo b where b.product_id = p.id) as bayrakli_eslesme
--   from public.products p where p.brand = 'kcalculate' and p.category = 'Soslar' order by p."order";
