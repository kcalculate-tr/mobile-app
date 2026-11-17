-- G59-S1 — Hikâye (müziksiz): katmanlı hikâye + görüntülenme + tepki + anket + öne çıkanlar.
-- version: 20261117220100  name: g59_hikaye
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261117220100_g59_hikaye_rollback.sql
--
-- Önkoşul: G5–G11 Keşfet katmanı (posts, follows, user_blocks, creators, content_reports,
-- moderation_queue, feed_can_view_author, feed_flag_enabled, content_report_risk), G10
-- report_content / mod_resolve_report gövdeleri, G21 meal_consumptions_source_check (dinamik).
--
-- TASARIM KARARI — "görüntü yakalama YOK": hikâye = taban medya (foto ya da ≤ 60 sn video;
-- yazılı hikâyede düz/degrade zemin `bg`) + `overlays jsonb` (yazı, çizim yolları, çıkartmalar:
-- tür, veri, x/y oranı, ölçek, açı, z sırası). Görüntüleyici katmanları cihazda çizer → yeni
-- native paket gerekmez. İstemci serileştirmesi: src/modules/hikaye/overlays.ts (tek kaynak).
--
-- KAPSAM DIŞI (İlter kararı, 17 Kas): müzik çıkartması, anonim, `challenge` (özellik gelene
-- kadar), `question` + serbest metinli yanıt (DM gelene kadar). Sunucu bu türleri REDDEDER.
--
-- İçindekiler:
--   1) Bayrak `hikaye` (KAPALI)
--   2) Tablolar: stories, story_views, story_reactions, story_poll_votes, story_sticker_events,
--      story_highlights, story_highlight_items
--   3) Yardımcılar: story_overlays_valid, story_has_text, story_is_official, story_can_view
--   4) RLS
--   5) RPC'ler: create_story, delete_my_story, get_story_tray, get_user_stories, get_story_ring,
--      get_highlight_stories, mark_story_viewed, react_story, vote_story_poll, story_sticker_tap,
--      add_story_meal_to_day, get_story_viewers, get_my_story_archive, get_user_highlights,
--      upsert_story_highlight, delete_story_highlight
--   6) meal_consumptions.source += 'story'
--   7) Moderasyon: content_reports / moderation_actions / moderation_queue hedef türü += 'story';
--      report_content + mod_resolve_report (G10 gövdeleri + 'story' dalı)
--   8) Depolama: post-media `stories/{uid}/…` yazma/silme (bayrak açıkken)
--   9) EXECUTE yetkileri
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1) Bayrak — KAPALI. Video hikâye ayrıca `kesfet_video` açıkken (RPC denetler). ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'hikaye', false, 0, '1.1.0',
  'G59-S1: Hikâye (24 sa; katmanlı: medya + yazı/çizim/çıkartma). Müzik yok. Video hikâye ayrıca kesfet_video ister. Native yok → OTA.'
)
on conflict (key) do nothing;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2) Tablolar                                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.stories (
  id              uuid        primary key default gen_random_uuid(),
  author_id       uuid        not null references auth.users(id) on delete cascade,
  -- Taban medya: post-media içi YOL (`stories/{uid}/…`). Yazılı hikâyede null.
  media_url       text,
  media_type      text        not null default 'image' check (media_type in ('image', 'video', 'none')),
  thumb_url       text,                                   -- video kapağı (ilk kare)
  duration_s      numeric     check (duration_s is null or (duration_s > 0 and duration_s <= 60)),
  width           int         check (width is null or width > 0),
  height          int         check (height is null or height > 0),
  overlays        jsonb       not null default '[]'::jsonb,
  -- Yazılı hikâye zemini: {"kind":"solid"|"gradient","colors":["#RRGGBB",…]}.
  bg              jsonb,
  status          text        not null default 'published' check (status in ('pending', 'published', 'removed')),
  idempotency_key text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  deleted_at      timestamptz,
  constraint stories_media_chk check (
    (media_type = 'none' and media_url is null and bg is not null)
    or (media_type in ('image', 'video') and media_url is not null)
  ),
  constraint stories_video_chk check (media_type <> 'video' or duration_s is not null),
  constraint stories_overlays_array check (jsonb_typeof(overlays) = 'array'),
  constraint stories_overlays_size check (octet_length(overlays::text) <= 65536)
);
create index if not exists stories_author_active_idx on public.stories (author_id, expires_at desc) where deleted_at is null;
create index if not exists stories_active_idx on public.stories (expires_at) where deleted_at is null and status = 'published';
create unique index if not exists stories_author_idem_idx on public.stories (author_id, idempotency_key) where idempotency_key is not null;

create table if not exists public.story_views (
  story_id  uuid        not null references public.stories(id) on delete cascade,
  viewer_id uuid        not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index if not exists story_views_viewer_idx on public.story_views (viewer_id, viewed_at desc);

-- Hızlı tepkiler (DM gelene kadar serbest metin YOK): kalp + tasarımdaki 5 hazır tepki.
create table if not exists public.story_reactions (
  story_id   uuid        not null references public.stories(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('like', 'congrats', 'enjoy', 'recipe', 'great', 'join')),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id, kind)
);
create index if not exists story_reactions_story_idx on public.story_reactions (story_id, created_at desc);

create table if not exists public.story_poll_votes (
  story_id   uuid        not null references public.stories(id) on delete cascade,
  sticker_id text        not null check (char_length(sticker_id) between 1 and 40),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  option     smallint    not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (story_id, sticker_id, user_id)
);

