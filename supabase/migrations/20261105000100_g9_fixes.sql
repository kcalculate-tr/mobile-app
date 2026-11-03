-- G9-S1 — Dondurma adayı düzeltmeleri (3a–3j). Tek migration.
-- version: 20261105000100  name: g9_fixes
--
-- DURUM: YALNIZ DOSYA. Hiçbir yere uygulanmadı (gece kuralı). Geri alma:
--   supabase/rollbacks/20261105000100_g9_fixes_rollback.sql
-- Önkoşul (G6-APPLY sırası): #1–#11 + 20261104002000_g8_social.sql +
--   20261104002100_g8_moderation_cron.sql uygulanmış olmalı. EN SON bu uygulanır.
--
-- Bu dosya aşağıdaki DOĞRULANMIŞ hataları kapatır (G9-S1 görev maddesi 3):
--   a. Gönderi medyası yanlış kovada → istemci post-media'ya çevrildi (media.ts);
--      post-media yazma politikalarına `kesfet_paylasim` bayrağı eklendi ki bayrak
--      açıkken herkes kendi `posts/{uid}/` klasörüne yükleyebilsin.
--   b. Gün kartı fotoğrafı takipçiye açılmıyor → user-media SELECT'e, aktif
--      day_share + görebilen kullanıcı (feed_can_view_author) + moderatör/admin
--      koşullu EK politika; get_day_cards erişimi feed_can_view_author'a geçti.
--   c. Gönderi durumu korunmasız → posts BEFORE UPDATE guard; status/pinned_until/
--      author_id yalnız moderatör/servis/RPC (app.post_rpc bayrağı).
--   d. Kullanıcı adında nokta → sunucu regex + CHECK Instagram kuralına (nokta
--      izinli, başta/sonda yok, ardışık yok, 3–30) güncellendi.
--   e. Karbonhidrat anahtarı → admin_create_post panelden gelen carb_g'yi
--      carbs_g'ye normalize eder (tek ad carbs_g).
--   f. "Yayınla" kararı → mod_resolve_report(dismiss) pending hedefi published yapar.
--   g. Yorum sunucu kapısı → add_comment kesfet_yorum bayrağı kapalıyken reddeder.
--   h. Yetki sızıntısı → get_user_day_progress içine feed_can_view_author kapısı +
--      authenticated'tan revoke (zaten public/anon'dan revoke'luydu) yeniden teyit.
--   i. MET tablosu → istemci activity.ts fitness 5.0 → 6.0 (sunucu kaynak; SQL yok).
--   j. content_reports/moderation_actions/moderation_queue CHECK'leri comment + AI
--      (source='ai') kabul eder — G8-S1'de yapıldı; burada idempotent teyit.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 3a — Gönderi medyası herkese açık `post-media` kovasına yüklenir. İstemci
--      media.ts artık `post-media`/`posts/{uid}/...` kullanıyor. post-media yazma
--      politikaları yalnız creators.can_post'a açıktı; `kesfet_paylasim` açıkken
--      herkes paylaştığı için bayrağı da kabul et (bayrak KAPALIYKEN davranış
--      değişmez: yalnız can_post yazabilir — 1.0.7 ile aynı).
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists post_media_creator_insert on storage.objects;
create policy post_media_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );

drop policy if exists post_media_creator_update on storage.objects;
create policy post_media_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );

drop policy if exists post_media_creator_delete on storage.objects;
create policy post_media_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (public.feed_can_post(auth.uid()) or public.feed_flag_enabled('kesfet_paylasim'))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 3b — Gün kartı fotoğrafı takipçiye açılsın.
--   (1) user-media SELECT'e EK permissive politika: obje adı, süresi geçmemiş bir
--       day_share'in meal_consumptions.photo_path'i ile eşleşiyorsa VE bakan
--       kullanıcı sahibi görebiliyorsa (feed_can_view_author) ya da moderatör/admin
--       ise okunur. Sahibin kendi erişimi (user_media_select_own) aynen durur;
--       politikalar OR'lanır → bayrak-bağımsız, mevcut davranışı daraltmaz.
--   (2) get_day_cards erişim kapısı yalnız is_private'e bakıyordu; engel + takip +
--       gizliliği tek yerde çözen feed_can_view_author'a geçirildi; moderatör/admin
--       panel incelemesi için görebilir.
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "user_media_select_day_share" on storage.objects;
create policy "user_media_select_day_share" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'user-media'
    and exists (
      select 1
        from public.day_shares ds
        join public.meal_consumptions mc on mc.id = ds.consumption_id
       where mc.photo_path = storage.objects.name
         and ds.expires_at > now()
         and (
           public.feed_can_view_author(auth.uid(), ds.user_id)
           or public.feed_is_moderator(auth.uid())
           or public.is_admin()
         )
    )
  );

