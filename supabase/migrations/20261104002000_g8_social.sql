-- G8-S1 — Açık paylaşım, yorum, etkinlik, sosyal bildirim, AI denetim (G8-CONTRACT.md).
-- version: 20261104002000  name: g8_social
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı, staging'de test edilmedi (gece kuralı).
-- Geri alma: supabase/rollbacks/20261104002000_g8_social_rollback.sql
--
-- Önkoşul (G6-APPLY.md sırası): #0–#11 uygulanmış olmalı; bu dosya #12 sırasıdır.
-- G5/G6/G7'nin bıraktığı Keşfet katmanının ÜSTÜNE eklenir; çelişkide G8-CONTRACT
-- geçerlidir. Bütün yeni davranış kapalı bayraklar arkasında (kesfet_paylasim,
-- kesfet_video, kesfet_yorum, etkinlik, sosyal_bildirim — hepsi false).
--
-- İçindekiler:
--   1) Bayrak tohumları (feature_flags) — hepsi KAPALI
--   2) posts: post_type, activity_card, status+='pending', idempotency_key
--   3) post_media: kind, duration_s, thumb_path, frame_paths
--   4) content_reports: target_type+='comment', source (user|ai), reporter_id nullable
--   5) activity_logs tablosu + RLS
--   6) post_comments tablosu + RLS
--   7) social_notifications tablosu + RLS
--   8) moderation_queue tablosu (AI denetim kuyruğu/yeniden deneme sayacı)
--   9) Yardımcılar: feed_flag_enabled, activity_kcal, social_notify
--  10) Sosyal bildirim tetikleyicileri + hız sınırı (dedup) guard + push
--  11) RPC'ler: create_post, delete_my_post, add_comment, list_comments,
--      delete_my_comment, did_it, log_activity, get_my_day_activity,
--      list_social_notifications, mark_social_notifications_read
--  12) get_feed genişletmesi (create or replace; eski alanlar aynen kalır)
--  13) mod_list_reports / mod_resolve_report — yorum + AI hedefleri kapsar
--  14) Panel RPC'leri: admin_list_posts, admin_delete_draft_post
--  15) Storage: post-media video + kesfet_paylasim yazma politikası
--  16) EXECUTE yetkileri
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1) Bayrak tohumları — hepsi KAPALI (enabled=false, rollout_percent=0).      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Açmak yalnız service_role/admin işidir; kayıt eklemek davranışı değiştirmez.
insert into public.feature_flags (key, description) values
  ('kesfet_paylasim', 'Keşfet: herkes paylaşır (yalnız creator değil) — G8'),
  ('kesfet_video',    'Keşfet: gönderide video (tek, ≤60 sn, ≤50 MB) — G8'),
  ('kesfet_yorum',    'Keşfet: tek seviye yorum/yanıt — G8'),
  ('etkinlik',        'Keşfet: etkinlik kartı + aktivite kaydı (Ben de yaptım) — G8'),
  ('sosyal_bildirim', 'Sosyal bildirimler + push (beğeni/yorum/takip…) — G8')
on conflict (key) do nothing;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2) posts — post_type, activity_card, status+='pending', idempotency_key     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.posts add column if not exists post_type     text  not null default 'ogun';
alter table public.posts add column if not exists activity_card  jsonb;
alter table public.posts add column if not exists idempotency_key text;

alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add  constraint posts_post_type_check
  check (post_type in ('serbest', 'ogun', 'etkinlik'));

-- status: mevcut ('published','hidden','removed') üzerine 'pending' eklenir;
-- hidden bozulmaz. (G8-CONTRACT: pending | published | removed + hidden korunur.)
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add  constraint posts_status_check
  check (status in ('pending', 'published', 'hidden', 'removed'));

-- Aynı yazarın aynı idempotency_key'i tek gönderi açar (create_post tekrar-güvenli).
create unique index if not exists posts_author_idem_idx
  on public.posts (author_id, idempotency_key) where idempotency_key is not null;

-- Yazarın kendi 'pending' gönderisini kendine göstermek için (get_feed).
create index if not exists posts_author_status_idx on public.posts (author_id, status);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3) post_media — video desteği (şema; istemci ayrı oturumda)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.post_media add column if not exists kind        text not null default 'image';
alter table public.post_media add column if not exists duration_s  numeric;
alter table public.post_media add column if not exists thumb_path  text;
alter table public.post_media add column if not exists frame_paths text[];

alter table public.post_media drop constraint if exists post_media_kind_check;
alter table public.post_media add  constraint post_media_kind_check
  check (kind in ('image', 'video'));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4) content_reports — 'comment' hedefi + AI (sistem) şikayeti                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

-- AI kararı sistem şikayeti olarak düşer (reporter yok) → reporter_id nullable + source.
alter table public.content_reports alter column reporter_id drop not null;
alter table public.content_reports add column if not exists source text not null default 'user';
alter table public.content_reports drop constraint if exists content_reports_source_check;
alter table public.content_reports add  constraint content_reports_source_check
  check (source in ('user', 'ai'));

-- AI şikayetleri hedef başına TEK satır (reporter_id null olduğu için tablo-düzeyi
-- unique NULL'ları ayrı sayar → ayrı partial unique index ile tekilleştirilir).
create unique index if not exists content_reports_ai_target_idx
  on public.content_reports (target_type, target_id) where source = 'ai';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5) activity_logs — etkinlik kaydı (Ben de yaptım + elle kayıt)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.activity_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null,
  minutes     numeric     not null check (minutes > 0),
  distance_km numeric,
  kcal_est    numeric     not null default 0,
  source      text        not null default 'manual' check (source in ('manual', 'post')),
  source_ref  text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (user_id, source, source_ref)
);
create index if not exists activity_logs_user_day_idx on public.activity_logs (user_id, logged_at desc);

alter table public.activity_logs enable row level security;
-- Yalnız sahibi okur/yazar (doğrudan yazım da RPC'yle aynı güvenlik; RPC definer).
drop policy if exists activity_logs_own on public.activity_logs;
create policy activity_logs_own on public.activity_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6) post_comments — tek seviye yorum/yanıt                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.post_comments (
  id              uuid        primary key default gen_random_uuid(),
  post_id         uuid        not null references public.posts(id) on delete cascade,
  author_id       uuid        not null references auth.users(id) on delete cascade,
  parent_id       uuid        references public.post_comments(id) on delete cascade,
  body            text        not null check (char_length(body) <= 500),
  status          text        not null default 'pending'
                    check (status in ('pending', 'published', 'removed')),
  idempotency_key text,
  created_at      timestamptz not null default now()
);
create index if not exists post_comments_post_idx   on public.post_comments (post_id, created_at, id);
create index if not exists post_comments_parent_idx on public.post_comments (parent_id) where parent_id is not null;
create index if not exists post_comments_author_idx on public.post_comments (author_id, created_at desc);
create unique index if not exists post_comments_author_idem_idx
  on public.post_comments (author_id, idempotency_key) where idempotency_key is not null;