-- Çıkartma etkileşimleri (Görenler › "Çıkartma etkileşimleri"): dokunma + günlüğe ekleme.
create table if not exists public.story_sticker_events (
  story_id   uuid        not null references public.stories(id) on delete cascade,
  sticker_id text        not null check (char_length(sticker_id) between 1 and 40),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  action     text        not null check (action in ('tap', 'add_log')),
  created_at timestamptz not null default now(),
  primary key (story_id, sticker_id, user_id, action)
);

create table if not exists public.story_highlights (
  id             uuid        primary key default gen_random_uuid(),
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  title          text        not null check (char_length(btrim(title)) between 1 and 16),
  cover_story_id uuid        references public.stories(id) on delete set null,
  sort           int         not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists story_highlights_owner_idx on public.story_highlights (owner_id, sort, created_at);

create table if not exists public.story_highlight_items (
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  story_id     uuid not null references public.stories(id) on delete cascade,
  sort         int  not null default 0,
  primary key (highlight_id, story_id)
);
create index if not exists story_highlight_items_story_idx on public.story_highlight_items (story_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3) Yardımcılar                                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Katman doğrulama (istemci overlays.ts ile aynı kurallar): dizi, ≤ 40 öğe, izinli türler,
-- x/y 0..1, ölçek 0.2..4, anket 2–4 seçenek (≤ 24 karakter), metinler ≤ 200 karakter.
create or replace function public.story_overlays_valid(p jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  e    jsonb;
  k    text;
  n    int;
  opts jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return false; end if;
  if jsonb_array_length(p) > 40 then return false; end if;
  for e in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    k := e->>'kind';
    if k is null or k not in ('text', 'draw', 'meal', 'ring', 'streak', 'water', 'steps', 'recipe',
                              'poll', 'location', 'mention', 'hashtag', 'time') then
      return false; -- music / question / challenge / bilinmeyen → ret
    end if;
    if coalesce(char_length(e->>'id'), 0) not between 1 and 40 then return false; end if;
    if jsonb_typeof(e->'x') <> 'number' or jsonb_typeof(e->'y') <> 'number' then return false; end if;
    if (e->>'x')::numeric not between 0 and 1 or (e->>'y')::numeric not between 0 and 1 then return false; end if;
    if e ? 'scale' and (jsonb_typeof(e->'scale') <> 'number' or (e->>'scale')::numeric not between 0.2 and 4) then
      return false;
    end if;
    if k = 'text' and coalesce(char_length(e->'data'->>'text'), 0) not between 1 and 200 then return false; end if;
    if k in ('location', 'mention', 'hashtag') and coalesce(char_length(e->'data'->>'text'), 0) not between 1 and 60 then
      return false;
    end if;
    if k = 'poll' then
      if coalesce(char_length(e->'data'->>'question'), 0) not between 1 and 80 then return false; end if;
      opts := e->'data'->'options';
      if opts is null or jsonb_typeof(opts) <> 'array' then return false; end if;
      n := jsonb_array_length(opts);
      if n < 2 or n > 4 then return false; end if;
      if exists (select 1 from jsonb_array_elements_text(opts) o where char_length(btrim(o)) not between 1 and 24) then
        return false;
      end if;
    end if;
    if k = 'meal' and coalesce(char_length(e->'data'->>'name'), 0) not between 1 and 120 then return false; end if;
  end loop;
  return true;
end;
$$;

-- Denetlenecek metin var mı? (yazı / konum / bahset / etiket / anket) → hikâye 'pending' başlar.
create or replace function public.story_has_text(p jsonb)
returns boolean language sql immutable set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e
     where e->>'kind' in ('text', 'location', 'mention', 'hashtag', 'poll')
  );
$$;

-- "Herkese açık resmi hesap": doğrulanmış kurum (creators.role='kurum') ve gizli değil.
create or replace function public.story_is_official(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.creators c
      join public.profiles p on p.id = c.user_id
     where c.user_id = p_user and c.role = 'kurum' and c.verified_at is not null
       and not coalesce(p.is_private, false)
  );
$$;

-- Görme kuralı (tek yer): silinmemiş; yayımlanmış (sahibi pending'i de görür); yazar görülebilir
-- (feed_can_view_author = engel yok + gizli hesapta yalnız onaylı takipçi); 24 saat dolduysa yalnız
-- sahibi (arşiv) ya da hikâye bir öne çıkanda ise yazarı görebilen herkes.
create or replace function public.story_can_view(p_viewer uuid, p_story uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stories s
     where s.id = p_story
       and s.deleted_at is null
       and (
         s.author_id = p_viewer
         or (
           s.status = 'published'
           and p_viewer is not null
           and public.feed_can_view_author(p_viewer, s.author_id)
           and (
             s.expires_at > now()
             or exists (select 1 from public.story_highlight_items hi where hi.story_id = s.id)
           )
         )
       )
  );
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4) RLS — yazma yalnız RPC'lerden (SECURITY DEFINER); doğrudan yazma politikası YOK. ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.stories               enable row level security;
alter table public.story_views           enable row level security;
alter table public.story_reactions       enable row level security;
alter table public.story_poll_votes      enable row level security;
alter table public.story_sticker_events  enable row level security;
alter table public.story_highlights      enable row level security;
alter table public.story_highlight_items enable row level security;

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
  for select to authenticated
  using (public.story_can_view(auth.uid(), id) or public.feed_is_moderator(auth.uid()));

-- Görüntülenme / tepki / oy / etkileşim: kendi satırın + hikâyenin sahibi okur.
drop policy if exists story_views_select on public.story_views;
create policy story_views_select on public.story_views
  for select to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

drop policy if exists story_reactions_select on public.story_reactions;
create policy story_reactions_select on public.story_reactions
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

drop policy if exists story_poll_votes_select on public.story_poll_votes;
create policy story_poll_votes_select on public.story_poll_votes
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

drop policy if exists story_sticker_events_select on public.story_sticker_events;
create policy story_sticker_events_select on public.story_sticker_events
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));