create or replace function public.get_day_cards(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  -- Erişim: başkasının kartları için engel + takip + gizlilik tek yerde
  -- (feed_can_view_author). Moderatör/admin panel incelemesi için görebilir.
  if p_user <> v_uid then
    if not (
         public.feed_can_view_author(v_uid, p_user)
         or public.feed_is_moderator(v_uid)
         or public.is_admin()
       ) then
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
-- 3c — Gönderi durumu korunsun. posts_update RLS'i yazara UPDATE izni veriyor ama
--      yazar status (kaldırılmışı geri yayınlama / pending'i kendi yayınlama),
--      pinned_until, author_id DEĞİŞTİREMEMELİ. BEFORE UPDATE guard + işlem-yerel
--      app.post_rpc bayrağı (profiles_guard_protected_cols ile aynı desen).
--      Servis rolü (moderate-content edge fn direkt UPDATE) ve rolsüz bağlam
--      (migration/cron/superuser) ile moderatör/admin serbest.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.posts_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims   text := current_setting('request.jwt.claims', true);
  v_role     text := case when v_claims is null or v_claims = '' then null
                          else (v_claims::jsonb ->> 'role') end;
  v_post_rpc boolean := coalesce(current_setting('app.post_rpc', true), '') = 'on';
begin
  -- Servis rolü (edge fn) ve rolsüz bağlam (superuser/migration/cron) serbest.
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;
  -- Moderatör/admin tüm kolonları değiştirebilir (panel + mod_resolve_report).
  if public.feed_is_moderator(auth.uid()) or public.is_admin() then
    return NEW;
  end if;
  -- Yazarın doğrudan UPDATE'i: korunan kolonlar yalnız işlem-yerel bayrakla
  -- (delete_my_post / mod_resolve_report) değişebilir.
  if not v_post_rpc then
    if NEW.status is distinct from OLD.status
       or NEW.pinned_until is distinct from OLD.pinned_until
       or NEW.author_id is distinct from OLD.author_id then
      raise exception 'posts_guard: status/pinned_until/author_id yalnızca moderatör veya ilgili RPC ile değiştirilebilir';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists posts_guard_protected_cols on public.posts;
create trigger posts_guard_protected_cols
  before update on public.posts
  for each row execute function public.posts_guard_protected_cols();

-- delete_my_post — status='removed' değişimi için işlem-yerel bayrağı aç.
create or replace function public.delete_my_post(p_post uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  perform set_config('app.post_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.posts set status = 'removed'
   where id = p_post and author_id = v_uid and status <> 'removed';
  get diagnostics v_n = row_count;
  if v_n = 0 and not exists (select 1 from public.posts where id = p_post and author_id = v_uid) then
    raise exception 'bulunamadi' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3d — Kullanıcı adı Instagram kuralı: [a-z0-9._], 3–30, başta/sonda nokta yok,
--      ardışık nokta yok. Sunucu CHECK (not valid) + claim_handle + check_handle.
--      Regex: '^[a-z0-9_]+(\.[a-z0-9_]+)*$' (nokta yalnız iç, tek tek) + uzunluk
--      char_length 3–30. İstemci handle.ts aynı kuralı uygular (MAX 20→30).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles drop constraint if exists profiles_handle_format_chk;
alter table public.profiles
  add constraint profiles_handle_format_chk
    check (
      handle is null
      or (char_length(handle) between 3 and 30
          and handle ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$')
    ) not valid;

create or replace function public.claim_handle(p_handle text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_handle  text;
  v_current text;
begin
  if v_uid is null then raise exception 'yetkisiz' using errcode = '42501'; end if;
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if char_length(v_handle) < 3 or char_length(v_handle) > 30
     or v_handle !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;

  -- İdempotent: aynı kullanıcı aynı handle'ı tekrar isterse hata verme.
  select handle into v_current from public.profiles where id = v_uid;
  if v_current is not distinct from v_handle then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;

  if exists (select 1 from public.profiles where handle = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  perform set_config('app.profile_rpc', 'on', true); -- yalnız bu işlem boyunca
  update public.profiles set handle = v_handle where id = v_uid;
  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

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
  v_handle := lower(btrim(coalesce(p_handle, '')));
  if char_length(v_handle) < 3 or char_length(v_handle) > 30
     or v_handle !~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$' then
    return jsonb_build_object('available', false, 'reason', 'format');
  end if;
  if exists (select 1 from public.profiles where handle = v_handle and id <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3e — meal_card karbonhidrat anahtarı tek ad: carbs_g. admin_create_post panelden
--      gelen (G7 panel sözleşmesi) carb_g'yi carbs_g'ye normalize eder; mevcut
--      carbs_g varsa ona dokunmaz. Gövde g7_fixes ile birebir; yalnız normalize
--      bloğu eklendi.
-- ════════════════════════════════════════════════════════════════════════════
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
  v_meal jsonb := p_meal_card;
begin
  if not exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_lang not in ('tr', 'en') then raise exception 'gecersiz_dil'; end if;
  if p_body is null or length(trim(p_body)) = 0 then raise exception 'metin_zorunlu'; end if;
  if not exists (select 1 from public.creators c where c.user_id = p_author and c.can_post) then
    raise exception 'yazar_yetkisiz';
  end if;
  if p_media is not null and jsonb_typeof(p_media) = 'array'
     and jsonb_array_length(p_media) > 4 then
    raise exception 'en_fazla_4_gorsel';
  end if;

  -- Panelden gelen carb_g → carbs_g (tek ad). Mevcut carbs_g öncelikli.
  if v_meal is not null and jsonb_typeof(v_meal) = 'object' and (v_meal ? 'carb_g') then
    v_meal := (v_meal - 'carb_g')
      || jsonb_build_object('carbs_g', coalesce(v_meal -> 'carbs_g', v_meal -> 'carb_g'));
  end if;

  insert into public.posts (author_id, lang, body, meal_card, status, published_at)
  values (p_author, p_lang, p_body, v_meal, 'published', coalesce(p_published_at, now()))
  returning id into v_post;

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

-- ════════════════════════════════════════════════════════════════════════════
-- 3f — mod_resolve_report(dismiss): hedef pending gönderi/yorum ise published yap
--      (G8-S4 bulgusu). Gövde g8_social ile birebir; dismiss dalı + işlem-yerel
--      app.post_rpc bayrağı (posts guard için) eklendi.
-- ════════════════════════════════════════════════════════════════════════════
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

  perform set_config('app.post_rpc', 'on', true); -- posts guard: moderatör yayını/kaldırması

  if p_action = 'remove' then
    if r.target_type = 'post' then
      update public.posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'day_card' then
      update public.day_shares set expires_at = now() - interval '1 second' where id = r.target_id;
    end if;
    -- 'user' hedefi için remove içerik silmez; şikayetler kapatılır + kayıt tutulur.
  elsif p_action = 'dismiss' then
    -- "Yayınla" kararı: AI/şikayet beklettiği pending hedefi yayına al.
    if r.target_type = 'post' then
      update public.posts set status = 'published' where id = r.target_id and status = 'pending';
    elsif r.target_type = 'comment' then
      update public.post_comments set status = 'published' where id = r.target_id and status = 'pending';
    end if;
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
-- 3g — add_comment: kesfet_yorum bayrağı KAPALIYKEN reddet (create_post'un
--      kesfet_paylasim kapısıyla aynı mantık). Gövde g8_social ile birebir; yalnız
--      bayrak kapısı eklendi.
-- ════════════════════════════════════════════════════════════════════════════
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
  -- Bayrak kapısı: kesfet_yorum kapalıyken yorum yazılamaz.
  if not public.feed_flag_enabled('kesfet_yorum') then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'metin_zorunlu'; end if;
  if char_length(p_body) > 500 then raise exception 'metin_cok_uzun'; end if;

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

  if coalesce(btrim(p_idempotency_key), '') <> '' then
    select id into v_existing from public.post_comments
     where author_id = v_uid and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object('comment_id', v_existing,
        'status', (select status from public.post_comments where id = v_existing));
    end if;
  end if;

  if p_parent is not null then
    if not exists (
      select 1 from public.post_comments c
      where c.id = p_parent and c.post_id = p_post and c.parent_id is null
        and c.status <> 'removed'
    ) then
      raise exception 'gecersiz_ust_yorum';
    end if;
  end if;

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

-- ════════════════════════════════════════════════════════════════════════════
-- 3h — get_user_day_progress yetki kapısı. Fonksiyon public/anon'dan zaten
--      revoke'luydu (g6_fixes) ve authenticated'a GRANT edilmemişti; yine de
--      SECURITY DEFINER olduğu için savunma amaçlı içine feed_can_view_author
--      kapısı eklenir (get_day_rings kendisi + takip edilenler için çağırır →
--      hepsi görünür, kırılmaz) ve authenticated'tan revoke yeniden teyit edilir.
--      Gövde g6_fixes ile birebir; yalnız baştaki kapı eklendi.
-- ════════════════════════════════════════════════════════════════════════════
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
  -- Yetki kapısı: başkasının ilerlemesi yalnız görebilen kullanıcıya (engel +
  -- takip + gizlilik) ya da moderatör/admin'e.
  if p_uid is distinct from auth.uid()
     and not public.feed_can_view_author(auth.uid(), p_uid)
     and not (public.feed_is_moderator(auth.uid()) or public.is_admin()) then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

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

revoke all on function public.get_user_day_progress(uuid) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3j — content_reports / moderation_actions / moderation_queue CHECK'leri 'comment'
--      hedefini ve AI akışını (content_reports.source='ai') kabul etsin. G8-S1
--      (g8_social) bunları ekledi; burada idempotent teyit (drop if exists + add).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

alter table public.content_reports drop constraint if exists content_reports_source_check;
alter table public.content_reports add  constraint content_reports_source_check
  check (source in ('user', 'ai'));

alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment'));

commit;
