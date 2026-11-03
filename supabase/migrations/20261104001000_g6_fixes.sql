-- G6-S1 — Entegrasyon düzeltmeleri (G6-CONTRACT.md).
-- version: 20261104001000  name: g6_fixes
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı, staging'de test edilmedi (gece kuralı).
-- Geri alma: supabase/rollbacks/20261104001000_g6_fixes_rollback.sql
--
-- Bu migration, G5 oturumlarının (feed-backend/day-rings) bıraktığı sunucu
-- boşluklarını kapatır ve G6-CONTRACT.md imzalarına hizalar. Çalışma sırası:
-- bu dosya migrations'ın SONUNCUSU (001000); feed tabloları (000200), feed
-- RPC'leri (000300), g5 RPC'leri (000800) zaten tanımlı olmalı.
--
-- İçerik:
--   1) check_handle          — SALT OKUR benzersizlik kontrolü (rezervasyon YOK)
--   2) set_profile_privacy   — gizli/açık + gizliden açığa geçişte istekleri onayla
--   3) get_public_profile    — GERÇEK sayaçlar (follows/posts) + verified (creators)
--   4) get_day_rings         — takip edilenlerin halkaları (gizlilik + engel süzülür)
--   5) check_delivery_city   — dönüş biçimi {ok, reason} (istemci tipi ile birebir)
--   6) content_reports       — status open/resolved + risk; report_content hizalanır
--   7) moderation_actions    — moderasyon kaydı + RLS
--   8) mod_list_reports / mod_resolve_report — moderatör kuyruğu + müdahale
--
-- claim_handle: G5'teki tanım zaten idempotent (kullanıcı kendi handle'ını tekrar
--   isterse `id <> v_uid` taken kontrolü eşleşmez → ok döner). Yeniden tanımlanmadı.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) check_handle(p_handle) → { available boolean, reason text|null }
--    SALT OKUR: hiçbir satır yazmaz/rezerve etmez. reason: 'format'|'reserved'|'taken'
--    (available=true ise reason=null). Canlı (debounce) kullanıcı adı denetimi için;
--    nihai sahiplenme claim_handle ile yapılır.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.check_handle(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
begin
  if v_uid is null then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    return jsonb_build_object('available', false, 'reason', 'format');
  end if;
  if v_handle in ('admin','administrator','kcal','kcalculate','eatkcal','support',
                  'destek','root','null','system','moderator','help') then
    return jsonb_build_object('available', false, 'reason', 'reserved');
  end if;
  -- Kendi handle'ı → müsait (idempotent yeniden sahiplenme).
  if exists (select 1 from public.profiles
             where lower(handle) = v_handle and id <> v_uid) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2) set_profile_privacy(p_is_private) → { is_private }
--    Gizliden AÇIĞA geçişte bekleyen takip istekleri otomatik onaylanır
--    (Instagram davranışı): follow_requests → follows, sonra temizlenir.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.set_profile_privacy(p_is_private boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_was     boolean;
begin
  if v_uid is null then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select coalesce(is_private, false) into v_was from public.profiles where id = v_uid;

  update public.profiles set is_private = coalesce(p_is_private, false) where id = v_uid;

  -- Gizli → Açık: bekleyen tüm istekleri onaya çevir (engelliler hariç).
  if coalesce(v_was, false) = true and coalesce(p_is_private, false) = false then
    insert into public.follows (follower_id, following_id)
    select fr.requester_id, fr.target_id
      from public.follow_requests fr
     where fr.target_id = v_uid
       and not public.feed_is_blocked(fr.requester_id, v_uid)
    on conflict do nothing;
    delete from public.follow_requests where target_id = v_uid;
  end if;

  return jsonb_build_object('is_private', coalesce(p_is_private, false));
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3) get_public_profile(p_handle) → gerçek sayaçlar + verified + me_following/requested
--    me_following: istemci tipi (profil/types.ts) ENUM bekler → 'following'|'requested'|'none'
--    (sözleşmede bool; istemci enum kullandığı için enum döndürülür — bkz. LOG).
--    me_requested: bool (G6-CONTRACT). verified = creators.verified_at is not null.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_public_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles%rowtype;
  v_following boolean;
  v_requested boolean;
  v_me text;
