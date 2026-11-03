-- ROLLBACK — 20261103020000_feed_tables.sql
-- NOT: staging'de test EDİLMEDİ. Uygulanmaz; yalnız dosya olarak tutulur.
-- Bağımlılık sırasına göre düşürülür. profiles'a eklenen sosyal kolonlar GERİ
-- ALINMAZ (geriye uyumlu + S2 de aynı kolonları kullanıyor olabilir — veri kaybı riski).
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.feed_can_view_author(uuid, uuid);
drop function if exists public.feed_is_moderator(uuid);
drop function if exists public.feed_can_post(uuid);
drop function if exists public.feed_is_blocked(uuid, uuid);

drop table if exists public.post_meal_adds;
drop table if exists public.content_reports;
drop table if exists public.user_blocks;
drop table if exists public.follow_requests;
drop table if exists public.follows;
drop table if exists public.post_reactions;
drop table if exists public.post_media;
drop table if exists public.posts;
drop table if exists public.creators;

-- profiles.is_private / handle / bio: BİLEREK bırakılır (geri alınmaz).
