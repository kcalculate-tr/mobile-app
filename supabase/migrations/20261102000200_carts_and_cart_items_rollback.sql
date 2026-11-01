-- ROLLBACK — 20261102000200_carts_and_cart_items
-- Sepet tablolarını ve bağlı politika/trigger/index'leri kaldırır.
-- DİKKAT: tablolar silinince içindeki sepet verisi de silinir.

begin;

drop table if exists public.cart_items cascade;
drop table if exists public.carts cascade;

commit;