alter table public.post_comments enable row level security;
-- Okuma: gönderiyi görebilen + yorum yazarını görebilen (gizlilik/engel), yorum
-- 'published'; VEYA kendi yorumu (pending dahil); VEYA moderatör. Yazma yalnız RPC
-- (definer) üzerinden — doğrudan insert politikası YOK (RPC bypass eder).
drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select to authenticated using (
    author_id = auth.uid()
    or public.feed_is_moderator(auth.uid())
    or (
      status = 'published'
      and public.feed_can_view_author(auth.uid(), author_id)
      and exists (
        select 1 from public.posts p
        where p.id = post_comments.post_id
          and p.status = 'published'
          and public.feed_can_view_author(auth.uid(), p.author_id)
      )
    )
  );
-- Güncelleme/silme: kendi yorumu VEYA moderatör (status değiştirme RPC ile).
drop policy if exists post_comments_update on public.post_comments;
create policy post_comments_update on public.post_comments
  for update to authenticated
  using (author_id = auth.uid() or public.feed_is_moderator(auth.uid()))
  with check (author_id = auth.uid() or public.feed_is_moderator(auth.uid()));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7) social_notifications — sosyal bildirim (yalnız alıcı okur)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.social_notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade, -- alıcı
  actor_id   uuid        not null references auth.users(id) on delete cascade, -- yapan
  kind       text        not null check (kind in
                ('like', 'comment', 'reply', 'follow', 'follow_request',
                 'follow_accept', 'add_to_day', 'did_it')),
  post_id    uuid        references public.posts(id) on delete cascade,
  comment_id uuid        references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists social_notifications_user_idx
  on public.social_notifications (user_id, created_at desc, id desc);
-- Hız sınırı / dedup kontrolü (aynı aktör+tür+gönderi, 1 saat) için.
create index if not exists social_notifications_dedup_idx
  on public.social_notifications (user_id, actor_id, kind, post_id, created_at desc);

alter table public.social_notifications enable row level security;
-- Yalnız alıcı okur. Yazma/güncelleme politikası YOK → istemci doğrudan yazamaz;
-- tetikleyiciler ve mark_* RPC'si SECURITY DEFINER olarak yazar (RLS bypass).
drop policy if exists social_notifications_select on public.social_notifications;
create policy social_notifications_select on public.social_notifications
  for select to authenticated using (user_id = auth.uid());

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8) moderation_queue — AI denetim kuyruğu + yeniden deneme sayacı            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- create_post / add_comment buraya 'pending' satır yazar; moderate-content edge
-- function nihai karar verince 'done' yapar. pg_cron (ayrı migration) 10 dk'dan
-- eski 'pending' satırları en fazla 3 kez yeniden dener (attempts cron'da artar).
create table if not exists public.moderation_queue (
  target_type     text        not null check (target_type in ('post', 'comment')),
  target_id       uuid        not null,
  status          text        not null default 'pending' check (status in ('pending', 'done')),
  attempts        int         not null default 0,
  created_at      timestamptz not null default now(),
  last_attempt_at timestamptz,
  primary key (target_type, target_id)
);
create index if not exists moderation_queue_pending_idx
  on public.moderation_queue (status, created_at) where status = 'pending';

alter table public.moderation_queue enable row level security;
-- Yalnız moderatör/admin okur; yazma yalnız definer RPC/edge function (service_role).
drop policy if exists moderation_queue_mod_select on public.moderation_queue;
create policy moderation_queue_mod_select on public.moderation_queue
  for select to authenticated
  using (public.feed_is_moderator(auth.uid()) or public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- 9) Yardımcılar
-- ═════════════════════════════════════════════════════════════════════════════

-- Bir bayrak GENEL olarak açık mı? (create_post yetkisi + storage + push için.)
-- Not: Bu, kullanıcı-bazlı rollout değil, bayrağın enabled kolonudur — "kapalıyken
-- davranış değişmez" güvencesi için (G8-CONTRACT §2 "feature_flags'te okunur").
create or replace function public.feed_flag_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feature_flags f where f.key = p_key and f.enabled);
$$;

-- activity_kcal — MET × kilo(kg) × saat. Kilo user_nutrition_profiles'tan (yoksa 70).
-- Sonuç her zaman TAHMİNİdir. MET tablosu fonksiyonda sabittir (G8-CONTRACT §Veri).
create or replace function public.activity_kcal(
  p_type      text,
  p_minutes   numeric,
  p_weight_kg numeric default null
)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_met    numeric;
  v_weight numeric;
begin
  if p_minutes is null or p_minutes <= 0 then return 0; end if;
  v_met := case lower(coalesce(p_type, ''))
    when 'kosu'       then 9.8
    when 'yuruyus'    then 3.5
    when 'bisiklet'   then 7.5
    when 'yuzme'      then 7.0
    when 'fitness'    then 6.0
    when 'yoga'       then 2.5
    when 'pilates'    then 3.0
    when 'futbol'     then 7.0
    when 'basketbol'  then 6.5
    when 'tenis'      then 7.0
    when 'dans'       then 5.0
    else 4.0  -- diger / bilinmeyen
  end;
  v_weight := coalesce(p_weight_kg,
    (select nullif(weight, 0) from public.user_nutrition_profiles where user_id = auth.uid()),
    70);
  return round(v_met * v_weight * (p_minutes / 60.0));
end;
$$;

-- social_notify — bir sosyal bildirim satırı ekler (self/engel/dedup guard
-- tarafından süzülür; bkz. social_notifications_guard). Yalnız tetikleyiciler çağırır.
create or replace function public.social_notify(
  p_recipient uuid,
  p_actor     uuid,
  p_kind      text,
  p_post      uuid default null,
  p_comment   uuid default null
)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if p_recipient is null or p_actor is null then return; end if;
  insert into public.social_notifications (user_id, actor_id, kind, post_id, comment_id)
  values (p_recipient, p_actor, p_kind, p_post, p_comment);
exception when others then
  -- Bildirim üretimi asıl işlemi (beğeni/yorum/takip) asla engellemez.
  raise warning 'social_notify failed: % (%)', sqlerrm, sqlstate;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10) Tetikleyiciler: guard (self/engel/hız sınırı) + üretim + push
-- ═════════════════════════════════════════════════════════════════════════════

-- GUARD (BEFORE INSERT): kendine bildirim yok; engelliyse yok; aynı aktör+tür+
-- gönderi için 1 saatte tek satır (hız sınırı). Koşul tutmazsa satır iptal (null).
create or replace function public.social_notifications_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.actor_id = NEW.user_id then
    return null;                         -- kendine bildirim yok
  end if;
  if public.feed_is_blocked(NEW.user_id, NEW.actor_id) then
    return null;                         -- çift yönlü engel → yok
  end if;
  if exists (
    select 1 from public.social_notifications n
    where n.user_id = NEW.user_id
      and n.actor_id = NEW.actor_id
      and n.kind = NEW.kind
      and n.post_id is not distinct from NEW.post_id
      and n.created_at > now() - interval '1 hour'
  ) then
    return null;                         -- hız sınırı / tekrar
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_social_notifications_guard on public.social_notifications;
create trigger trg_social_notifications_guard
  before insert on public.social_notifications
  for each row execute function public.social_notifications_guard();

