-- Geri alma: 20261104002000_g8_social.sql
-- NOT: Yalnız dosya; elle uygulanır. G8'de EKLENEN nesneleri düşürür ve EZİLEN
-- fonksiyonları (get_feed, mod_list_reports, mod_resolve_report) önceki sürümlerine
-- döndürmek için ilgili migration'lar yeniden koşulmalıdır:
--   · get_feed            → 20261104000300_feed_rpcs.sql
--   · mod_list_reports    → 20261104001000_g6_fixes.sql
--   · mod_resolve_report  → 20261104001000_g6_fixes.sql
-- Kolon/tablo silmek geriye uyumluluğu bozar; bu dosya yalnız gerekli olduğunda
-- (ör. staging temizliği) çalıştırılmalıdır. Push cron'u ayrı rollback'tedir
-- (20261104002100_g8_moderation_cron_rollback.sql) — ÖNCE onu çalıştır.

begin;

-- ── Tetikleyiciler + fonksiyonları ──────────────────────────────────────────
drop trigger if exists trg_push_social_notification on public.social_notifications;
drop trigger if exists trg_social_notifications_guard on public.social_notifications;
drop trigger if exists trg_notify_did_it on public.activity_logs;
drop trigger if exists trg_notify_add_to_day on public.post_meal_adds;
drop trigger if exists trg_notify_follow_request on public.follow_requests;
drop trigger if exists trg_notify_follow on public.follows;
drop trigger if exists trg_notify_comment on public.post_comments;
drop trigger if exists trg_notify_reaction on public.post_reactions;

drop function if exists public.fn_push_social_notification();
drop function if exists public.social_notifications_guard();
drop function if exists public.fn_notify_did_it();
drop function if exists public.fn_notify_add_to_day();
drop function if exists public.fn_notify_follow_request();
drop function if exists public.fn_notify_follow();
drop function if exists public.fn_notify_comment();
drop function if exists public.fn_notify_reaction();
drop function if exists public.social_notify(uuid, uuid, text, uuid, uuid);

-- ── RPC'ler ───────────────────────────────────────────────────────────────────
drop function if exists public.admin_delete_draft_post(uuid);
drop function if exists public.admin_list_posts(uuid, text, text);
drop function if exists public.mark_social_notifications_read(timestamptz);
drop function if exists public.list_social_notifications(text, int);
drop function if exists public.get_my_day_activity(date);
drop function if exists public.log_activity(text, numeric, numeric, text, text);
drop function if exists public.did_it(uuid, numeric, text);
drop function if exists public.delete_my_comment(uuid);
drop function if exists public.list_comments(uuid, text, int);
drop function if exists public.add_comment(uuid, text, uuid, text);
drop function if exists public.delete_my_post(uuid);
drop function if exists public.create_post(text, text, text, jsonb, jsonb, jsonb, text);
drop function if exists public.activity_kcal(text, numeric, numeric);
drop function if exists public.feed_flag_enabled(text);
-- get_feed / mod_list_reports / mod_resolve_report: yukarıdaki NOT'a göre önceki
-- migration'lar yeniden koşularak geri getirilir (burada düşürülmez).

-- ── Storage politikaları (G5 'creators' sürümüne elle geri dönmek için
--    20261104000400_post_media_storage.sql yeniden koşulmalı) ─────────────────
drop policy if exists post_media_writer_delete on storage.objects;
drop policy if exists post_media_writer_update on storage.objects;
drop policy if exists post_media_writer_insert on storage.objects;

-- ── Tablolar ──────────────────────────────────────────────────────────────────
drop table if exists public.moderation_queue;
drop table if exists public.social_notifications;
drop table if exists public.post_comments;
drop table if exists public.activity_logs;

-- ── Kolon/CHECK geri alma (geriye uyumlu; veri varsa dikkat) ───────────────────
alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card'));

drop index if exists public.content_reports_ai_target_idx;
alter table public.content_reports drop constraint if exists content_reports_source_check;
alter table public.content_reports drop column if exists source;
-- reporter_id NOT NULL'a geri dönmeden önce AI (null reporter) satırlar silinmeli:
delete from public.content_reports where reporter_id is null;
alter table public.content_reports alter column reporter_id set not null;
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card'));

alter table public.post_media drop constraint if exists post_media_kind_check;
alter table public.post_media drop column if exists frame_paths;
alter table public.post_media drop column if exists thumb_path;
alter table public.post_media drop column if exists duration_s;
alter table public.post_media drop column if exists kind;

drop index if exists public.posts_author_status_idx;
drop index if exists public.posts_author_idem_idx;
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add  constraint posts_status_check
  check (status in ('published', 'hidden', 'removed'));
alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts drop column if exists idempotency_key;
alter table public.posts drop column if exists activity_card;
alter table public.posts drop column if exists post_type;

-- Bayrak tohumları (yalnız G8'de eklenenler).
delete from public.feature_flags
 where key in ('kesfet_paylasim', 'kesfet_video', 'kesfet_yorum', 'etkinlik', 'sosyal_bildirim');

commit;
