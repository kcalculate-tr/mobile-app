-- G7-S1 — Sürüm düzeltmeleri (G6-CONTRACT.md "G7 ekleri" + test ortamı bulguları)
-- version: 20261104001100  name: g7_fixes
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: supabase/rollbacks/20261104001100_g7_fixes_rollback.sql
-- Önkoşul: #1–#10 (bkz. docs/night/G6-APPLY.md) uygulanmış olmalı; ayrıca
-- `user_nutrition_profiles` tablosu canlıda mevcut olmalı (language sql fonksiyon
-- bağımlılıkları — get_user_day_progress vb.).
--
-- İçindekiler:
--   1) meal_consumptions_source_check: ('manual','pantry','post','ai_scan','day_card')
--   2) creators.role CHECK'ine 'uretici' eklenir (admin_set_creator bunu bekliyor)
--   3) get_day_cards: her kartta carbs_g + fat_g
--   4) add_day_card_to_day: başkasının kartını kendi günlüğüne ekle (source='day_card')
--   5) get_post: tek gönderi (derin bağlantı /p/:postId)
--   6) admin_set_creator / admin_create_post / admin_list_creators (yalnız admin_allowlist)
--   7) profiles_guard_protected_cols: handle + is_private korunur; claim_handle /
--      set_profile_privacy işlem-yerel bayrakla (app.profile_rpc) geçer

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) meal_consumptions_source_check — 'post'/'ai_scan'/'day_card' izinli olmalı
--    (feed add_post_meal_to_day source='post' yazıyor; AI tarama 'ai_scan';
--    gün kartı 'day_card'). Aynı adla drop+add (geriye uyumlu: mevcut değerler
--    'manual'/'pantry' bu kümenin alt kümesi).
--    SORU/UYARI (İLTER): Uygulamadan ÖNCE canlıda
--      select distinct source from public.meal_consumptions;
--    çalıştır. Sonuç bu küme dışında bir değer içeriyorsa (ör. 'order','barcode',
--    'ai'), ADD CONSTRAINT patlar — o durumda aşağıdaki IN listesine o değer(ler)i
--    ekle. Repodaki hiçbir yazıcı bu küme dışında değer üretmiyor (TrackerScreen:
--    pantry/manual; RPC: post; AI tarama: ai_scan; gün kartı: day_card).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.meal_consumptions
  drop constraint if exists meal_consumptions_source_check;
alter table public.meal_consumptions
  add constraint meal_consumptions_source_check
    check (source in ('manual', 'pantry', 'post', 'ai_scan', 'day_card'));

-- ════════════════════════════════════════════════════════════════════════════
-- 2) creators.role — 'uretici' (üretici) rolü eklenir. Aynı adla drop+add;
--    mevcut değerler (kurum/diyetisyen/pt/moderator) korunur (geriye uyumlu).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.creators
  drop constraint if exists creators_role_check;
alter table public.creators
  add constraint creators_role_check
    check (role in ('kurum', 'diyetisyen', 'pt', 'uretici', 'moderator'));

-- ════════════════════════════════════════════════════════════════════════════
-- 3) get_day_cards — her kartta carbs_g + fat_g (G6-CONTRACT "G7 ekleri").
--    Gövde g5_rpcs'teki ile birebir; yalnız iki alan eklendi (mc.carbs, mc.fat).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_day_cards(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_private boolean;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  if p_user <> v_uid then
    select coalesce(is_private, false) into v_private
      from public.profiles where id = p_user;
    if not found then
      return '[]'::jsonb;
    end if;
    if v_private then
      return '[]'::jsonb;
    end if;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',             ds.id,
             'consumption_id', mc.id,
             'name',           mc.name,
             'meal_type',      mc.meal_type,
             'consumed_at',    mc.consumed_at,
             'photo_url',      mc.photo_path,
             'kcal',           mc.calories,
             'protein_g',      mc.protein,
             'carbs_g',        mc.carbs,
             'fat_g',          mc.fat
           ) order by mc.consumed_at desc
         ), '[]'::jsonb)
    into v_result
    from public.day_shares ds
    join public.meal_consumptions mc on mc.id = ds.consumption_id
   where ds.user_id = p_user
     and ds.expires_at > now();

  return v_result;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4) add_day_card_to_day — başkasının paylaştığı gün kartını kendi günlüğüne