-- Beğeni → gönderi sahibine 'like' ('save' özel; bildirim yok).
create or replace function public.fn_notify_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if NEW.kind <> 'like' then return NEW; end if;
  select author_id into v_author from public.posts where id = NEW.post_id;
  perform public.social_notify(v_author, NEW.user_id, 'like', NEW.post_id, null);
  return NEW;
end;
$$;
drop trigger if exists trg_notify_reaction on public.post_reactions;
create trigger trg_notify_reaction
  after insert on public.post_reactions
  for each row execute function public.fn_notify_reaction();

-- Yorum/yanıt → gönderi sahibine 'comment' / üst yorum sahibine 'reply'.
create or replace function public.fn_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rec uuid;
begin
  if NEW.parent_id is null then
    select author_id into v_rec from public.posts where id = NEW.post_id;
    perform public.social_notify(v_rec, NEW.author_id, 'comment', NEW.post_id, NEW.id);
  else
    select author_id into v_rec from public.post_comments where id = NEW.parent_id;
    perform public.social_notify(v_rec, NEW.author_id, 'reply', NEW.post_id, NEW.id);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_comment on public.post_comments;
create trigger trg_notify_comment
  after insert on public.post_comments
  for each row execute function public.fn_notify_comment();

-- Takip → takip edilene 'follow'. İstek onayında (app.follow_accept bayrağı)
-- isteği yapana 'follow_accept' (respond_follow_request / set_profile_privacy kurar).
create or replace function public.fn_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.follow_accept', true), '') = 'on' then
    perform public.social_notify(NEW.follower_id, NEW.following_id, 'follow_accept', null, null);
  else
    perform public.social_notify(NEW.following_id, NEW.follower_id, 'follow', null, null);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow
  after insert on public.follows
  for each row execute function public.fn_notify_follow();

-- Takip isteği → hedefe 'follow_request'.
create or replace function public.fn_notify_follow_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.social_notify(NEW.target_id, NEW.requester_id, 'follow_request', null, null);
  return NEW;
end;
$$;
drop trigger if exists trg_notify_follow_request on public.follow_requests;
create trigger trg_notify_follow_request
  after insert on public.follow_requests
  for each row execute function public.fn_notify_follow_request();

-- "Günüme ekle" → gönderi sahibine 'add_to_day'.
create or replace function public.fn_notify_add_to_day()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = NEW.post_id;
  perform public.social_notify(v_author, NEW.user_id, 'add_to_day', NEW.post_id, null);
  return NEW;
end;
$$;
drop trigger if exists trg_notify_add_to_day on public.post_meal_adds;
create trigger trg_notify_add_to_day
  after insert on public.post_meal_adds
  for each row execute function public.fn_notify_add_to_day();

-- "Ben de yaptım" (etkinlik kaydı, source='post') → gönderi sahibine 'did_it'.
create or replace function public.fn_notify_did_it()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_post uuid;
begin
  if NEW.source <> 'post' or NEW.source_ref is null then return NEW; end if;
  begin
    v_post := NEW.source_ref::uuid;
  exception when others then
    return NEW;  -- source_ref uuid değilse (elle kayıt) atla
  end;
  select author_id into v_author from public.posts where id = v_post;
  perform public.social_notify(v_author, NEW.user_id, 'did_it', v_post, null);
  return NEW;
end;
$$;
drop trigger if exists trg_notify_did_it on public.activity_logs;
create trigger trg_notify_did_it
  after insert on public.activity_logs
  for each row execute function public.fn_notify_did_it();

-- PUSH (AFTER INSERT): sosyal_bildirim AÇIKKEN mevcut gönderici (send-notification,
-- by_content) ile push. KAPALIYKEN hiç çıkmaz (erken return). Sipariş bildirimlerine
-- dokunmaz. En az riskli yol: social_notifications satırı kalıcı kuyruk/kayıttır;
-- push best-effort (hata yutulur) — fn_notify_review_reply deseniyle birebir.
create or replace function public.fn_push_social_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_key    text;
  v_actor  text;
  v_handle text;
  v_title  text;
  v_body   text;
  v_link   text;
  v_req    bigint;
begin
  -- Bayrak kapalı → push yok (davranış değişmez).
  if not public.feed_flag_enabled('sosyal_bildirim') then
    return NEW;
  end if;

  select coalesce(
           pr.full_name,
           nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
           pr.handle, 'Biri'),
         pr.handle
    into v_actor, v_handle
  from public.profiles pr where pr.id = NEW.actor_id;
  v_actor := coalesce(v_actor, 'Biri');

  v_body := case NEW.kind
    when 'like'           then v_actor || ' gönderini beğendi'
    when 'comment'        then v_actor || ' gönderine yorum yaptı'
    when 'reply'          then v_actor || ' yorumuna yanıt verdi'
    when 'follow'         then v_actor || ' seni takip etmeye başladı'
    when 'follow_request' then v_actor || ' sana takip isteği gönderdi'
    when 'follow_accept'  then v_actor || ' takip isteğini kabul etti'
    when 'add_to_day'     then v_actor || ' öğününü gününe ekledi'
    when 'did_it'         then v_actor || ' etkinliğini denedi'
    else v_actor || ' seninle etkileşti'
  end;
  v_title := 'Kcalculate';
  v_link  := case
    when NEW.post_id is not null then 'kcal://p/' || NEW.post_id::text
    when v_handle is not null    then 'kcal://u/' || v_handle
    else 'kcal://kesfet'
  end;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_key is null then
    raise warning 'fn_push_social_notification: service_role_key Vault''ta yok';
    return NEW;
  end if;

  select net.http_post(
    url := 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'mode', 'by_content',
      'user_ids', jsonb_build_array(NEW.user_id),
      'title', v_title,
      'body', v_body,
      'deep_link', v_link,
      'category', 'behavioral',
      'data', jsonb_build_object('social_notification_id', NEW.id, 'kind', NEW.kind)
    )
  ) into v_req;
  return NEW;
exception when others then
  -- Push gönderilemezse sosyal bildirim kaydı (in-app) yine de kalır.
  raise warning 'fn_push_social_notification failed: % (%)', sqlerrm, sqlstate;
  return NEW;
end;
$$;
drop trigger if exists trg_push_social_notification on public.social_notifications;
create trigger trg_push_social_notification
  after insert on public.social_notifications
  for each row execute function public.fn_push_social_notification();

-- ═════════════════════════════════════════════════════════════════════════════
-- 11) RPC'ler (G8-CONTRACT imzalarıyla birebir)
-- ═════════════════════════════════════════════════════════════════════════════

