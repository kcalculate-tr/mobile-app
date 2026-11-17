-- Geri alma: 20261117230100_g60_post_stats.sql
-- ÖNCE 20261117230300_g60_get_feed_ranked geri alınmalı (get_feed_ranked post_stats okur).
-- Tetikleyiciler + yardımcılar + tablo kaldırılır. Kaynak tablolara (reactions, adds, comments,
-- content_reports) dokunulmaz; get_feed hiç değişmediği için eski akış aynen çalışır.
begin;
drop trigger if exists post_stats_reactions on public.post_reactions;
drop trigger if exists post_stats_meal_adds on public.post_meal_adds;
drop trigger if exists post_stats_comments on public.post_comments;
drop trigger if exists post_stats_reports on public.content_reports;
drop function if exists public.post_stats_trg();
drop function if exists public.post_stats_refresh(uuid);
drop table if exists public.post_stats;
commit;