drop policy if exists story_highlights_select on public.story_highlights;
create policy story_highlights_select on public.story_highlights
  for select to authenticated
  using (owner_id = auth.uid() or public.feed_can_view_author(auth.uid(), owner_id));

drop policy if exists story_highlight_items_select on public.story_highlight_items;
create policy story_highlight_items_select on public.story_highlight_items
  for select to authenticated
  using (exists (select 1 from public.story_highlights h
                  where h.id = highlight_id
                    and (h.owner_id = auth.uid() or public.feed_can_view_author(auth.uid(), h.owner_id))));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5) RPC'ler                                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ortak satır biçimi (istemci src/modules/hikaye/client.ts `normalizeStory`).
create or replace function public.story_json(s public.stories, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id,
    'author_id', s.author_id,
    'media_url', s.media_url,
    'media_type', s.media_type,
    'thumb_url', s.thumb_url,
    'duration_s', s.duration_s,
    'width', s.width,
    'height', s.height,
    'overlays', s.overlays,
    'bg', s.bg,
    'status', s.status,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'seen', (s.author_id = p_viewer) or exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = p_viewer),
    'my_reactions', coalesce((select jsonb_agg(r.kind order by r.created_at) from public.story_reactions r
                               where r.story_id = s.id and r.user_id = p_viewer), '[]'::jsonb),
    'my_votes', coalesce((select jsonb_object_agg(v.sticker_id, v.option) from public.story_poll_votes v
                           where v.story_id = s.id and v.user_id = p_viewer), '{}'::jsonb),
    -- Anket sonuçları: yalnız sahibi ve oy veren görür (oy vermeden sonuç yok).
    'poll_results', coalesce((
      select jsonb_object_agg(x.sticker_id, x.counts) from (
        select pv.sticker_id, jsonb_agg(pv.cnt order by pv.option) as counts
          from (
            select o.sticker_id, o.option, count(v.user_id) as cnt
              from (select e->>'id' as sticker_id, gs.i as option
                      from jsonb_array_elements(s.overlays) e
                      cross join lateral generate_series(0, jsonb_array_length(coalesce(e->'data'->'options', '[]'::jsonb)) - 1) gs(i)
                     where e->>'kind' = 'poll') o
              left join public.story_poll_votes v
                on v.story_id = s.id and v.sticker_id = o.sticker_id and v.option = o.option
             group by o.sticker_id, o.option
          ) pv
         where s.author_id = p_viewer
            or exists (select 1 from public.story_poll_votes mv
                        where mv.story_id = s.id and mv.sticker_id = pv.sticker_id and mv.user_id = p_viewer)
         group by pv.sticker_id
      ) x), '{}'::jsonb),
    'view_count', case when s.author_id = p_viewer
                       then (select count(*) from public.story_views v where v.story_id = s.id) else null end
  );
$$;