-- create_post → {post_id, status}. status 'pending' başlar. Yayın yetkisi:
-- kesfet_paylasim açıkken herkes; kapalıyken yalnız creators.can_post. Hız sınırı:
-- günde 10 gönderi; hesap 24 saatten yeni ise 3. Aşılırsa {error:'rate_limited'}.
create or replace function public.create_post(
  p_type            text,
  p_body            text,
  p_lang            text,
  p_media           jsonb,
  p_meal_card       jsonb,
  p_activity_card   jsonb,
  p_idempotency_key text
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_post    uuid;
  v_existing uuid;
  v_created timestamptz;
  v_limit   int;
  v_count   int;
  v_imgs    int := 0;
  v_vids    int := 0;
  v_el      jsonb;
  v_i       int := 0;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_type not in ('serbest', 'ogun', 'etkinlik') then raise exception 'gecersiz_tur'; end if;
  if p_lang not in ('tr', 'en') then raise exception 'gecersiz_dil'; end if;
  if char_length(coalesce(p_body, '')) > 1000 then raise exception 'metin_cok_uzun'; end if;

  -- Yetki: bayrak açık → herkes; kapalı → yalnız can_post.
  if not (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(v_uid)) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  -- Idempotency: aynı anahtarla gönderi zaten varsa onu dön.
  if coalesce(btrim(p_idempotency_key), '') <> '' then
    select id into v_existing
      from public.posts
     where author_id = v_uid and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object('post_id', v_existing,
        'status', (select status from public.posts where id = v_existing));
    end if;
  end if;

  -- Hız sınırı: hesap yaşı 24 saatten az ise 3, değilse 10 (son 24 saat, removed hariç).
  select created_at into v_created from public.profiles where id = v_uid;
  v_limit := case when v_created is not null and v_created > now() - interval '24 hours'
                  then 3 else 10 end;
  select count(*) into v_count from public.posts
   where author_id = v_uid and status <> 'removed'
     and created_at > now() - interval '24 hours';
  if v_count >= v_limit then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  -- Medya sayımı/doğrulama: en fazla 4 görsel; en fazla 1 video.
  if p_media is not null and jsonb_typeof(p_media) = 'array' then
    for v_el in select * from jsonb_array_elements(p_media) loop
      if coalesce(v_el->>'kind', 'image') = 'video' then v_vids := v_vids + 1;
      else v_imgs := v_imgs + 1; end if;
    end loop;
    if v_imgs > 4 then raise exception 'en_fazla_4_gorsel'; end if;
    if v_vids > 1 then raise exception 'en_fazla_1_video'; end if;
  end if;

  insert into public.posts
    (author_id, lang, body, post_type, meal_card, activity_card, status,
     idempotency_key, published_at)
  values
    (v_uid, p_lang, coalesce(p_body, ''), p_type, p_meal_card, p_activity_card, 'pending',
     nullif(btrim(coalesce(p_idempotency_key, '')), ''), now())
  returning id into v_post;

  if p_media is not null and jsonb_typeof(p_media) = 'array' then
    for v_el in select * from jsonb_array_elements(p_media) loop
      insert into public.post_media
        (post_id, url, width, height, sort, kind, duration_s, thumb_path, frame_paths)
      values (
        v_post,
        coalesce(v_el->>'path', v_el->>'url'),
        nullif(v_el->>'width', '')::int,
        nullif(v_el->>'height', '')::int,
        v_i,
        coalesce(v_el->>'kind', 'image'),
        nullif(v_el->>'duration_s', '')::numeric,
        v_el->>'thumb_path',
        case when v_el ? 'frame_paths' and jsonb_typeof(v_el->'frame_paths') = 'array'
             then array(select jsonb_array_elements_text(v_el->'frame_paths')) else null end
      );
      v_i := v_i + 1;
    end loop;
  end if;

  -- AI denetim kuyruğuna al (istemci moderate-content çağırır; cron yeniden dener).
  insert into public.moderation_queue (target_type, target_id)
  values ('post', v_post) on conflict do nothing;

  return jsonb_build_object('post_id', v_post, 'status', 'pending');
end;
$$;

-- delete_my_post → {ok} (status=removed). Yalnız kendi gönderisi.
create or replace function public.delete_my_post(p_post uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.posts set status = 'removed'
   where id = p_post and author_id = v_uid and status <> 'removed';
  get diagnostics v_n = row_count;
  if v_n = 0 and not exists (select 1 from public.posts where id = p_post and author_id = v_uid) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- add_comment → {comment_id, status}; günde 100 yorum. Yorum 'pending' başlar.
create or replace function public.add_comment(
  p_post            uuid,
  p_body            text,
  p_parent          uuid default null,
  p_idempotency_key text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_author   uuid;
  v_existing uuid;
  v_count    int;
  v_cid      uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'metin_zorunlu'; end if;
  if char_length(p_body) > 500 then raise exception 'metin_cok_uzun'; end if;

  -- Gönderi yayımlanmış olmalı; engelli yorum yapamaz (çift yönlü); gizlilik sunucuda.
  select author_id into v_author from public.posts p
   where p.id = p_post and p.status = 'published';
  if v_author is null then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  if public.feed_is_blocked(v_uid, v_author) then
    raise exception 'engel_var' using errcode = '42501';
  end if;
  if not public.feed_can_view_author(v_uid, v_author) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  -- Idempotency.
  if coalesce(btrim(p_idempotency_key), '') <> '' then
    select id into v_existing from public.post_comments
     where author_id = v_uid and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object('comment_id', v_existing,
        'status', (select status from public.post_comments where id = v_existing));
    end if;
  end if;

  -- Üst yorum (tek seviye): varsa aynı gönderiye ait ve kendisi kök olmalı.
  if p_parent is not null then
    if not exists (
      select 1 from public.post_comments c
      where c.id = p_parent and c.post_id = p_post and c.parent_id is null
        and c.status <> 'removed'
    ) then
      raise exception 'gecersiz_ust_yorum';
    end if;
  end if;

  -- Hız sınırı: günde 100 yorum (son 24 saat, removed hariç).
  select count(*) into v_count from public.post_comments
   where author_id = v_uid and status <> 'removed'
     and created_at > now() - interval '24 hours';
  if v_count >= 100 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  insert into public.post_comments (post_id, author_id, parent_id, body, status, idempotency_key)
  values (p_post, v_uid, p_parent, p_body, 'pending',
          nullif(btrim(coalesce(p_idempotency_key, '')), ''))
  returning id into v_cid;

  insert into public.moderation_queue (target_type, target_id)
  values ('comment', v_cid) on conflict do nothing;

  return jsonb_build_object('comment_id', v_cid, 'status', 'pending');
end;
$$;

-- list_comments → {items, next_cursor}; eski → yeni. Her yorumda author{…},
-- reply_count, can_delete. Gizli hesabın yorumu / engel çift yönlü süzülür;
-- yazar kendi 'pending' yorumunu görür.
create or replace function public.list_comments(
  p_post   uuid,
  p_cursor text default null,
  p_limit  int  default 30
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_author  uuid;
  v_lim     int  := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_parts   text[];
  v_cur_ts  timestamptz;
  v_cur_id  uuid;
  v_result  jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  select author_id into v_author from public.posts p
   where p.id = p_post and p.status = 'published';
  if v_author is null or not public.feed_can_view_author(v_uid, v_author) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  if p_cursor is not null then
    v_parts  := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_ts := to_timestamp((v_parts[1])::bigint / 1e6);
    v_cur_id := v_parts[2]::uuid;
  end if;

  with vis as (
    select c.*
    from public.post_comments c
    where c.post_id = p_post
      and (
        c.author_id = v_uid                                    -- kendi (pending dahil)
        or (c.status = 'published'
            and public.feed_can_view_author(v_uid, c.author_id))  -- gizli/engel süzülür
      )
  ),
  pageq as (
    select * from vis
    where p_cursor is null or (created_at, id) > (v_cur_ts, v_cur_id)
    order by created_at asc, id asc
    limit v_lim
  ),
  rows as (
    select c.created_at, c.id,
      jsonb_build_object(
        'id', c.id,
        'post_id', c.post_id,
        'parent_id', c.parent_id,
        'body', c.body,
        'status', c.status,
        'created_at', c.created_at,
        'author', jsonb_build_object(
          'id', c.author_id,
          'display_name', coalesce(
            pr.full_name,
            nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
            pr.handle, 'Kcalculate'),
          'handle', pr.handle,
          'avatar_url', pr.avatar_url,
          'verified', exists (select 1 from public.creators cr
                              where cr.user_id = c.author_id and cr.verified_at is not null)
        ),
        'reply_count', (
          select count(*) from public.post_comments r
          where r.parent_id = c.id and r.status = 'published'
        ),
        'can_delete', (c.author_id = v_uid or public.feed_is_moderator(v_uid))
      ) as item
    from pageq c
    left join public.profiles pr on pr.id = c.author_id
  ),
  agg as (
    select jsonb_agg(item order by created_at asc, id asc) as arr, count(*)::int as n from rows
  ),
  nxt as (
    select encode(convert_to(
             (extract(epoch from created_at) * 1e6)::bigint::text || '|' || id::text,
             'utf8'), 'base64') as c
    from rows order by created_at desc, id desc limit 1
  )
  select jsonb_build_object(
    'items', coalesce(agg.arr, '[]'::jsonb),
    'next_cursor', case when agg.n = v_lim then nxt.c else null end
  ) into v_result
  from agg left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null));
end;
$$;

-- delete_my_comment → {ok} (status=removed). Kendi yorumu VEYA moderatör.
create or replace function public.delete_my_comment(p_comment uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.post_comments set status = 'removed'
   where id = p_comment
     and status <> 'removed'
     and (author_id = v_uid or public.feed_is_moderator(v_uid));
  get diagnostics v_n = row_count;
  if v_n = 0 and not exists (
    select 1 from public.post_comments
    where id = p_comment and (author_id = v_uid or public.feed_is_moderator(v_uid))
  ) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- did_it → {activity_log_id, kcal_est}. Gönderinin etkinlik kartından (veya
-- p_minutes override) kcal tahmini; source='post', source_ref=p_post (idempotent:
-- gönderi başına tek kayıt). Gönderi görülebilir olmalı.
create or replace function public.did_it(
  p_post            uuid,
  p_minutes         numeric default null,
  p_idempotency_key text    default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_author  uuid;
  v_card    jsonb;
  v_type    text;
  v_minutes numeric;
  v_kcal    numeric;
  v_id      uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  select author_id, activity_card into v_author, v_card
  from public.posts
  where id = p_post and status = 'published';
  if v_author is null or not public.feed_can_view_author(v_uid, v_author) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  v_type    := coalesce(v_card->>'type', 'diger');
  v_minutes := coalesce(p_minutes, nullif(v_card->>'minutes', '')::numeric, 0);
  if v_minutes <= 0 then raise exception 'gecersiz_sure'; end if;
  v_kcal := public.activity_kcal(v_type, v_minutes, null);

  insert into public.activity_logs (user_id, type, minutes, kcal_est, source, source_ref, logged_at)
  values (v_uid, v_type, v_minutes, v_kcal, 'post', p_post::text, now())
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_id;

  if v_id is null then
    select id, kcal_est into v_id, v_kcal from public.activity_logs
     where user_id = v_uid and source = 'post' and source_ref = p_post::text;
  end if;

  return jsonb_build_object('activity_log_id', v_id, 'kcal_est', v_kcal);
end;
$$;

-- log_activity → {activity_log_id, kcal_est}. Elle etkinlik kaydı. source='manual',
-- source_ref=idempotency_key (zorunlu). kcal her zaman tahmini.
create or replace function public.log_activity(
  p_type            text,
  p_minutes         numeric,
  p_distance_km     numeric default null,
  p_note            text    default null,
  p_idempotency_key text    default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_kcal numeric;
  v_id   uuid;
  v_key  text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if v_key is null then raise exception 'idempotency_key_zorunlu'; end if;
  if coalesce(p_minutes, 0) <= 0 then raise exception 'gecersiz_sure'; end if;

  v_kcal := public.activity_kcal(p_type, p_minutes, null);

  insert into public.activity_logs
    (user_id, type, minutes, distance_km, kcal_est, source, source_ref, logged_at)
  values (v_uid, coalesce(p_type, 'diger'), p_minutes, p_distance_km, v_kcal, 'manual', v_key, now())
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_id;

  if v_id is null then
    select id, kcal_est into v_id, v_kcal from public.activity_logs
     where user_id = v_uid and source = 'manual' and source_ref = v_key;
  end if;

  return jsonb_build_object('activity_log_id', v_id, 'kcal_est', v_kcal);
end;
$$;

-- get_my_day_activity → {items, total_kcal_est, total_minutes} (Europe/Istanbul günü).
create or replace function public.get_my_day_activity(p_day date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  select jsonb_build_object(
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'type', a.type,
        'minutes', a.minutes,
        'distance_km', a.distance_km,
        'kcal_est', a.kcal_est,
        'source', a.source,
        'logged_at', a.logged_at
      ) order by a.logged_at desc), '[]'::jsonb),
    'total_kcal_est', coalesce(sum(a.kcal_est), 0),
    'total_minutes',  coalesce(sum(a.minutes), 0)
  ) into v_result
  from public.activity_logs a
  where a.user_id = v_uid
    and (a.logged_at at time zone 'Europe/Istanbul')::date = p_day;

  return v_result;
end;
$$;

-- list_social_notifications → {items, next_cursor, unread}. Yeni → eski.
create or replace function public.list_social_notifications(
  p_cursor text default null,
  p_limit  int  default 30
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_lim     int  := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_parts   text[];
  v_cur_ts  timestamptz;
  v_cur_id  uuid;
  v_result  jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  if p_cursor is not null then
    v_parts  := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_ts := to_timestamp((v_parts[1])::bigint / 1e6);
    v_cur_id := v_parts[2]::uuid;
  end if;

  with pageq as (
    select n.* from public.social_notifications n
    where n.user_id = v_uid
      and (p_cursor is null or (n.created_at, n.id) < (v_cur_ts, v_cur_id))
    order by n.created_at desc, n.id desc
    limit v_lim
  ),
  rows as (
    select n.created_at, n.id,
      jsonb_build_object(
        'id', n.id,
        'kind', n.kind,
        'post_id', n.post_id,
        'comment_id', n.comment_id,
        'created_at', n.created_at,
        'read_at', n.read_at,
        'actor', jsonb_build_object(
          'id', n.actor_id,
          'display_name', coalesce(
            pr.full_name,
            nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
            pr.handle, 'Kcalculate'),
          'handle', pr.handle,
          'avatar_url', pr.avatar_url,
          'verified', exists (select 1 from public.creators cr
                              where cr.user_id = n.actor_id and cr.verified_at is not null)
        )
      ) as item
    from pageq n
    left join public.profiles pr on pr.id = n.actor_id
  ),
  agg as (
    select jsonb_agg(item order by created_at desc, id desc) as arr, count(*)::int as n from rows
  ),
  nxt as (
    select encode(convert_to(
             (extract(epoch from created_at) * 1e6)::bigint::text || '|' || id::text,
             'utf8'), 'base64') as c
    from rows order by created_at asc, id asc limit 1
  )
  select jsonb_build_object(
    'items', coalesce(agg.arr, '[]'::jsonb),
    'next_cursor', case when agg.n = v_lim then nxt.c else null end,
    'unread', (select count(*) from public.social_notifications
               where user_id = v_uid and read_at is null)
  ) into v_result
  from agg left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'unread', 0));
end;
$$;

-- mark_social_notifications_read(p_until) → okunmamışları p_until'e kadar okundu yap.
create or replace function public.mark_social_notifications_read(p_until timestamptz default now())
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  update public.social_notifications set read_at = now()
   where user_id = v_uid and read_at is null and created_at <= coalesce(p_until, now());
  return jsonb_build_object('ok', true);
end;
$$;

-- ── respond_follow_request / set_profile_privacy — follow_accept bildirimi ─────
-- İstek onaylandığında follows satırı eklenir; fn_notify_follow bu iki RPC'nin
-- işlem-yerel `app.follow_accept='on'` bayrağını görünce bildirimi İSTEĞİ YAPANA
-- ('follow_accept') gönderir (yoksa 'follow' takip edilene gider). Gövdeler
-- feed_rpcs/g7_fixes sürümleriyle birebir; YALNIZ set_config satırları eklendi.
create or replace function public.respond_follow_request(p_requester uuid, p_accept bool)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.follow_requests
    where requester_id = p_requester and target_id = v_uid
  ) then
    raise exception 'istek_yok' using errcode = '42501';
  end if;

  if p_accept then
    perform set_config('app.follow_accept', 'on', true);   -- bildirim: isteği yapana
    insert into public.follows (follower_id, following_id)
    values (p_requester, v_uid) on conflict do nothing;
    perform set_config('app.follow_accept', 'off', true);
  end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = v_uid;
end;
$$;

create or replace function public.set_profile_privacy(p_is_private boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_was boolean;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  select coalesce(is_private, false) into v_was from public.profiles where id = v_uid;

  perform set_config('app.profile_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.profiles set is_private = coalesce(p_is_private, false) where id = v_uid;

  if coalesce(v_was, false) = true and coalesce(p_is_private, false) = false then
    perform set_config('app.follow_accept', 'on', true);  -- bildirim: her isteği yapana
    insert into public.follows (follower_id, following_id)
    select fr.requester_id, fr.target_id
      from public.follow_requests fr
     where fr.target_id = v_uid
       and not public.feed_is_blocked(fr.requester_id, v_uid)
    on conflict do nothing;
    perform set_config('app.follow_accept', 'off', true);
    delete from public.follow_requests where target_id = v_uid;
  end if;

  return jsonb_build_object('is_private', coalesce(p_is_private, false));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 12) get_feed — genişletme (create or replace; eski alanlar AYNEN kalır).
--     Ek: post_type, activity_card, media[].kind/duration_s/thumb_path,
--     stats.comments, stats.did_it, status. Yalnız 'published' döner; yazarın
--     kendi 'pending' gönderisi kendine "İnceleniyor" (status='pending') görünür.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.get_feed(
  p_tab    text,
  p_lang   text,
  p_cursor text default null,
  p_limit  int  default 20
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_lim     int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_parts   text[];
  v_cur_pin int;
  v_cur_pub timestamptz;
  v_cur_id  uuid;
  v_result  jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_tab not in ('for_you', 'following') then raise exception 'gecersiz_sekme'; end if;
  if p_lang is null then raise exception 'dil_zorunlu'; end if;

  if p_cursor is not null then
    v_parts   := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_pin := v_parts[1]::int;
    v_cur_pub := to_timestamp((v_parts[2])::bigint / 1e6);
    v_cur_id  := v_parts[3]::uuid;
  end if;

  with cand as (
    select p.*,
           (case when p.pinned_until is not null and p.pinned_until > now() then 1 else 0 end) as pin
    from public.posts p
    where p.lang = p_lang
      and (
        p.status = 'published'
        or (p.author_id = v_uid and p.status = 'pending')   -- kendi "İnceleniyor"u
      )
      and public.feed_can_view_author(v_uid, p.author_id)
      and (
        p_tab = 'for_you'
        or p.author_id = v_uid
        or exists (select 1 from public.follows f
                   where f.follower_id = v_uid and f.following_id = p.author_id)
      )
  ),
  pageq as (
    select *
    from cand
    where p_cursor is null
       or (pin, published_at, id) < (v_cur_pin, v_cur_pub, v_cur_id)
    order by pin desc, published_at desc, id desc
    limit v_lim
  ),
  feed_rows as (
    select
      pg.pin, pg.published_at, pg.id,
      jsonb_build_object(
        'id', pg.id,
        'author', jsonb_build_object(
          'id', pg.author_id,
          'display_name', coalesce(
            pr.full_name,
            nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
            pr.handle, 'Kcalculate'),
          'handle', pr.handle,
          'avatar_url', pr.avatar_url,
          'role', cr.role,
          'verified', (cr.verified_at is not null)
        ),
        'published_at', pg.published_at,
        'lang', pg.lang,
        'body', pg.body,
        'post_type', pg.post_type,
        'status', pg.status,
        'activity_card', pg.activity_card,
        'media', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'url', m.url, 'width', m.width, 'height', m.height,
                   'kind', m.kind, 'duration_s', m.duration_s, 'thumb_path', m.thumb_path)
                 order by m.sort, m.id)
          from public.post_media m where m.post_id = pg.id
        ), '[]'::jsonb),
        'meal_card', pg.meal_card,
        'quote', (
          select jsonb_build_object(
            'id', q.id,
            'author', jsonb_build_object(
              'id', q.author_id,
              'display_name', coalesce(qpr.full_name, qpr.handle, 'Kcalculate'),
              'handle', qpr.handle),
            'body', q.body)
          from public.posts q
          left join public.profiles qpr on qpr.id = q.author_id
          where q.id = pg.quote_of and q.status = 'published'
        ),
        'thread', case when pg.thread_root is not null then jsonb_build_object(
            'root_id', pg.thread_root,
            'index', pg.thread_index,
            'total', (select count(*) from public.posts t where t.thread_root = pg.thread_root)
          ) else null end,
        'stats', jsonb_build_object(
          'likes', (select count(*) from public.post_reactions r where r.post_id = pg.id and r.kind = 'like'),
          'saves', (select count(*) from public.post_reactions r where r.post_id = pg.id and r.kind = 'save'),
          'adds',  (select count(*) from public.post_meal_adds a where a.post_id = pg.id),
          'comments', (select count(*) from public.post_comments c where c.post_id = pg.id and c.status = 'published'),
          'did_it', (select count(*) from public.activity_logs al where al.source = 'post' and al.source_ref = pg.id::text)
        ),
        'me', jsonb_build_object(
          'liked', exists (select 1 from public.post_reactions r where r.post_id = pg.id and r.user_id = v_uid and r.kind = 'like'),
          'saved', exists (select 1 from public.post_reactions r where r.post_id = pg.id and r.user_id = v_uid and r.kind = 'save')
        )
      ) as item
    from pageq pg
    left join public.profiles pr on pr.id = pg.author_id
    left join public.creators cr on cr.user_id = pg.author_id
  ),
  agg as (
    select jsonb_agg(item order by pin desc, published_at desc, id desc) as arr, count(*)::int as n
    from feed_rows
  ),
  nxt as (
    select encode(convert_to(
             pin::text || '|' ||
             (extract(epoch from published_at) * 1e6)::bigint::text || '|' ||
             id::text, 'utf8'), 'base64') as c
    from feed_rows
    order by pin asc, published_at asc, id asc
    limit 1
  )
  select jsonb_build_object(
    'items', coalesce(agg.arr, '[]'::jsonb),
    'next_cursor', case when agg.n = v_lim then nxt.c else null end
  )
  into v_result
  from agg left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null));
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13) mod_list_reports / mod_resolve_report — yorum + AI hedefleri kapsar.
--     moderation_actions.target_type CHECK'ine 'comment' eklenir.
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

