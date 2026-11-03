-- Geri alma: 20261104001100_g7_fixes.sql
-- NOT: Bu dosya yalnız dosya; elle uygulanır. Yeni fonksiyonları düşürür, ezilen
-- fonksiyonları bir önceki sürümlerine (g5_rpcs / g6_fixes / son profiles_guard)
-- geri getirmek için o migration'lar yeniden koşulmalıdır — burada yalnız G7'de
-- EKLENEN nesneler ve değişen CHECK'ler geri alınır.

begin;

-- 6) Panel fonksiyonları — düşür.
drop function if exists public.admin_list_creators();
drop function if exists public.admin_create_post(uuid, text, text, jsonb, jsonb, timestamptz);
drop function if exists public.admin_set_creator(uuid, text, boolean, boolean);

-- 5) get_post — düşür.
drop function if exists public.get_post(uuid);

-- 4) add_day_card_to_day — düşür.
drop function if exists public.add_day_card_to_day(uuid, text, numeric, text);

-- 2) creators.role — 'uretici'siz önceki CHECK'e döndür.
--    (Önce 'uretici' rolünde satır varsa bu ADD patlar; önce onları düzelt.)
alter table public.creators
  drop constraint if exists creators_role_check;
alter table public.creators
  add constraint creators_role_check
    check (role in ('kurum', 'diyetisyen', 'pt', 'moderator'));

-- 1) meal_consumptions_source_check — G7'de eklenen CHECK'i düşür.
--    (Önceki CHECK'in tam tanımı dosyada yoktu; eski sürümü geri getirmek için
--    ilgili önceki migration/elle tanım uygulanmalı. Burada yalnız G7 CHECK'i kalkar.)
alter table public.meal_consumptions
  drop constraint if exists meal_consumptions_source_check;

-- 3/7) get_day_cards, profiles_guard_protected_cols, claim_handle,
--      set_profile_privacy: G7 bu fonksiyonları EZDİ. Önceki gövdeleri geri
--      getirmek için 20261104000800_g5_rpcs.sql (get_day_cards, claim_handle),
--      20261104001000_g6_fixes.sql (set_profile_privacy) ve
--      20260922174201_macro_engine_bypass_for_profiles_guard.sql
--      (profiles_guard_protected_cols) yeniden koşulmalıdır.

commit;