-- create_story — bayrak + medya yolu + katman doğrulama + günlük sınır (30). Metin katmanı varsa
-- 'pending' başlar ve moderation_queue'ya düşer (istemci ardından moderate-content çağırır;
-- pg_cron yeniden dener). Metin yoksa doğrudan 'published'.
create or replace function public.create_story(
  p_media_url       text,
  p_media_type      text,
  p_thumb_url       text    default null,
  p_duration_s      numeric default null,
  p_width           int     default null,
  p_height          int     default null,
  p_overlays        jsonb   default '[]'::jsonb,
  p_bg              jsonb   default null,
  p_idempotency_key text    default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_status text;
  v_cnt    int;
  v_prefix text;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('hikaye') then raise exception 'kapali' using errcode = '42501'; end if;
  if p_media_type not in ('image', 'video', 'none') then raise exception 'gecersiz_medya'; end if;
  if p_media_type = 'video' and not public.feed_flag_enabled('kesfet_video') then
    raise exception 'video_kapali' using errcode = '42501';
  end if;
  v_prefix := 'stories/' || v_uid::text || '/';
  if p_media_type <> 'none' then
    if p_media_url is null or left(p_media_url, length(v_prefix)) <> v_prefix or p_media_url like '%..%' then
      raise exception 'gecersiz_yol';
    end if;
    if p_thumb_url is not null and (left(p_thumb_url, length(v_prefix)) <> v_prefix or p_thumb_url like '%..%') then
      raise exception 'gecersiz_yol';
    end if;
  elsif p_bg is null or jsonb_typeof(p_bg) <> 'object' then
    raise exception 'zemin_zorunlu';
  end if;
  if p_media_type = 'video' and (p_duration_s is null or p_duration_s <= 0 or p_duration_s > 60) then
    raise exception 'video_suresi';
  end if;
  if not public.story_overlays_valid(coalesce(p_overlays, '[]'::jsonb)) then raise exception 'gecersiz_katman'; end if;

  if p_idempotency_key is not null then
    select id, status into v_id, v_status from public.stories
     where author_id = v_uid and idempotency_key = p_idempotency_key;
    if v_id is not null then return jsonb_build_object('story_id', v_id, 'status', v_status); end if;
  end if;

  select count(*) into v_cnt from public.stories
   where author_id = v_uid and created_at > now() - interval '24 hours';
  if v_cnt >= 30 then return jsonb_build_object('error', 'rate_limited'); end if;

  v_status := case when public.story_has_text(p_overlays) then 'pending' else 'published' end;

  insert into public.stories (author_id, media_url, media_type, thumb_url, duration_s, width, height,
                              overlays, bg, status, idempotency_key)
  values (v_uid, case when p_media_type = 'none' then null else p_media_url end, p_media_type,
          case when p_media_type = 'video' then p_thumb_url else null end,
          case when p_media_type = 'video' then p_duration_s else null end,
          p_width, p_height, coalesce(p_overlays, '[]'::jsonb),
          case when p_media_type = 'none' then p_bg else null end, v_status, p_idempotency_key)
  returning id into v_id;

  if v_status = 'pending' then
    insert into public.moderation_queue (target_type, target_id) values ('story', v_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object('story_id', v_id, 'status', v_status);
end;
$$;

-- delete_my_story — yumuşak silme: tepside, arşivde ve öne çıkanlarda görünmez.
create or replace function public.delete_my_story(p_story uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.stories set deleted_at = now()
   where id = p_story and author_id = v_uid and deleted_at is null;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  delete from public.story_highlight_items where story_id = p_story;
  update public.story_highlights set cover_story_id = null where cover_story_id = p_story;
  return jsonb_build_object('ok', true);
end;
$$;

-- get_story_tray — kendi + takip edilenler + herkese açık resmi hesaplar; aktif (24 sa) ve
-- görülebilir hikâyesi olanlar. İlk satır daima "ben" (hikâyem yoksa story_count=0 → "Hikâyen +").
-- Sıra: ben, sonra görülmemişi olanlar, sonra en yeni hikâye.
create or replace function public.get_story_tray()
returns table (
  user_id      uuid,
  display_name text,
  handle       text,
  avatar_url   text,
  story_count  int,
  unseen_count int,
  latest_at    timestamptz,
  is_me        boolean,
  is_official  boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  authors as (
    select f.following_id as uid from public.follows f, me where f.follower_id = me.id
    union
    select c.user_id from public.creators c
     where c.role = 'kurum' and c.verified_at is not null
  ),
  active as (
    select s.author_id, s.id, s.created_at,
           exists (select 1 from public.story_views v, me where v.story_id = s.id and v.viewer_id = me.id) as seen
      from public.stories s, me
     where s.deleted_at is null and s.expires_at > now()
       and (
         s.author_id = me.id
         or (s.status = 'published'
             and s.author_id in (select uid from authors)
             and (public.story_is_official(s.author_id)
                  or exists (select 1 from public.follows f where f.follower_id = me.id and f.following_id = s.author_id))
             and public.feed_can_view_author(me.id, s.author_id))
       )
  ),
  agg as (
    select a.author_id, count(*)::int as story_count,
           count(*) filter (where not a.seen)::int as unseen_count,
           max(a.created_at) as latest_at
      from active a group by a.author_id
  )
  select p.id, p.full_name, p.handle, p.avatar_url,
         coalesce(g.story_count, 0), case when p.id = me.id then 0 else coalesce(g.unseen_count, 0) end,
         g.latest_at, p.id = me.id, public.story_is_official(p.id)
    from public.profiles p
    cross join me
    left join agg g on g.author_id = p.id
   where p.id = me.id or g.author_id is not null
   order by (p.id = me.id) desc, (coalesce(g.unseen_count, 0) > 0) desc, g.latest_at desc nulls last
   limit 100;
$$;

-- get_user_stories — kullanıcının AKTİF hikâyeleri (eskiden yeniye). Sahibi pending'i de görür.
create or replace function public.get_user_stories(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.story_json(s, auth.uid()) order by s.created_at), '[]'::jsonb)
    from public.stories s
   where s.author_id = p_user
     and s.deleted_at is null
     and s.expires_at > now()
     and public.story_can_view(auth.uid(), s.id);
$$;

-- get_story_ring — profil fotoğrafı halkası: aktif + görülmemiş sayısı (görülemiyorsa 0/0).
create or replace function public.get_story_ring(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'unseen', count(*) filter (where s.author_id <> auth.uid()
                                 and not exists (select 1 from public.story_views v
                                                  where v.story_id = s.id and v.viewer_id = auth.uid()))
  )
    from public.stories s
   where s.author_id = p_user and s.deleted_at is null and s.expires_at > now()
     and public.story_can_view(auth.uid(), s.id);
$$;

-- get_highlight_stories — öne çıkanın hikâyeleri (24 saati dolmuş olabilir), kaydedilen sırada.
create or replace function public.get_highlight_stories(p_highlight uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.story_json(s, auth.uid()) order by hi.sort, s.created_at), '[]'::jsonb)
    from public.story_highlight_items hi
    join public.story_highlights h on h.id = hi.highlight_id
    join public.stories s on s.id = hi.story_id
   where hi.highlight_id = p_highlight
     and s.deleted_at is null
     and (s.status = 'published' or s.author_id = auth.uid())
     and (h.owner_id = auth.uid() or public.feed_can_view_author(auth.uid(), h.owner_id));
$$;

-- mark_story_viewed — görüldü işareti (kendi hikâyen sayılmaz; tekrar = yok sayılır).
create or replace function public.mark_story_viewed(p_story uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_author uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.story_can_view(v_uid, p_story) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  select author_id into v_author from public.stories where id = p_story;
  if v_author = v_uid then return jsonb_build_object('ok', true, 'own', true); end if;
  insert into public.story_views (story_id, viewer_id) values (p_story, v_uid)
  on conflict (story_id, viewer_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- react_story — hızlı tepki aç/kapa (kendi hikâyene tepki yok). Tepki görüldü de sayılır.
create or replace function public.react_story(p_story uuid, p_kind text, p_on boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_author uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_kind not in ('like', 'congrats', 'enjoy', 'recipe', 'great', 'join') then raise exception 'gecersiz_tepki'; end if;
  if not public.story_can_view(v_uid, p_story) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  select author_id into v_author from public.stories where id = p_story;
  if v_author = v_uid then raise exception 'kendi_hikayen'; end if;
  if coalesce(p_on, true) then
    insert into public.story_reactions (story_id, user_id, kind) values (p_story, v_uid, p_kind)
    on conflict do nothing;
    insert into public.story_views (story_id, viewer_id) values (p_story, v_uid) on conflict do nothing;
  else
    delete from public.story_reactions where story_id = p_story and user_id = v_uid and kind = p_kind;
  end if;
  return jsonb_build_object('ok', true, 'on', coalesce(p_on, true));
end;
$$;

-- vote_story_poll — tek oy (değiştirilemez; Instagram davranışı). Dönüş: güncel sayımlar.
create or replace function public.vote_story_poll(p_story uuid, p_sticker text, p_option int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
  v_n      int;
  v_counts jsonb;
  v_mine   int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.story_can_view(v_uid, p_story) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  select s.author_id,
         (select jsonb_array_length(e->'data'->'options') from jsonb_array_elements(s.overlays) e
           where e->>'kind' = 'poll' and e->>'id' = p_sticker limit 1)
    into v_author, v_n
    from public.stories s where s.id = p_story;
  if v_n is null then raise exception 'anket_yok'; end if;
  if v_author = v_uid then raise exception 'kendi_hikayen'; end if;
  if p_option is null or p_option < 0 or p_option >= v_n then raise exception 'gecersiz_secenek'; end if;

  insert into public.story_poll_votes (story_id, sticker_id, user_id, option)
  values (p_story, p_sticker, v_uid, p_option)
  on conflict (story_id, sticker_id, user_id) do nothing;
  insert into public.story_views (story_id, viewer_id) values (p_story, v_uid) on conflict do nothing;

  select option into v_mine from public.story_poll_votes
   where story_id = p_story and sticker_id = p_sticker and user_id = v_uid;
  select jsonb_agg(coalesce(c.cnt, 0) order by gs.i) into v_counts
    from generate_series(0, v_n - 1) gs(i)
    left join (select option, count(*)::int as cnt from public.story_poll_votes
                where story_id = p_story and sticker_id = p_sticker group by option) c on c.option = gs.i;
  return jsonb_build_object('option', v_mine, 'counts', v_counts);
end;
$$;

-- story_sticker_tap — çıkartma dokunması (sahibine istatistik; kişi başı bir kez).
create or replace function public.story_sticker_tap(p_story uuid, p_sticker text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.story_can_view(v_uid, p_story) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  if not exists (select 1 from public.stories s, jsonb_array_elements(s.overlays) e
                  where s.id = p_story and e->>'id' = p_sticker) then
    raise exception 'cikartma_yok';
  end if;
  insert into public.story_sticker_events (story_id, sticker_id, user_id, action)
  values (p_story, p_sticker, v_uid, 'tap') on conflict do nothing;
end;
$$;

-- add_story_meal_to_day — öğün çıkartmasındaki değerlerle kendi günlüğüne ekle (source='story').
-- add_post_meal_to_day ile aynı desen: idempotency (source_ref), porsiyon ölçeği, sunucu öğün kodu.
create or replace function public.add_story_meal_to_day(
  p_story           uuid,
  p_sticker         text,
  p_meal_type       text,
  p_portion         numeric default 1,
  p_idempotency_key text    default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_d   jsonb;
  v_cid uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'idempotency_key_zorunlu'; end if;
  if coalesce(p_portion, 1) <= 0 or coalesce(p_portion, 1) > 10 then raise exception 'gecersiz_porsiyon'; end if;
  if p_meal_type not in ('kahvalti', 'ogle', 'aksam', 'atistirma') then raise exception 'gecersiz_ogun'; end if;
  if not public.story_can_view(v_uid, p_story) then raise exception 'bulunamadi' using errcode = '42501'; end if;

  select e->'data' into v_d
    from public.stories s, jsonb_array_elements(s.overlays) e
   where s.id = p_story and e->>'kind' = 'meal' and e->>'id' = p_sticker
   limit 1;
  if v_d is null then raise exception 'ogun_karti_yok'; end if;

  insert into public.meal_consumptions
    (user_id, source, source_ref, name, meal_type, calories, protein, carbs, fat, consumed_at)
  values
    (v_uid, 'story', p_idempotency_key, left(coalesce(v_d->>'name', 'Hikâye öğünü'), 120), p_meal_type,
     round(coalesce((v_d->>'kcal')::numeric, 0) * coalesce(p_portion, 1))::int,
     round((coalesce((v_d->>'protein_g')::numeric, 0) * coalesce(p_portion, 1))::numeric, 2),
     round((coalesce((v_d->>'carbs_g')::numeric, 0) * coalesce(p_portion, 1))::numeric, 2),
     round((coalesce((v_d->>'fat_g')::numeric, 0) * coalesce(p_portion, 1))::numeric, 2),
     now())
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_cid;

  if v_cid is null then
    select id into v_cid from public.meal_consumptions
     where user_id = v_uid and source = 'story' and source_ref = p_idempotency_key;
  else
    insert into public.story_sticker_events (story_id, sticker_id, user_id, action)
    values (p_story, p_sticker, v_uid, 'add_log') on conflict do nothing;
  end if;
  return jsonb_build_object('consumption_id', v_cid);
end;
$$;

-- get_story_viewers — YALNIZ SAHİBİ: görüntüleyenler (+ beğeni / son hazır tepki) ve çıkartma
-- etkileşimleri. p_filter 'reacted' → yalnız beğenen / tepki verenler.
create or replace function public.get_story_viewers(p_story uuid, p_filter text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s   public.stories%rowtype;
  v_rows jsonb;
  v_stk  jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  select * into v_s from public.stories where id = p_story and deleted_at is null;
  if not found or v_s.author_id <> v_uid then raise exception 'bulunamadi' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.viewed_at desc), '[]'::jsonb) into v_rows
    from (
      select v.viewer_id as user_id, p.full_name as display_name, p.handle, p.avatar_url, v.viewed_at,
             exists (select 1 from public.story_reactions r where r.story_id = v.story_id
                        and r.user_id = v.viewer_id and r.kind = 'like') as liked,
             (select r.kind from public.story_reactions r where r.story_id = v.story_id
                 and r.user_id = v.viewer_id and r.kind <> 'like' order by r.created_at desc limit 1) as reaction
        from public.story_views v
        join public.profiles p on p.id = v.viewer_id
       where v.story_id = p_story
         and not public.feed_is_blocked(v_uid, v.viewer_id)
    ) x
   where coalesce(p_filter, 'all') = 'all' or x.liked or x.reaction is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'sticker_id', e->>'id',
           'kind', e->>'kind',
           'taps', (select count(*) from public.story_sticker_events ev where ev.story_id = p_story
                     and ev.sticker_id = e->>'id' and ev.action = 'tap'),
           'adds', (select count(*) from public.story_sticker_events ev where ev.story_id = p_story
                     and ev.sticker_id = e->>'id' and ev.action = 'add_log'),
           'votes', (select count(*) from public.story_poll_votes pv where pv.story_id = p_story
                      and pv.sticker_id = e->>'id'),
           'label', coalesce(e->'data'->>'name', e->'data'->>'question', e->'data'->>'text')
         )), '[]'::jsonb) into v_stk
    from jsonb_array_elements(v_s.overlays) e
   where e->>'kind' in ('meal', 'poll', 'recipe', 'mention', 'location');

  return jsonb_build_object(
    'views', (select count(*) from public.story_views v where v.story_id = p_story),
    'expires_at', v_s.expires_at,
    'viewers', v_rows,
    'stickers', v_stk
  );
end;
$$;

-- get_my_story_archive — kendi hikâyelerin (24 saati dolanlar dahil, silinenler hariç), yeniden eskiye.
create or replace function public.get_my_story_archive(p_before timestamptz default null, p_limit int default 60)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.story_json(s, auth.uid()) order by s.created_at desc), '[]'::jsonb)
    from public.stories s
   where s.id in (
      select a.id from public.stories a
       where a.author_id = auth.uid() and a.deleted_at is null
         and (p_before is null or a.created_at < p_before)
       order by a.created_at desc
       limit least(greatest(coalesce(p_limit, 60), 1), 200)
   );
$$;

-- get_user_highlights — profil satırı: başlık, kapak (kapak yoksa ilk hikâye), öğe sayısı.
create or replace function public.get_user_highlights(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id,
           'title', h.title,
           'sort', h.sort,
           'cover_story_id', coalesce(h.cover_story_id, f.story_id),
           'cover', (select jsonb_build_object('media_url', s.media_url, 'media_type', s.media_type,
                                              'thumb_url', s.thumb_url, 'bg', s.bg)
                       from public.stories s where s.id = coalesce(h.cover_story_id, f.story_id)),
           'count', (select count(*) from public.story_highlight_items hi
                       join public.stories s on s.id = hi.story_id
                      where hi.highlight_id = h.id and s.deleted_at is null),
           'story_ids', (select coalesce(jsonb_agg(hi.story_id order by hi.sort), '[]'::jsonb)
                           from public.story_highlight_items hi
                           join public.stories s on s.id = hi.story_id
                          where hi.highlight_id = h.id and s.deleted_at is null)
         ) order by h.sort, h.created_at), '[]'::jsonb)
    from public.story_highlights h
    left join lateral (select hi.story_id from public.story_highlight_items hi
                        join public.stories s on s.id = hi.story_id and s.deleted_at is null
                       where hi.highlight_id = h.id order by hi.sort limit 1) f on true
   where h.owner_id = p_user
     and (h.owner_id = auth.uid() or public.feed_can_view_author(auth.uid(), h.owner_id))
     and (h.owner_id = auth.uid() or f.story_id is not null);
