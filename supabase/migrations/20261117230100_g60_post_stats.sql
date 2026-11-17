-- G60-S1 md.1/ilke 5 — Keşfet sıralaması v2: gönderi sayaç tablosu `post_stats` + tetikleyiciler.
-- version: 20261117230100  name: g60_post_stats
--
-- DURUM: YALNIZ DOSYA. Canlıya uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261117230100_g60_post_stats_rollback.sql
-- CANLIYA SIRA: (1) bu dosya → (2) 20261117230200_g60_post_stats_backfill.sql →
--   (3) 20261117230300_g60_get_feed_ranked.sql → (4) 230400 post_views → (5) 230500 top_cities.
--
-- Neden: get_feed her satırda 4 alt sorgu ile sayar (likes, saves, adds, comments). Sıralama
-- fonksiyonu ≤ 500 adayı puanlarken bu sayaçları tek tablodan okur.
--
-- RİSK ÖNLEME ("sistemi bozmasın"):
--   • Tetikleyici gövdesi hata yutar (`exception when others` → uyarı). Sayaç güncellenemese bile
--     beğeni / kaydet / yorum / günlüğe ekleme / şikayet YAZMASI ASLA başarısız olmaz.
--   • Sayım = kaynaktan YENİDEN SAYMA (artı/eksi değil) → yarış ve kayma yok, kendini onarır.
--   • get_feed'e DOKUNULMAZ (eski sürümler aynen çalışır).
--   • İstemci tabloyu okumaz/yazmaz (RLS açık, politika yok); yalnız security definer fonksiyonlar.
--
-- Sayaç tanımları (get_feed ile aynı):
--   likes    = post_reactions kind='like'
--   saves    = post_reactions kind='save'
--   adds     = post_meal_adds (günlüğe ekleme — Instagram'daki "gönderme" karşılığı)
--   comments = post_comments status='published'
--   reports  = content_reports target_type='post' AND status in ('open','pending') (çözülmemiş)
-- İdempotent: tekrar çalıştırmak güvenli.
begin;

create table if not exists public.post_stats (
  post_id    uuid        primary key references public.posts (id) on delete cascade,
  likes      integer     not null default 0 check (likes >= 0),
  saves      integer     not null default 0 check (saves >= 0),
  adds       integer     not null default 0 check (adds >= 0),
  comments   integer     not null default 0 check (comments >= 0),
  reports    integer     not null default 0 check (reports >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.post_stats is
  'G60-S1: Keşfet sıralaması sayaçları (yeniden sayma tetikleyicileri). İstemci erişimi yok; get_feed_ranked okur.';

alter table public.post_stats enable row level security;
-- Politika YOK: anon/authenticated doğrudan okuyamaz/yazamaz.
revoke all on table public.post_stats from anon, authenticated;

-- Tek gönderinin sayaçlarını kaynaktan yeniden say + upsert. Gönderi yoksa (silinmiş) hiçbir şey yapmaz.
create or replace function public.post_stats_refresh(p_post uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_post is null then return; end if;
  if not exists (select 1 from public.posts p where p.id = p_post) then return; end if;
  insert into public.post_stats as s (post_id, likes, saves, adds, comments, reports, updated_at)
  select
    p_post,
    (select count(*) from public.post_reactions r where r.post_id = p_post and r.kind = 'like')::int,
    (select count(*) from public.post_reactions r where r.post_id = p_post and r.kind = 'save')::int,
    (select count(*) from public.post_meal_adds a where a.post_id = p_post)::int,
    (select count(*) from public.post_comments c where c.post_id = p_post and c.status = 'published')::int,
    (select count(*) from public.content_reports cr
      where cr.target_type = 'post' and cr.target_id = p_post and cr.status in ('open', 'pending'))::int,
    now()
  on conflict (post_id) do update
    set likes = excluded.likes,
        saves = excluded.saves,
        adds = excluded.adds,
        comments = excluded.comments,
        reports = excluded.reports,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.post_stats_refresh(uuid) from public, anon, authenticated;

-- Ortak tetikleyici: NEW/OLD'dan gönderi kimliğini bulur, yeniden sayar. Hata yutulur.
create or replace function public.post_stats_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
  v_old uuid;
begin
  begin
    if tg_table_name = 'content_reports' then
      if tg_op in ('INSERT', 'UPDATE') and new.target_type = 'post' then v_new := new.target_id; end if;
      if tg_op in ('UPDATE', 'DELETE') and old.target_type = 'post' then v_old := old.target_id; end if;
    else
      if tg_op in ('INSERT', 'UPDATE') then v_new := new.post_id; end if;
      if tg_op in ('UPDATE', 'DELETE') then v_old := old.post_id; end if;
    end if;
    if v_new is not null then perform public.post_stats_refresh(v_new); end if;
    if v_old is not null and v_old is distinct from v_new then perform public.post_stats_refresh(v_old); end if;
  exception when others then
    -- Sayaç asla asıl yazmayı bozmaz; doldurma migration'ı / sonraki olay onarır.
    raise warning 'post_stats_trg(%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.post_stats_trg() from public, anon, authenticated;

drop trigger if exists post_stats_reactions on public.post_reactions;
create trigger post_stats_reactions
  after insert or delete or update on public.post_reactions
  for each row execute function public.post_stats_trg();

drop trigger if exists post_stats_meal_adds on public.post_meal_adds;
create trigger post_stats_meal_adds
  after insert or delete or update on public.post_meal_adds
  for each row execute function public.post_stats_trg();

drop trigger if exists post_stats_comments on public.post_comments;
create trigger post_stats_comments
  after insert or delete or update of status, post_id on public.post_comments
  for each row execute function public.post_stats_trg();

drop trigger if exists post_stats_reports on public.content_reports;
create trigger post_stats_reports
  after insert or delete or update of status, target_type, target_id on public.content_reports
  for each row execute function public.post_stats_trg();

commit;