--    ekle. Kartı görebilen kullanıcı (gizlilik + engel) ekler; değerler karttaki
--    anlık değerlerin porsiyonla ölçeği; source='day_card', source_ref=idempotency.
--    (p_meal_type sunucu kodu: kahvalti|ogle|aksam|atistirma — istemci çevirir.)
--    p_idempotency_key zorunlu (Postgres default'lu param sonrası default'suz
--    paramı kabul etmez → `default null` + çalışma zamanında reddet).
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.add_day_card_to_day(
  p_card            uuid,
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
  v_ok   boolean;
  v_name text;
  v_mt   text;
  v_cal  int;
  v_pro  numeric;
  v_carb numeric;
  v_fat  numeric;
  v_cid  uuid;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_zorunlu';
  end if;
  if coalesce(p_portion, 1) <= 0 then raise exception 'gecersiz_porsiyon'; end if;
  if p_meal_type not in ('kahvalti', 'ogle', 'aksam', 'atistirma') then
    raise exception 'gecersiz_ogun';
  end if;

  -- Kart (day_shares) + sahibi; görünürlük (gizlilik + engel) ve 24 saat süresi.
  select mc.name, mc.calories, mc.protein, mc.carbs, mc.fat, mc.meal_type,
         public.feed_can_view_author(v_uid, ds.user_id)
    into v_name, v_cal, v_pro, v_carb, v_fat, v_mt, v_ok
  from public.day_shares ds
  join public.meal_consumptions mc on mc.id = ds.consumption_id
  where ds.id = p_card
    and ds.expires_at > now();

  if v_name is null or not coalesce(v_ok, false) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;

  v_cal  := round(coalesce(v_cal, 0) * p_portion)::int;
  v_pro  := round((coalesce(v_pro, 0) * p_portion)::numeric, 2);
  v_carb := round((coalesce(v_carb, 0) * p_portion)::numeric, 2);
  v_fat  := round((coalesce(v_fat, 0) * p_portion)::numeric, 2);

  insert into public.meal_consumptions
    (user_id, source, source_ref, name, meal_type, calories, protein, carbs, fat, consumed_at)
  values
    (v_uid, 'day_card', p_idempotency_key,
     coalesce(v_name, 'Gün kartı'), p_meal_type, v_cal, v_pro, v_carb, v_fat, now())
  on conflict (user_id, source, source_ref) do nothing
  returning id into v_cid;

  if v_cid is null then
    select id into v_cid
    from public.meal_consumptions
    where user_id = v_uid and source = 'day_card' and source_ref = p_idempotency_key;
  end if;

  return jsonb_build_object('consumption_id', v_cid);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5) get_post — tek gönderi (derin bağlantı /p/:postId). Görünürlük (gizlilik +
--    engel) SUNUCUDA; erişilemezse null. Item şekli get_feed ile birebir aynı.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_post(p_post uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item jsonb;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;

  select jsonb_build_object(
    'id', p.id,
    'author', jsonb_build_object(
      'id', p.author_id,
      'display_name', coalesce(
        pr.full_name,
        nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
        pr.handle, 'Kcalculate'),
      'handle', pr.handle,
      'avatar_url', pr.avatar_url,
      'role', cr.role,
      'verified', (cr.verified_at is not null)
    ),
    'published_at', p.published_at,
    'lang', p.lang,
    'body', p.body,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('url', m.url, 'width', m.width, 'height', m.height)
                       order by m.sort, m.id)
      from public.post_media m where m.post_id = p.id
    ), '[]'::jsonb),
    'meal_card', p.meal_card,
    'quote', null::jsonb,
    'thread', null::jsonb,
    'stats', jsonb_build_object(
      'likes', (select count(*) from public.post_reactions r where r.post_id = p.id and r.kind = 'like'),
      'saves', (select count(*) from public.post_reactions r where r.post_id = p.id and r.kind = 'save'),
      'adds',  (select count(*) from public.post_meal_adds a where a.post_id = p.id)
    ),
    'me', jsonb_build_object(
      'liked', exists (select 1 from public.post_reactions r where r.post_id = p.id and r.user_id = v_uid and r.kind = 'like'),
      'saved', exists (select 1 from public.post_reactions r where r.post_id = p.id and r.user_id = v_uid and r.kind = 'save')
    )
  )
  into v_item
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  left join public.creators cr on cr.user_id = p.author_id
  where p.id = p_post
    and p.status = 'published'
    and public.feed_can_view_author(v_uid, p.author_id);

  return v_item; -- bulunamazsa / erişilemezse null
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6) Panel (yalnız admin_allowlist) — creators yönetimi + editoryal gönderi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.admin_set_creator(
  p_user     uuid,
  p_role     text,
  p_can_post boolean,
  p_verified boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_role not in ('kurum', 'diyetisyen', 'pt', 'uretici', 'moderator') then
    raise exception 'gecersiz_rol';
  end if;

  insert into public.creators (user_id, role, can_post, verified_at)
  values (p_user, p_role, coalesce(p_can_post, false),
          case when coalesce(p_verified, false) then now() else null end)
  on conflict (user_id) do update
    set role        = excluded.role,
        can_post    = excluded.can_post,
        verified_at = case when coalesce(p_verified, false)
                           then coalesce(public.creators.verified_at, now())
                           else null end;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_create_post(
  p_author       uuid,
  p_body         text,
  p_lang         text,
  p_media        jsonb,
  p_meal_card    jsonb,
  p_published_at timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_post uuid;
  v_el   jsonb;
  v_i    int := 0;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_lang not in ('tr', 'en') then raise exception 'gecersiz_dil'; end if;
  if p_body is null or length(trim(p_body)) = 0 then raise exception 'metin_zorunlu'; end if;
  -- p_author gönderi yazabilen (creators.can_post) bir hesap olmalı.
  if not exists (select 1 from public.creators c where c.user_id = p_author and c.can_post) then
    raise exception 'yazar_yetkisiz';
  end if;
  if p_media is not null and jsonb_typeof(p_media) = 'array'
     and jsonb_array_length(p_media) > 4 then
    raise exception 'en_fazla_4_gorsel';
  end if;

  insert into public.posts (author_id, lang, body, meal_card, status, published_at)
  values (p_author, p_lang, p_body, p_meal_card, 'published', coalesce(p_published_at, now()))
  returning id into v_post;

  -- p_media = [{path, width, height}] → post_media (url = path; en fazla 4).
  if p_media is not null and jsonb_typeof(p_media) = 'array' then
    for v_el in select * from jsonb_array_elements(p_media) loop
      insert into public.post_media (post_id, url, width, height, sort)
      values (v_post, v_el->>'path',
              nullif(v_el->>'width', '')::int, nullif(v_el->>'height', '')::int, v_i);
      v_i := v_i + 1;
    end loop;
  end if;

  return jsonb_build_object('post_id', v_post);
end;
$$;

create or replace function public.admin_list_creators()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'user_id',      c.user_id,
             'display_name', coalesce(
               pr.full_name,
               nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
               pr.handle, 'Kcalculate'),
             'handle',       pr.handle,
             'role',         c.role,
             'can_post',     c.can_post,
             'verified',     (c.verified_at is not null),
             'post_count',   (select count(*) from public.posts p where p.author_id = c.user_id)
           ) order by c.created_at desc
         ), '[]'::jsonb)
    into v_result
    from public.creators c
    left join public.profiles pr on pr.id = c.user_id;

  return v_result;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7) profiles_guard_protected_cols — handle + is_private de korunan alan olur.
