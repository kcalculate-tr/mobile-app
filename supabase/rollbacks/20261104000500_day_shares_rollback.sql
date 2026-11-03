-- ROLLBACK — 20261104000500_day_shares
-- day_shares tablosunu ve meal_consumptions.photo_path kolonunu geri alır.
-- UYGULANMADI (yalnız dosya).
begin;
drop table  if exists public.day_shares;
alter table public.meal_consumptions drop column if exists photo_path;
commit;