-- mod_list_reports: g6_fixes gövdesi + 'comment' önizlemesi. AI (sistem) şikayetleri
-- content_reports satırlarıdır (reason='ai:<kategori>') → mevcut gruplamayla gelir.
create or replace function public.mod_list_reports(
  p_status text default 'open',
  p_limit  int  default 50,
  p_cursor text default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lim     int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_parts   text[];
  v_crisk   int;
  v_ccreated timestamptz;
  v_ctid    uuid;
  v_result  jsonb;
begin
  if not (public.feed_is_moderator(auth.uid()) or public.is_admin()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_status not in ('open', 'resolved') then raise exception 'gecersiz_durum'; end if;

  if p_cursor is not null then
    v_parts    := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_crisk    := v_parts[1]::int;
    v_ccreated := to_timestamp((v_parts[2])::bigint / 1e6);
    v_ctid     := v_parts[3]::uuid;
  end if;

  with agg as (
    select cr.target_type, cr.target_id,
           max(cr.risk)::int                                                   as risk,
           min(cr.created_at)                                                  as created_at,
           count(distinct coalesce(cr.reporter_id, '00000000-0000-0000-0000-000000000000'::uuid))::int as report_count,
           min(cr.id)                                                          as rid,
           (array_agg(cr.reason order by cr.risk desc, cr.created_at asc))[1]  as reason
    from public.content_reports cr
    where cr.status = p_status
    group by cr.target_type, cr.target_id
  ),
  pageq as (
    select * from agg
    where p_cursor is null
       or risk < v_crisk
       or (risk = v_crisk and created_at > v_ccreated)
       or (risk = v_crisk and created_at = v_ccreated and target_id > v_ctid)
    order by risk desc, created_at asc, target_id asc
    limit v_lim
  ),
  built as (
    select pg.risk, pg.created_at, pg.target_id,
      jsonb_build_object(
        'id',           pg.rid,
        'target_type',  pg.target_type,
        'target_id',    pg.target_id,
        'reason',       pg.reason,
        'risk',         pg.risk,
        'report_count', pg.report_count,
        'created_at',   pg.created_at,
        'age_minutes',  floor(extract(epoch from (now() - pg.created_at)) / 60)::int,
        'preview', case pg.target_type
          when 'post' then (
            select jsonb_build_object(
              'text', left(p.body, 200),
              'photo', (select m.url from public.post_media m
                         where m.post_id = p.id order by m.sort, m.id limit 1))
            from public.posts p where p.id = pg.target_id)
          when 'comment' then (
            select jsonb_build_object('text', left(c.body, 200), 'photo', null)
            from public.post_comments c where c.id = pg.target_id)
          when 'day_card' then (
            select jsonb_build_object('text', mc.name, 'photo', mc.photo_path)
            from public.day_shares ds
            join public.meal_consumptions mc on mc.id = ds.consumption_id
            where ds.id = pg.target_id)
          when 'user' then (
            select jsonb_build_object('text',
              '@' || coalesce(pr.handle, left(pg.target_id::text, 8)))
            from public.profiles pr where pr.id = pg.target_id)
          else null end
      ) as item
    from pageq pg
  ),
  aggr as (
    select jsonb_agg(item order by risk desc, created_at asc, target_id asc) as arr,
           count(*)::int as n
    from built
  ),
  nxt as (
    select encode(convert_to(
             risk::text || '|' ||
             (extract(epoch from created_at) * 1e6)::bigint::text || '|' ||
             target_id::text, 'utf8'), 'base64') as c
    from built
    order by risk asc, created_at desc, target_id desc
    limit 1
  )
  select jsonb_build_object(
    'items', coalesce(aggr.arr, '[]'::jsonb),
    'next_cursor', case when aggr.n = v_lim then nxt.c else null end
  )
  into v_result
  from aggr left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null));
