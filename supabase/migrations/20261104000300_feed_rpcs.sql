-- G5-S1 — Keşfet RPC'leri (G5-CONTRACT.md imzalarıyla birebir).
-- Hepsi: security definer, set search_path = public, yalnız authenticated'a grant,
-- auth.uid() ile; engellenen kullanıcıların içeriği her listeden süzülür.
-- Yetki ve kota SUNUCUDA denetlenir (bayrak yetki değildir).
-- NOT: staging'de test EDİLMEDİ — yalnız dosya olarak yazıldı, uygulanmadı.
-- Rollback: 20261104000300_feed_rpcs_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ get_feed — Dalga 1 editoryal akış (yayın zamanına göre, imleç (pin,         ║
-- ║ published_at, id)). 'for_you' = dildeki tüm yayınlar; 'following' = takip +  ║
-- ║ kendi. Sabitlenmişler bitiş tarihine kadar en üstte. Döner {items,next_cursor}║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.get_feed(
  p_tab    text,
  p_lang   text,
  p_cursor text default null,
  p_limit  int  default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    where p.status = 'published'
      and p.lang = p_lang
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
        'media', coalesce((
          select jsonb_agg(jsonb_build_object('url', m.url, 'width', m.width, 'height', m.height)
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
          'adds',  (select count(*) from public.post_meal_adds a where a.post_id = pg.id)
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

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ react_post — like/save aç/kapat; döner {stats, me}                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.react_post(p_post uuid, p_kind text, p_on bool)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_kind not in ('like', 'save') then raise exception 'gecersiz_tepki'; end if;
  if not exists (
    select 1 from public.posts p
    where p.id = p_post and p.status = 'published'
      and public.feed_can_view_author(v_uid, p.author_id)
  ) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  if p_on then
    insert into public.post_reactions (post_id, user_id, kind)
    values (p_post, v_uid, p_kind)
    on conflict do nothing;
  else
    delete from public.post_reactions
    where post_id = p_post and user_id = v_uid and kind = p_kind;
  end if;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'likes', (select count(*) from public.post_reactions where post_id = p_post and kind = 'like'),
      'saves', (select count(*) from public.post_reactions where post_id = p_post and kind = 'save'),
      'adds',  (select count(*) from public.post_meal_adds   where post_id = p_post)
    ),
    'me', jsonb_build_object(
      'liked', exists (select 1 from public.post_reactions where post_id = p_post and user_id = v_uid and kind = 'like'),
      'saved', exists (select 1 from public.post_reactions where post_id = p_post and user_id = v_uid and kind = 'save')
    )
  );
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ add_post_meal_to_day — gönderi öğününü günlüğe yaz (idempotent)             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Porsiyon onaylı; o ANDAKİ besin değerleri saklanır (tahmin değil, kart verisi).
-- source='post', source_ref=p_idempotency_key → meal_consumptions'ın mevcut
-- (user_id, source, source_ref) benzersizliği ile aynı anahtar yeni satır açmaz.
-- NOT: p_idempotency_key zorunludur; Postgres default'lı parametreden sonra
-- default'suz parametreye izin vermediği için SQL'de `default null` verilip
-- çalışma zamanında null reddedilir (sözleşme imzasıyla ad/tür/sıra birebir).
create or replace function public.add_post_meal_to_day(
  p_post            uuid,
  p_meal_type       text,
  p_portion         numeric default 1,
  p_idempotency_key text    default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_mc   jsonb;
  v_ok   boolean;
  v_cid  uuid;
  v_cal  int;
  v_pro  numeric;
  v_carb numeric;
  v_fat  numeric;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_zorunlu';
  end if;
  if coalesce(p_portion, 1) <= 0 then raise exception 'gecersiz_porsiyon'; end if;
  if p_meal_type not in ('kahvalti', 'ogle', 'aksam', 'atistirma') then
    raise exception 'gecersiz_ogun';
  end if;

  select p.meal_card,
         (p.status = 'published' and public.feed_can_view_author(v_uid, p.author_id))
    into v_mc, v_ok
  from public.posts p
  where p.id = p_post;

  if not coalesce(v_ok, false) then raise exception 'bulunamadi' using errcode = '42501'; end if;
  if v_mc is null then raise exception 'ogun_karti_yok'; end if;

  v_cal  := round(coalesce((v_mc->>'kcal')::numeric, 0) * p_portion)::int;
  v_pro  := round((coalesce((v_mc->>'protein_g')::numeric, 0) * p_portion)::numeric, 2);
  v_carb := round((coalesce((v_mc->>'carbs_g')::numeric, 0) * p_portion)::numeric, 2);
  v_fat  := round((coalesce((v_mc->>'fat_g')::numeric, 0) * p_portion)::numeric, 2);

  insert into public.meal_consumptions
    (user_id, source, source_ref, name, meal_type, calories, protein, carbs, fat, consumed_at)
  values
    (v_uid, 'post', p_idempotency_key,
     coalesce(v_mc->>'name', 'Gönderi öğünü'), p_meal_type, v_cal, v_pro, v_carb, v_fat, now())
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_cid;

  if v_cid is null then
    -- Aynı anahtar daha önce yazıldı → mevcut kaydı döndür (yeni satır açma).
    select id into v_cid
    from public.meal_consumptions
    where user_id = v_uid and source = 'post' and source_ref = p_idempotency_key;
  else
    insert into public.post_meal_adds (consumption_id, post_id, user_id, portion)
    values (v_cid, p_post, v_uid, p_portion)
    on conflict (consumption_id) do nothing;
  end if;

  return jsonb_build_object('consumption_id', v_cid);
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ report_content — içerik şikayeti (post/user/day_card)                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.report_content(p_target_type text, p_target uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_target_type not in ('post', 'user', 'day_card') then raise exception 'gecersiz_hedef'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'sebep_zorunlu'; end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (v_uid, p_target_type, p_target, left(p_reason, 500))
  on conflict (reporter_id, target_type, target_id)
  do update set reason = excluded.reason, created_at = now(), status = 'pending';
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ block_user — engelle/kaldır (engelleyince takip/istek çift yönde temizlenir)║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.block_user(p_user uuid, p_on bool)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_user = v_uid then raise exception 'kendini_engelleyemezsin'; end if;

  if p_on then
    insert into public.user_blocks (blocker_id, blocked_id)
    values (v_uid, p_user) on conflict do nothing;
    delete from public.follows
    where (follower_id = v_uid and following_id = p_user)
       or (follower_id = p_user and following_id = v_uid);
    delete from public.follow_requests
    where (requester_id = v_uid and target_id = p_user)
       or (requester_id = p_user and target_id = v_uid);
  else
    delete from public.user_blocks where blocker_id = v_uid and blocked_id = p_user;
  end if;
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ follow — takip et/bırak. Gizli hesaba istek gider. Döner {state}            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.follow(p_user uuid, p_on bool)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_private boolean;
  v_state   text;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_user = v_uid then raise exception 'kendini_takip_edemezsin'; end if;
  if public.feed_is_blocked(v_uid, p_user) then raise exception 'engel_var' using errcode = '42501'; end if;

  if p_on then
    select coalesce(is_private, false) into v_private from public.profiles where id = p_user;
    if coalesce(v_private, false) then
      if exists (select 1 from public.follows where follower_id = v_uid and following_id = p_user) then
        v_state := 'following';                 -- zaten onaylı takip
      else
        insert into public.follow_requests (requester_id, target_id)
        values (v_uid, p_user) on conflict do nothing;
        v_state := 'requested';
      end if;
    else
      insert into public.follows (follower_id, following_id)
      values (v_uid, p_user) on conflict do nothing;
      v_state := 'following';
    end if;
  else
    delete from public.follows where follower_id = v_uid and following_id = p_user;
    delete from public.follow_requests where requester_id = v_uid and target_id = p_user;
    v_state := 'none';
  end if;

  return jsonb_build_object('state', v_state);
end;
$$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ respond_follow_request — bana gelen isteği kabul/ret                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create or replace function public.respond_follow_request(p_requester uuid, p_accept bool)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
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
    insert into public.follows (follower_id, following_id)
    values (p_requester, v_uid) on conflict do nothing;
  end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = v_uid;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- EXECUTE yetkileri: anon kapalı, yalnız authenticated.
-- (Supabase fonksiyon kurulunca EXECUTE'u PUBLIC'e verir; revoke şart.)
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.get_feed(text, text, text, int)            from public, anon;
revoke all on function public.react_post(uuid, text, bool)               from public, anon;
revoke all on function public.add_post_meal_to_day(uuid, text, numeric, text) from public, anon;
revoke all on function public.report_content(text, uuid, text)           from public, anon;
revoke all on function public.block_user(uuid, bool)                     from public, anon;
revoke all on function public.follow(uuid, bool)                         from public, anon;
revoke all on function public.respond_follow_request(uuid, bool)         from public, anon;

grant execute on function public.get_feed(text, text, text, int)            to authenticated;
grant execute on function public.react_post(uuid, text, bool)               to authenticated;
grant execute on function public.add_post_meal_to_day(uuid, text, numeric, text) to authenticated;
grant execute on function public.report_content(text, uuid, text)           to authenticated;
grant execute on function public.block_user(uuid, bool)                     to authenticated;
grant execute on function public.follow(uuid, bool)                         to authenticated;
grant execute on function public.respond_follow_request(uuid, bool)         to authenticated;