--    Kullanıcı bunları doğrudan UPDATE ile değiştirip claim_handle /
--    set_profile_privacy mantığını atlayamaz. İki RPC işlem-yerel bayrak
--    (app.profile_rpc='on') kurar; guard yalnız o bayrak varken bu iki alanın
--    değişimine izin verir. Mevcut korunan alanlar ve macro_engine istisnası
--    AYNEN korunur; yalnız eklendi.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.profiles_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := case when v_claims is null or v_claims = '' then null
                        else (v_claims::jsonb ->> 'role') end;
  v_priv   boolean;
  v_profile_rpc boolean := coalesce(current_setting('app.profile_rpc', true), '') = 'on';
begin
  if coalesce(current_setting('app.macro_engine', true), '') = 'on' then
    return NEW;
  end if;

  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;

  v_priv := exists (select 1 from admin_allowlist a where a.user_id = auth.uid());
  if v_priv then
    return NEW;
  end if;

  -- handle / is_private yalnız claim_handle / set_profile_privacy içinden
  -- (işlem-yerel bayrak) değişebilir. Bayrak yokken bu iki alan değişirse engelle.
  if not v_profile_rpc then
    if NEW.handle is distinct from OLD.handle
       or NEW.is_private is distinct from OLD.is_private then
      raise exception 'profiles_guard: handle/is_private yalnızca ilgili RPC ile değiştirilebilir';
    end if;
  end if;

  if NEW.role is distinct from OLD.role
     or NEW.macro_balance is distinct from OLD.macro_balance
     or NEW.macro_points is distinct from OLD.macro_points
     or NEW.privileged_until is distinct from OLD.privileged_until
     or NEW.total_macros_purchased is distinct from OLD.total_macros_purchased
     or NEW.branch_id is distinct from OLD.branch_id
     or NEW.payment_customer_key is distinct from OLD.payment_customer_key then
    raise exception 'profiles_guard: bu alanlar yalnızca sunucudan/yönetimden değiştirilebilir';
  end if;

  return NEW;
