-- G33-S1 — 20261112100100_g33_meal_plan geri alma.
-- Önce tohum geri alınmalı (20261112100200_g33_recipe_seed_rollback.sql) — tablolar zaten düşüyorsa gerekmez.
-- DİKKAT: kullanıcı planları ve alışveriş listeleri silinir.
begin;

delete from public.feature_flags where key = 'ogun_plani';

drop table if exists public.shopping_list_items;
drop table if exists public.meal_plan_items;
drop table if exists public.meal_plans;
drop table if exists public.recipe_ingredients;
drop table if exists public.recipes;
drop table if exists public.ingredient_nutrition;
drop function if exists public._g33_touch_updated_at();

-- user_consents source CHECK: G27 listesine dön. Rıza geçmişi DEĞİŞTİRİLMEZ: var olan 'meal_plan'
-- satırları kalır (NOT VALID → yalnız yeni satırlar denetlenir).
do $$
begin
  if to_regclass('public.user_consents') is null then
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach', 'takibe')) not valid;
end $$;

commit;