begin
  select * into p from public.profiles
   where lower(handle) = lower(btrim(coalesce(p_handle, '')));
  if not found then
    return null;
  end if;

  v_following := v_uid is not null and exists (
    select 1 from public.follows where follower_id = v_uid and following_id = p.id);
  v_requested := v_uid is not null and exists (
    select 1 from public.follow_requests where requester_id = v_uid and target_id = p.id);
  v_me := case when v_following then 'following'
               when v_requested then 'requested'
               else 'none' end;

  return jsonb_build_object(
    'id',           p.id,
    'display_name', p.full_name,
    'handle',       p.handle,
    'avatar_url',   p.avatar_url,
    'bio',          p.bio,
    'role',         p.role,
    'verified',     exists (select 1 from public.creators c
                            where c.user_id = p.id and c.verified_at is not null),
    'is_private',   coalesce(p.is_private, false),
    'followers',    (select count(*)::int from public.follows where following_id = p.id),
    'following',    (select count(*)::int from public.follows where follower_id  = p.id),
    'posts',        (select count(*)::int from public.posts
                      where author_id = p.id and status = 'published'),
    'me_following', v_me,
    'me_requested', v_requested
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4) Gün halkası — yardımcı + get_day_rings (takip edilenler dahil)
-- ════════════════════════════════════════════════════════════════════════════
-- Yardımcı: bir kullanıcının bugünkü ilerleme/streak/has_new değerleri.
-- GÜVENLİK: authenticated'a GRANT EDİLMEZ (başkasının ilerlemesini sızdırmasın);
-- yalnız get_day_rings (definer, owner) içinden çağrılır — gizlilik orada süzülür.
create or replace function public.get_user_day_progress(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today  date := (now() at time zone 'Europe/Istanbul')::date;
  v_target numeric;
  v_cal    numeric;
  v_prog   numeric := 0;
  v_streak integer := 0;
  v_day    date;
  v_hasnew boolean;
begin
  select coalesce(
           nullif(case when use_custom_macros then custom_calories else target_calories end, 0),
           nullif(target_calories, 0)
         )::numeric
    into v_target
    from public.user_nutrition_profiles
   where user_id = p_uid;

  select coalesce(sum(calories), 0)::numeric
    into v_cal
    from public.meal_consumptions
   where user_id = p_uid
     and (consumed_at at time zone 'Europe/Istanbul')::date = v_today;

  if v_target is not null and v_target > 0 then
    v_prog := least(1.0, round(v_cal / v_target, 4));
  end if;

  v_day := v_today;
  if not exists (select 1 from public.meal_consumptions
                 where user_id = p_uid
                   and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
    v_day := v_today - 1;
  end if;
  loop
    if exists (select 1 from public.meal_consumptions
               where user_id = p_uid
                 and (consumed_at at time zone 'Europe/Istanbul')::date = v_day) then
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  v_hasnew := exists (select 1 from public.day_shares
                      where user_id = p_uid and expires_at > now());

  return jsonb_build_object('progress', v_prog, 'streak', v_streak, 'has_new', v_hasnew);
end;
$$;

-- get_day_rings() → [{ user:{id,display_name,avatar_url}, progress, streak, has_new }]
--   İlk öğe = ben. Sonra: TAKİP ETTİĞİM ve son 24 saatte day_shares kaydı olan
--   kullanıcılar; çift yönlü engel süzülür; en yeni paylaşım önce.
create or replace function public.get_day_rings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_me   public.profiles%rowtype;
  v_mine jsonb;
  v_rest jsonb;
begin
  if v_uid is null then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = v_uid;

  v_mine := jsonb_build_object(
    'user', jsonb_build_object(
      'id',           v_me.id,
      'display_name', v_me.full_name,
      'avatar_url',   v_me.avatar_url
    )
  ) || public.get_user_day_progress(v_uid);

  select coalesce(jsonb_agg(ring order by last_share desc), '[]'::jsonb)
    into v_rest
  from (
    select
      jsonb_build_object(
        'user', jsonb_build_object(
          'id',           pr.id,
          'display_name', pr.full_name,
          'avatar_url',   pr.avatar_url
        )
      ) || public.get_user_day_progress(f.following_id) as ring,
      max(ds.created_at) as last_share
    from public.follows f
    join public.day_shares ds
      on ds.user_id = f.following_id and ds.expires_at > now()
    join public.profiles pr on pr.id = f.following_id
    where f.follower_id = v_uid
      and not public.feed_is_blocked(v_uid, f.following_id)
    group by pr.id, pr.full_name, pr.avatar_url, f.following_id
  ) s;

  return jsonb_build_array(v_mine) || v_rest;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5) check_delivery_city(p_city) → { ok boolean, reason text|null }
--    İstemci tipi (profil/types.ts DeliveryCityResult) {ok, reason} bekler;
--    G5'te {ok, message} dönüyordu → hizalanır. reason: null (ok) | 'not_izmir'.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.check_delivery_city(p_city text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_norm text;
begin
  v_norm := lower(replace(replace(replace(btrim(coalesce(p_city, '')),
                                          'İ', 'i'), 'I', 'i'), 'ı', 'i'));
  if v_norm = 'izmir' then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'not_izmir');
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6) content_reports: status open/resolved + risk; report_content hizalanır
-- ════════════════════════════════════════════════════════════════════════════
-- feed_tables content_reports.status'u ('pending'|'reviewed'|'dismissed'|'actioned')
-- default 'pending' tanımladı; G6-CONTRACT ('open'|'resolved') default 'open' ister.
-- Uzlaştırılır (henüz hiçbir yere uygulanmadığı için veri taşıma güvenli/boş).
alter table public.content_reports
  drop constraint if exists content_reports_status_check;