end;
$$;

-- mod_resolve_report: g6_fixes gövdesi + 'comment' remove dalı.
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

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'day_card' then
      update public.day_shares set expires_at = now() - interval '1 second' where id = r.target_id;
    end if;
    -- 'user' hedefi için remove içerik silmez; şikayetler kapatılır + kayıt tutulur.
  end if;

  update public.content_reports
     set status = 'resolved'
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.moderation_actions (actor_id, report_id, target_type, target_id, action, reason)
  values (v_uid, r.id, r.target_type, r.target_id, p_action, left(p_reason, 500));

  return jsonb_build_object('ok', true);
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 14) Panel RPC'leri (yalnız admin_allowlist) — G7-S2 bulgusu.
-- ═════════════════════════════════════════════════════════════════════════════
-- admin_list_posts → sayfalı gönderi listesi. İmleç (created_at, id) desc.
create or replace function public.admin_list_posts(
  p_author uuid default null,
  p_status text default null,
  p_cursor text default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lim     int := 30;
  v_parts   text[];
  v_cur_ts  timestamptz;
  v_cur_id  uuid;
  v_result  jsonb;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending', 'published', 'hidden', 'removed') then
    raise exception 'gecersiz_durum';
  end if;

  if p_cursor is not null then
    v_parts  := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');
    v_cur_ts := to_timestamp((v_parts[1])::bigint / 1e6);
    v_cur_id := v_parts[2]::uuid;
  end if;

  with pageq as (
    select p.* from public.posts p
    where (p_author is null or p.author_id = p_author)
      and (p_status is null or p.status = p_status)
      and (p_cursor is null or (p.created_at, p.id) < (v_cur_ts, v_cur_id))
    order by p.created_at desc, p.id desc
    limit v_lim
  ),
  rows as (
    select p.created_at, p.id,
      jsonb_build_object(
        'id', p.id,
        'author', jsonb_build_object(
          'id', p.author_id,
          'display_name', coalesce(
            pr.full_name,
            nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
            pr.handle, 'Kcalculate'),
          'handle', pr.handle),
        'post_type', p.post_type,
        'body_preview', left(p.body, 140),
        'status', p.status,
        'published_at', p.published_at,
        'created_at', p.created_at,
        'media_count', (select count(*) from public.post_media m where m.post_id = p.id)
      ) as item
    from pageq p
    left join public.profiles pr on pr.id = p.author_id
  ),
  agg as (
    select jsonb_agg(item order by created_at desc, id desc) as arr, count(*)::int as n from rows
  ),
  nxt as (
    select encode(convert_to(
             (extract(epoch from created_at) * 1e6)::bigint::text || '|' || id::text,
             'utf8'), 'base64') as c
    from rows order by created_at asc, id asc limit 1
  )
  select jsonb_build_object(
    'items', coalesce(agg.arr, '[]'::jsonb),
    'next_cursor', case when agg.n = v_lim then nxt.c else null end
  ) into v_result
  from agg left join nxt on true;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null));
