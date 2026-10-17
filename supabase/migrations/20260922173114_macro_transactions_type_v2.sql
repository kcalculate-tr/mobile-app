-- Yeni modelde iki tip daha var: order_earn (harcamadan kazanım) ve
-- meal_reward (ücretsiz öğün kuponuna dönüştürülen harcama, negatif tutar).
-- purchase / membership_unlock eski modelden kalıyor; geçmiş kayıtlar korunsun
-- diye kaldırılmıyor, ama yeni akışta üretilmiyorlar.
alter table public.macro_transactions
  drop constraint if exists macro_transactions_type_check;

alter table public.macro_transactions
  add constraint macro_transactions_type_check
  check (type = any (array[
    'purchase'::text,
    'reward'::text,
    'membership_unlock'::text,
    'order_earn'::text,
    'meal_reward'::text,
    'expired'::text,
    'admin_adjust'::text
  ]));;