update public.content_reports
   set status = case when status = 'pending' then 'open' else 'resolved' end
 where status not in ('open', 'resolved');
alter table public.content_reports
  alter column status set default 'open';
alter table public.content_reports
  add constraint content_reports_status_check check (status in ('open', 'resolved'));

-- risk smallint (0–3), reason'dan türetilir.
alter table public.content_reports
  add column if not exists risk smallint not null default 0;

-- Risk eşlemesi (serbest metin reason → 0–3). Eşleme LOG'da da belgelenir.
--   3: can güvenliği / istismar / şiddet-tehdit  (csae, child, self_harm, intihar, siddet, violence, threat, tehdit, weapon)
--   2: cinsel içerik / nefret söylemi            (nudity, sexual, cinsel, porn, hate, nefret)
--   1: taciz / zorbalık                           (harassment, taciz, bully, zorbalik, abuse)
--   0: spam / yanıltıcı / diğer                   (spam, scam, misinfo, diger, other, default)
create or replace function public.content_report_risk(p_reason text)
returns smallint
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_reason, '')) ~ 'csae|child|self.?harm|intihar|suicide|siddet|violence|threat|tehdit|weapon|silah' then 3::smallint
    when lower(coalesce(p_reason, '')) ~ 'nudity|sexual|cinsel|porn|hate|nefret' then 2::smallint
    when lower(coalesce(p_reason, '')) ~ 'harass|taciz|bully|zorbalik|abuse' then 1::smallint
    else 0::smallint
  end;
$$;

-- report_content: status='open' + risk hesapla (feed_rpcs'teki 'pending' sürümünün
-- üzerine yazar; imza aynı).
create or replace function public.report_content(p_target_type text, p_target uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_risk smallint;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_target_type not in ('post', 'user', 'day_card') then raise exception 'gecersiz_hedef'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  v_risk := public.content_report_risk(p_reason);

  insert into public.content_reports (reporter_id, target_type, target_id, reason, status, risk)
  values (v_uid, p_target_type, p_target, left(p_reason, 500), 'open', v_risk)
  on conflict (reporter_id, target_type, target_id)
  do update set reason = excluded.reason, created_at = now(), status = 'open', risk = excluded.risk;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7) moderation_actions — moderasyon müdahale kaydı
--    Yalnız moderatör/admin OKUR; kimse doğrudan YAZMAZ (RPC definer yazar).
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.moderation_actions (
  id          bigserial   primary key,
  actor_id    uuid        not null references auth.users(id) on delete cascade,
  report_id   bigint      references public.content_reports(id) on delete set null,
  target_type text        not null check (target_type in ('post', 'user', 'day_card')),
  target_id   uuid        not null,
  action      text        not null check (action in ('remove', 'warn', 'dismiss')),
  reason      text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);

