-- ROLLBACK — 20261103020100_feed_rpcs.sql
-- NOT: staging'de test EDİLMEDİ. Uygulanmaz; yalnız dosya olarak tutulur.
drop function if exists public.respond_follow_request(uuid, bool);
drop function if exists public.follow(uuid, bool);
drop function if exists public.block_user(uuid, bool);
drop function if exists public.report_content(text, uuid, text);
drop function if exists public.add_post_meal_to_day(uuid, text, numeric, text);
drop function if exists public.react_post(uuid, text, bool);
drop function if exists public.get_feed(text, text, text, int);
