-- Geri alma: 20261117230300_g60_get_feed_ranked.sql
-- HIZLI GERİ ALMA bu dosya DEĞİL: `kesfet_siralama` bayrağını kapatmak yeter (istemci get_feed'e döner,
-- sunucu da kapalı bayrakta get_feed_ranked'i reddeder). Bu dosya fonksiyonları ve bayrağı tamamen kaldırır.
-- get_feed'e hiç dokunulmadığı için eski akış etkilenmez. Eklenen indeksler zararsızdır; yine de kaldırılır.
begin;
drop function if exists public.get_feed_ranked(text, text, int);
drop function if exists public.kesfet_rank_score(double precision, integer, integer, integer, integer, boolean, boolean, boolean, boolean, integer);
drop function if exists public.kesfet_rank_config();
drop index if exists public.post_reactions_created_idx;
drop index if exists public.post_meal_adds_created_idx;
drop index if exists public.post_meal_adds_user_idx;
drop index if exists public.post_comments_created_idx;
drop index if exists public.posts_rank_window_idx;
delete from public.feature_flags where key = 'kesfet_siralama';
commit;