end;
$function$;

-- claim_handle — handle UPDATE'inden hemen önce işlem-yerel bayrak kurar.
-- Gövde g5_rpcs'teki ile birebir; yalnız set_config satırı eklendi.
create or replace function public.claim_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;
  if v_handle in ('admin','administrator','kcal','kcalculate','eatkcal','support',
                  'destek','root','null','system','moderator','help') then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.profiles
             where lower(handle) = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  perform set_config('app.profile_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.profiles set handle = v_handle where id = v_uid;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

-- set_profile_privacy — is_private UPDATE'inden önce işlem-yerel bayrak kurar.
-- Gövde g6_fixes'teki ile birebir; yalnız set_config satırı eklendi.
create or replace function public.set_profile_privacy(p_is_private boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_was boolean;
begin
  if v_uid is null then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select coalesce(is_private, false) into v_was from public.profiles where id = v_uid;

  perform set_config('app.profile_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.profiles set is_private = coalesce(p_is_private, false) where id = v_uid;

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
-- Grants — yalnız authenticated; anon/public'ten revoke. admin_* içeride
-- admin_allowlist denetler; get_post/add_day_card_to_day authenticated.
-- ════════════════════════════════════════════════════════════════════════════
revoke all on function public.add_day_card_to_day(uuid, text, numeric, text) from public, anon;
revoke all on function public.get_post(uuid)                                  from public, anon;
revoke all on function public.admin_set_creator(uuid, text, boolean, boolean) from public, anon;
revoke all on function public.admin_create_post(uuid, text, text, jsonb, jsonb, timestamptz) from public, anon;
revoke all on function public.admin_list_creators()                           from public, anon;

grant execute on function public.add_day_card_to_day(uuid, text, numeric, text) to authenticated;
grant execute on function public.get_post(uuid)                                 to authenticated;
grant execute on function public.get_day_cards(uuid)                            to authenticated;
grant execute on function public.admin_set_creator(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.admin_create_post(uuid, text, text, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.admin_list_creators()                          to authenticated;

commit;