$$;

-- upsert_story_highlight — yeni (p_highlight null) ya da düzenle. Öğeler verilen sırayla değişir;
-- yalnız kendi, silinmemiş hikâyelerin. Kapak verilmezse ilk öğe. Sınır: 50 öne çıkan, 100 öğe.
create or replace function public.upsert_story_highlight(
  p_highlight   uuid,
  p_title       text,
  p_story_ids   uuid[],
  p_cover_story uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid := p_highlight;
  v_n   int  := coalesce(array_length(p_story_ids, 1), 0);
  v_ok  int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not public.feed_flag_enabled('hikaye') then raise exception 'kapali' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 16 then raise exception 'gecersiz_baslik'; end if;
  if v_n < 1 or v_n > 100 then raise exception 'gecersiz_oge'; end if;
  select count(distinct s.id) into v_ok from public.stories s
   where s.id = any(p_story_ids) and s.author_id = v_uid and s.deleted_at is null;
  if v_ok <> (select count(distinct x) from unnest(p_story_ids) x) then raise exception 'gecersiz_oge'; end if;
  if p_cover_story is not null and not (p_cover_story = any(p_story_ids)) then raise exception 'gecersiz_kapak'; end if;

  if v_id is null then
    if (select count(*) from public.story_highlights where owner_id = v_uid) >= 50 then
      raise exception 'cok_fazla';
    end if;
    insert into public.story_highlights (owner_id, title, cover_story_id, sort)
    values (v_uid, btrim(p_title), p_cover_story,
            coalesce((select max(sort) + 1 from public.story_highlights where owner_id = v_uid), 0))
    returning id into v_id;
  else
    update public.story_highlights
       set title = btrim(p_title), cover_story_id = p_cover_story, updated_at = now()
     where id = v_id and owner_id = v_uid;
    if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
    delete from public.story_highlight_items where highlight_id = v_id;
  end if;

  insert into public.story_highlight_items (highlight_id, story_id, sort)
  select v_id, x.id, min(x.ord)::int
    from unnest(p_story_ids) with ordinality as x(id, ord)
   group by x.id
  on conflict do nothing;

  return jsonb_build_object('highlight_id', v_id);
end;
$$;

create or replace function public.delete_story_highlight(p_highlight uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  delete from public.story_highlights where id = p_highlight and owner_id = v_uid;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6) meal_consumptions.source += 'story' (G21 dinamik deseni: mevcut değerler korunur) ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
do $$
declare
  vals text[];
begin
  select array_agg(v order by v) into vals
  from (
    select unnest(array['manual', 'pantry', 'post', 'ai_scan', 'day_card', 'barcode', 'story']) as v
    union
    select distinct source from public.meal_consumptions where source is not null
  ) s;
  alter table public.meal_consumptions drop constraint if exists meal_consumptions_source_check;
  execute format(
    'alter table public.meal_consumptions add constraint meal_consumptions_source_check check (source = any (%L::text[]))',
    vals
  );
end $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7) Moderasyon — 'story' hedefi                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story'));

alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story'));

alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment', 'story'));

-- report_content — G10 gövdesi BİREBİR + 'story' hedefi (görülebilen hikâye).
create or replace function public.report_content(p_target_type text, p_target uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_risk    smallint;
  v_daycnt  int;
  v_visible boolean := false;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_target_type not in ('post', 'user', 'day_card', 'comment', 'story') then
    raise exception 'gecersiz_hedef';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  if p_target_type = 'post' then
    v_visible := exists (
      select 1 from public.posts p
       where p.id = p_target and p.status = 'published'
         and public.feed_can_view_author(v_uid, p.author_id)
    );
  elsif p_target_type = 'comment' then
    v_visible := exists (
      select 1 from public.post_comments c
       join public.posts p on p.id = c.post_id
       where c.id = p_target and c.status = 'published' and p.status = 'published'
         and public.feed_can_view_author(v_uid, c.author_id)
         and public.feed_can_view_author(v_uid, p.author_id)
    );
  elsif p_target_type = 'day_card' then
    v_visible := exists (
      select 1 from public.day_shares d
       where d.id = p_target and d.expires_at > now()
         and public.feed_can_view_author(v_uid, d.user_id)
    );
  elsif p_target_type = 'story' then
    -- G59: kendi hikâyeni bildiremezsin; görülebilen (aktif ya da öne çıkan) hikâye.
    v_visible := exists (
      select 1 from public.stories s
       where s.id = p_target and s.author_id <> v_uid
         and public.story_can_view(v_uid, s.id)
    );
  elsif p_target_type = 'user' then
    v_visible := exists (select 1 from public.profiles pr where pr.id = p_target)
                 and p_target is distinct from v_uid
                 and not public.feed_is_blocked(v_uid, p_target);
  end if;

  if not v_visible then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  select count(*) into v_daycnt
    from public.content_reports
   where reporter_id = v_uid
     and source = 'user'
     and (created_at at time zone 'Europe/Istanbul')::date
         = (now() at time zone 'Europe/Istanbul')::date;
  if v_daycnt >= 50
     and not exists (
       select 1 from public.content_reports
        where reporter_id = v_uid and target_type = p_target_type and target_id = p_target
     ) then
    raise exception 'cok_fazla_sikayet' using errcode = '42901';
  end if;

  v_risk := public.content_report_risk(p_reason);

  insert into public.content_reports (reporter_id, target_type, target_id, reason, status, risk)
  values (v_uid, p_target_type, p_target, left(p_reason, 500), 'open', v_risk)
  on conflict (reporter_id, target_type, target_id)
  do update set reason = excluded.reason, created_at = now(), status = 'open', risk = excluded.risk;
end;
$$;

-- mod_resolve_report — G10 gövdesi BİREBİR + 'story' (kaldır = removed; yayınla = pending→published;
-- kuyruk kapanışı story'yi de kapsar).
create or replace function public.mod_resolve_report(
  p_report bigint,
  p_action text,
  p_reason text
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.content_reports%rowtype;
begin
  if not (public.feed_is_moderator(v_uid) or public.is_admin()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_action not in ('remove', 'warn', 'dismiss') then raise exception 'gecersiz_aksiyon'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  select * into r from public.content_reports where id = p_report;
  if not found then raise exception 'rapor_yok' using errcode = '42501'; end if;

  perform set_config('app.post_rpc', 'on', true);

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'day_card' then
      update public.day_shares set expires_at = now() - interval '1 second' where id = r.target_id;
    elsif r.target_type = 'story' then
      update public.stories set status = 'removed' where id = r.target_id;
    end if;
  elsif p_action = 'dismiss' then
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'story' then
      update public.stories set status = 'published' where id = r.target_id and status = 'pending';
    end if;
  end if;

  if r.target_type in ('post', 'comment', 'story') then
    update public.moderation_queue
       set status = 'done', last_attempt_at = now()
     where target_type = r.target_type and target_id = r.target_id;
  end if;

  update public.content_reports
     set status = 'resolved'
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.moderation_actions (actor_id, report_id, target_type, target_id, action, reason)
  values (v_uid, r.id, r.target_type, r.target_id, p_action, left(p_reason, 500));

  return jsonb_build_object('ok', true);
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8) Depolama — post-media `stories/{uid}/…` (yükleme deseni Keşfet'le aynı)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Kova sınırları G8 §15'ten: ≤ 50 MB, görsel + mp4/mov. Yazma yalnız kendi klasörüne ve bayrak açıkken.
drop policy if exists story_media_insert on storage.objects;
create policy story_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_flag_enabled('hikaye')
  );

drop policy if exists story_media_delete on storage.objects;
create policy story_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9) EXECUTE yetkileri                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
revoke all on function public.story_overlays_valid(jsonb)                          from public, anon;
revoke all on function public.story_has_text(jsonb)                                from public, anon;
revoke all on function public.story_is_official(uuid)                              from public, anon;
revoke all on function public.story_can_view(uuid, uuid)                           from public, anon;
revoke all on function public.story_json(public.stories, uuid)                     from public, anon, authenticated;
revoke all on function public.create_story(text, text, text, numeric, int, int, jsonb, jsonb, text) from public, anon;
revoke all on function public.delete_my_story(uuid)                                from public, anon;
revoke all on function public.get_story_tray()                                     from public, anon;
revoke all on function public.get_user_stories(uuid)                               from public, anon;
revoke all on function public.get_story_ring(uuid)                                 from public, anon;
revoke all on function public.get_highlight_stories(uuid)                          from public, anon;
revoke all on function public.mark_story_viewed(uuid)                              from public, anon;
revoke all on function public.react_story(uuid, text, boolean)                     from public, anon;
revoke all on function public.vote_story_poll(uuid, text, int)                     from public, anon;
revoke all on function public.story_sticker_tap(uuid, text)                        from public, anon;
revoke all on function public.add_story_meal_to_day(uuid, text, text, numeric, text) from public, anon;
revoke all on function public.get_story_viewers(uuid, text)                        from public, anon;
revoke all on function public.get_my_story_archive(timestamptz, int)               from public, anon;
revoke all on function public.get_user_highlights(uuid)                            from public, anon;
revoke all on function public.upsert_story_highlight(uuid, text, uuid[], uuid)     from public, anon;
revoke all on function public.delete_story_highlight(uuid)                         from public, anon;

grant execute on function public.story_can_view(uuid, uuid)                           to authenticated;
grant execute on function public.story_is_official(uuid)                              to authenticated;
grant execute on function public.create_story(text, text, text, numeric, int, int, jsonb, jsonb, text) to authenticated;
grant execute on function public.delete_my_story(uuid)                                to authenticated;
grant execute on function public.get_story_tray()                                     to authenticated;
grant execute on function public.get_user_stories(uuid)                               to authenticated;
grant execute on function public.get_story_ring(uuid)                                 to authenticated;
grant execute on function public.get_highlight_stories(uuid)                          to authenticated;
grant execute on function public.mark_story_viewed(uuid)                              to authenticated;
grant execute on function public.react_story(uuid, text, boolean)                     to authenticated;
grant execute on function public.vote_story_poll(uuid, text, int)                     to authenticated;
grant execute on function public.story_sticker_tap(uuid, text)                        to authenticated;
grant execute on function public.add_story_meal_to_day(uuid, text, text, numeric, text) to authenticated;
grant execute on function public.get_story_viewers(uuid, text)                        to authenticated;
grant execute on function public.get_my_story_archive(timestamptz, int)               to authenticated;
grant execute on function public.get_user_highlights(uuid)                            to authenticated;
grant execute on function public.upsert_story_highlight(uuid, text, uuid[], uuid)     to authenticated;
grant execute on function public.delete_story_highlight(uuid)                         to authenticated;

commit;
