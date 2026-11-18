-- G62-S1 rollback — 20261118120100_g62_order_rating.sql'i geri alır (YALNIZ DOSYA, canlıya uygulanmadı).
-- VERİ KORUNUR: v2 sütunları (reviews.delivery/calorie_fit/taste/photo_path/version/moderation_id,
-- review_item_feedback.tags) BİLEREK silinmez — v1 okuyucuları onları görmez, rating zaten dolu.
-- Tam temizlik gerekirse en alttaki yorumlu bloğu ayrıca çalıştırın (v2 alt puanları kaybolur).
begin;

delete from public.feature_flags where key in ('siparis_degerlendirme');

drop function if exists public.submit_order_rating(bigint, integer, integer, integer, text, text, jsonb);

-- restaurant_rating → G22-S1 gövdesi (alt boyutlar NULL).
create or replace function public.restaurant_rating(p_branch_id uuid default null)
returns table (
  branch_id    uuid,
  average      numeric,
  review_count integer,
  is_new       boolean,
  taste        numeric,
  delivery     numeric,
  calorie_fit  numeric,
  since        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select rv.rating
      from public.reviews rv
      join public.orders o on o.id = rv.order_id
     where rv.created_at >= now() - interval '90 days'
       and rv.rating between 1 and 5
       and (p_branch_id is null or o.branch_id = p_branch_id)
  )
  select
    p_branch_id,
    case when count(*) = 0 then null else round(avg(r.rating)::numeric, 2) end,
    count(*)::int,
    count(*) < 10,
    null::numeric,
    null::numeric,
    null::numeric,
    now() - interval '90 days'
  from r;
$$;
revoke all on function public.restaurant_rating(uuid) from public;
grant execute on function public.restaurant_rating(uuid) to anon, authenticated;

-- Moderasyon hedefleri → G59 listesi ('review' satırları önce silinir).
delete from public.moderation_queue   where target_type = 'review';
delete from public.content_reports    where target_type = 'review';
delete from public.moderation_actions where target_type = 'review';

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story'));
alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story'));
alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment', 'story'));

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('order_rate_prompt', 'order_rate_submit');
  end if;
end $$;

commit;

-- ── İSTEĞE BAĞLI tam temizlik (v2 verisi silinir) ─────────────────────────────
-- begin;
-- alter table public.review_item_feedback drop constraint if exists review_item_feedback_tags_check;
-- alter table public.review_item_feedback drop column if exists tags;
-- drop index if exists public.reviews_moderation_id_key;
-- drop index if exists public.reviews_order_id_idx;
-- alter table public.reviews drop constraint if exists reviews_v2_dims_check;
-- alter table public.reviews drop constraint if exists reviews_photo_path_check;
-- alter table public.reviews drop column if exists moderation_id, drop column if exists version,
--   drop column if exists photo_path, drop column if exists taste,
--   drop column if exists calorie_fit, drop column if exists delivery;
-- commit;
