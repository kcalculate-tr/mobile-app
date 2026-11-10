-- Geri alma: 20261110100200_g22_s1_restaurant_rating.sql
begin;
drop function if exists public.restaurant_rating(uuid);
drop index if exists public.reviews_created_at_idx;
commit;