end;
$$;

-- admin_delete_draft_post → {ok}. YALNIZ planlı (published_at > now()) ya da
-- 'pending' gönderiyi siler (status=removed). Yayındakini SİLMEZ — o şikayet
-- kuyruğundan (mod_resolve_report) kaldırılır.
create or replace function public.admin_delete_draft_post(p_post uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.posts%rowtype;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select * into r from public.posts where id = p_post;
  if not found then raise exception 'bulunamadi' using errcode = '42501'; end if;

  if not (r.status = 'pending' or (r.status = 'published' and r.published_at > now())) then
    raise exception 'yayindaki_gonderi_silinmez';  -- şikayet kuyruğundan kaldırılır
  end if;

  update public.posts set status = 'removed' where id = p_post;
  return jsonb_build_object('ok', true);
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 15) Storage: post-media video + kesfet_paylasim yazma politikası
-- ═════════════════════════════════════════════════════════════════════════════
-- Kova: görsel türleri + video (mp4/mov), boyut ≤ 50 MB (video tavanı; görsel
-- boyutu istemcide sınırlanır). Yol: posts/{uid}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true, 52428800,          -- 50 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = true;

-- Yazma: kendi klasörüne (posts/{uid}/...) ve (kesfet_paylasim AÇIK → herkes;
-- KAPALI → yalnız creators.can_post).
drop policy if exists post_media_creator_insert on storage.objects;
drop policy if exists post_media_writer_insert  on storage.objects;
create policy post_media_writer_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );

