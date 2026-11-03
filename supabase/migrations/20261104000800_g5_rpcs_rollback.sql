-- ROLLBACK — 20261104000800_g5_rpcs
-- Tüm G5-S2 RPC'lerini düşürür. UYGULANMADI (yalnız dosya).
begin;
drop function if exists public.claim_handle(text);
drop function if exists public.update_public_profile(text, text, text);
drop function if exists public.get_public_profile(text);
drop function if exists public.share_meal_to_day(uuid);
drop function if exists public.get_day_rings();
drop function if exists public.get_day_cards(uuid);
drop function if exists public.reserve_ai_scan(text);
drop function if exists public.release_ai_scan(text);
drop function if exists public.check_delivery_city(text);
commit;