alter table public.moderation_actions enable row level security;
-- Okuma yalnız moderatör/admin. INSERT/UPDATE/DELETE için politika YOK → normal
-- kullanıcı yazamaz; yalnız SECURITY DEFINER RPC (owner) yazar.
drop policy if exists moderation_actions_mod_select on public.moderation_actions;
create policy moderation_actions_mod_select on public.moderation_actions
  for select to authenticated
  using (public.feed_is_moderator(auth.uid()) or public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 8) mod_list_reports / mod_resolve_report
-- ════════════════════════════════════════════════════════════════════════════
-- mod_list_reports(p_status='open', p_limit=50, p_cursor=null)
--   → { items:[{id, target_type, target_id, reason, risk, report_count,
--               created_at, age_minutes, preview}], next_cursor }
--   Hedef bazında grupla; sıra: risk desc → created_at asc. report_count = farklı
--   şikayetçi sayısı. created_at = en eski açık şikayet. id = temsili (en eski) rapor id.
--   preview: post → {text(≤200), photo}; day_card → {text(ad), photo}; user → {text:@handle}.
create or replace function public.mod_list_reports(
  p_status text default 'open',
  p_limit  int  default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
           count(distinct cr.reporter_id)::int                                 as report_count,
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

-- mod_resolve_report(p_report bigint, p_action, p_reason) → { ok }
--   NOT: G6-CONTRACT p_report'u uuid yazar; ancak content_reports.id BIGSERIAL
--   (feed_tables) → bigint kullanıldı (bkz. LOG). p_reason zorunlu.
--   remove: posts.status='removed' / day_shares gizlenir (expires_at geçmişe çekilir);
--   aynı hedefe ait TÜM açık şikayetler 'resolved' olur. Her çağrı moderation_actions'a yazar.
create or replace function public.mod_resolve_report(
  p_report bigint,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
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

-- ════════════════════════════════════════════════════════════════════════════
-- 9) ai_scan_reservations: 'consumed' durumu (analyze-ai-scan edge function)
-- ════════════════════════════════════════════════════════════════════════════
-- Edge function başarılı analizde rezervasyonu 'consumed' yapar (G6-CONTRACT §AI);
-- hatada 'reserved' kalır → istemci release_ai_scan çağırır. G5'te status yalnız
-- ('reserved','released') idi; 'consumed' eklenir. "reservation_id" = idempotency_key
-- (sistemde rezervasyon kimliği budur; ayrı uuid yok — bkz. LOG).
alter table public.ai_scan_reservations
  drop constraint if exists ai_scan_reservations_status_check;
alter table public.ai_scan_reservations
  add constraint ai_scan_reservations_status_check
    check (status in ('reserved', 'released', 'consumed'));

-- ── Yetkiler ─────────────────────────────────────────────────────────────────
-- Yeni/yeniden tanımlanan fonksiyonlar: anon kapalı, yalnız authenticated.
-- get_user_day_progress ve content_report_risk BİLEREK authenticated'a verilmez
-- (yalnız definer RPC'ler içinden çağrılır — başkasının verisi/iç mantık sızmasın).
revoke all on function public.check_handle(text)                          from public, anon;
revoke all on function public.set_profile_privacy(boolean)                from public, anon;
revoke all on function public.get_user_day_progress(uuid)                 from public, anon;
revoke all on function public.content_report_risk(text)                   from public, anon;
revoke all on function public.mod_list_reports(text, int, text)           from public, anon;
revoke all on function public.mod_resolve_report(bigint, text, text)      from public, anon;

grant execute on function public.check_handle(text)                       to authenticated;
grant execute on function public.set_profile_privacy(boolean)             to authenticated;
grant execute on function public.get_public_profile(text)                 to authenticated;
grant execute on function public.get_day_rings()                          to authenticated;
grant execute on function public.check_delivery_city(text)                to authenticated;
grant execute on function public.report_content(text, uuid, text)         to authenticated;
grant execute on function public.mod_list_reports(text, int, text)        to authenticated;
grant execute on function public.mod_resolve_report(bigint, text, text)   to authenticated;

commit;