drop policy if exists post_media_creator_update on storage.objects;
drop policy if exists post_media_writer_update  on storage.objects;
create policy post_media_writer_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );

drop policy if exists post_media_creator_delete on storage.objects;
drop policy if exists post_media_writer_delete  on storage.objects;
create policy post_media_writer_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_flag_enabled('kesfet_paylasim') or public.feed_can_post(auth.uid()))
  );
-- Okuma politikası (post_media_read, public) G5'ten AYNEN kalır.

-- ═════════════════════════════════════════════════════════════════════════════
-- 16) EXECUTE yetkileri — anon kapalı; yalnız authenticated. Yardımcılar (definer
--     içinden çağrılanlar: activity_kcal, feed_flag_enabled, social_notify)
--     authenticated'a verilmez; tetikleyici fonksiyonları da verilmez.
-- ═════════════════════════════════════════════════════════════════════════════
-- feed_flag_enabled authenticated'a GRANT edilir: storage.objects RLS politikaları
-- (post_media_writer_*) çağıran rol (authenticated) ile değerlendirir → EXECUTE şart.
-- Sızıntı yok: yalnız feature_flags.enabled okur (zaten authenticated okuyabilir).
revoke all on function public.feed_flag_enabled(text)                                from public, anon;
grant  execute on function public.feed_flag_enabled(text)                            to authenticated;
revoke all on function public.activity_kcal(text, numeric, numeric)                  from public, anon, authenticated;
revoke all on function public.social_notify(uuid, uuid, text, uuid, uuid)            from public, anon, authenticated;

revoke all on function public.create_post(text, text, text, jsonb, jsonb, jsonb, text) from public, anon;
revoke all on function public.delete_my_post(uuid)                                   from public, anon;
revoke all on function public.add_comment(uuid, text, uuid, text)                    from public, anon;
revoke all on function public.list_comments(uuid, text, int)                         from public, anon;
revoke all on function public.delete_my_comment(uuid)                                from public, anon;
revoke all on function public.did_it(uuid, numeric, text)                            from public, anon;
revoke all on function public.log_activity(text, numeric, numeric, text, text)       from public, anon;
revoke all on function public.get_my_day_activity(date)                              from public, anon;
revoke all on function public.list_social_notifications(text, int)                   from public, anon;
revoke all on function public.mark_social_notifications_read(timestamptz)            from public, anon;
revoke all on function public.get_feed(text, text, text, int)                        from public, anon;
revoke all on function public.mod_list_reports(text, int, text)                      from public, anon;
revoke all on function public.mod_resolve_report(bigint, text, text)                 from public, anon;
revoke all on function public.admin_list_posts(uuid, text, text)                     from public, anon;
revoke all on function public.admin_delete_draft_post(uuid)                          from public, anon;

grant execute on function public.create_post(text, text, text, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.delete_my_post(uuid)                                to authenticated;
grant execute on function public.add_comment(uuid, text, uuid, text)                 to authenticated;
grant execute on function public.list_comments(uuid, text, int)                      to authenticated;
grant execute on function public.delete_my_comment(uuid)                             to authenticated;
grant execute on function public.did_it(uuid, numeric, text)                         to authenticated;
grant execute on function public.log_activity(text, numeric, numeric, text, text)    to authenticated;
grant execute on function public.get_my_day_activity(date)                           to authenticated;
grant execute on function public.list_social_notifications(text, int)                to authenticated;
grant execute on function public.mark_social_notifications_read(timestamptz)         to authenticated;
grant execute on function public.get_feed(text, text, text, int)                     to authenticated;
grant execute on function public.mod_list_reports(text, int, text)                   to authenticated;
grant execute on function public.mod_resolve_report(bigint, text, text)              to authenticated;
grant execute on function public.admin_list_posts(uuid, text, text)                  to authenticated;
grant execute on function public.admin_delete_draft_post(uuid)                       to authenticated;

commit;
