-- G60-S1 ilke 5 — post_stats İLK DOLDURMA (mevcut tablolardan).
-- version: 20261117230200  name: g60_post_stats_backfill
--
-- DURUM: YALNIZ DOSYA. Canlıya uygulanmadı. Önkoşul: 20261117230100_g60_post_stats.sql.
-- Geri alma: supabase/rollbacks/20261117230200_g60_post_stats_backfill_rollback.sql (satırları boşaltır).
-- İdempotent: tekrar çalıştırmak sayaçları kaynaktan yeniden yazar (artı/eksi yok).
-- Hacim (17 Kas): 13 yayında gönderi → anlık. Tüm durumlar doldurulur (pending/hidden dâhil;
-- sıralama zaten yalnız published + kendi pending okur).
begin;

insert into public.post_stats as s (post_id, likes, saves, adds, comments, reports, updated_at)
select
  p.id,
  coalesce(r.likes, 0),
  coalesce(r.saves, 0),
  coalesce(a.adds, 0),
  coalesce(c.comments, 0),
  coalesce(cr.reports, 0),
  now()
from public.posts p
left join (
  select post_id,
         count(*) filter (where kind = 'like')::int as likes,
         count(*) filter (where kind = 'save')::int as saves
  from public.post_reactions group by post_id
) r on r.post_id = p.id
left join (select post_id, count(*)::int as adds from public.post_meal_adds group by post_id) a on a.post_id = p.id
left join (
  select post_id, count(*)::int as comments from public.post_comments where status = 'published' group by post_id
) c on c.post_id = p.id
left join (
  select target_id, count(*)::int as reports from public.content_reports
  where target_type = 'post' and status in ('open', 'pending') group by target_id
) cr on cr.target_id = p.id
on conflict (post_id) do update
  set likes = excluded.likes,
      saves = excluded.saves,
      adds = excluded.adds,
      comments = excluded.comments,
      reports = excluded.reports,
      updated_at = excluded.updated_at;

commit;
