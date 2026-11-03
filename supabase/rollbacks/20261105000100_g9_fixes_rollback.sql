-- GERİ ALMA — 20261105000100_g9_fixes.sql. Her nesne G9 ÖNCESİ (g8_social/g7_fixes/
-- g6_fixes) tanımına döndürülür. Bu dosya G6-APPLY listesinden UYGULANMAZ; yalnız
-- geri alma gerekirse elle çalıştırılır. İstemci değişiklikleri (media.ts bucket,
-- handle.ts MAX, activity.ts MET) ayrıca git ile geri alınır — bu SQL kapsamı dışı.

begin;

-- 3a geri: post-media yazma politikaları yalnız feed_can_post (bayrak koşulu kalkar).
drop policy if exists post_media_creator_insert on storage.objects;
create policy post_media_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );

drop policy if exists post_media_creator_update on storage.objects;
create policy post_media_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );

drop policy if exists post_media_creator_delete on storage.objects;
create policy post_media_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.feed_can_post(auth.uid())
  );

-- 3b geri: EK user-media SELECT politikası kalkar; get_day_cards is_private kapısına döner.
drop policy if exists "user_media_select_day_share" on storage.objects;

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

-- 3c geri: posts guard trigger + fonksiyon kalkar; delete_my_post bayraksız sürüme döner.
drop trigger if exists posts_guard_protected_cols on public.posts;
drop function if exists public.posts_guard_protected_cols();

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

-- 3d geri: handle CHECK + claim_handle + check_handle eski regex '^[a-z0-9_]{3,30}$'.
alter table public.profiles drop constraint if exists profiles_handle_format_chk;
alter table public.profiles
  add constraint profiles_handle_format_chk
    check (handle is null or handle ~ '^[a-z0-9_]{3,30}$') not valid;

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
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    return jsonb_build_object('ok', false, 'reason', 'format');
  end if;

  select handle into v_current from public.profiles where id = v_uid;
  if v_current is not distinct from v_handle then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;

  if exists (select 1 from public.profiles where handle = v_handle and id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;

  perform set_config('app.profile_rpc', 'on', true);
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
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    return jsonb_build_object('available', false, 'reason', 'format');
  end if;
  if exists (select 1 from public.profiles where handle = v_handle and id <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  return jsonb_build_object('available', true, 'reason', null);
end;
$$;

-- 3e geri: admin_create_post normalize bloğu olmadan (g7_fixes sürümü).
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

-- 3f geri: mod_resolve_report dismiss→published ve bayrak olmadan (g8_social sürümü).
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
  end if;

  update public.content_reports
     set status = 'resolved'
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into public.moderation_actions (actor_id, report_id, target_type, target_id, action, reason)
  values (v_uid, r.id, r.target_type, r.target_id, p_action, left(p_reason, 500));

  return jsonb_build_object('ok', true);
end;
$$;

-- 3g geri: add_comment bayrak kapısı olmadan (g8_social sürümü).
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

-- 3h geri: get_user_day_progress yetki kapısı olmadan (g6_fixes sürümü); eski revoke.
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

revoke all on function public.get_user_day_progress(uuid) from public, anon;

-- 3j: CHECK'ler zaten g8_social'de comment+ai idi → geri alınacak bir şey yok
--     (g8_social sürümü aynen korunur). Bilerek boş bırakıldı.

commit;
