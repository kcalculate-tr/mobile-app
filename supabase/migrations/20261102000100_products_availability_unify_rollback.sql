-- ROLLBACK — 20261102000100_products_availability_unify
-- Trigger ve senkron fonksiyonunu kaldırır, is_available'ı eski (nullable,
-- default'suz) haline döndürür. Veri (in_stock=is_available) olduğu gibi kalır;
-- geriye uyumlu olduğu için veri geri alınmasına gerek yok.

begin;

drop trigger if exists trg_products_sync_availability on public.products;
drop function if exists public.fn_products_sync_availability();

alter table public.products
  alter column is_available drop not null,
  alter column is_available drop default;

commit;
