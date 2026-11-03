-- GERİ ALMA — 20261105000200_g10_fixes.sql. Her nesne G10 ÖNCESİ (g5_rpcs/g6_fixes/
-- g8_social/g9_fixes) tanımına döndürülür. Bu dosya G6-APPLY listesinden UYGULANMAZ;
-- yalnız geri alma gerekirse elle çalıştırılır. İstemci değişikliği yok (G10 yalnız
-- sunucu/migration).

begin;

-- ── 1 geri: reserve_ai_scan → g5_rpcs tanımı (anahtar araması kullanıcıdan bağımsız).
create or replace function public.reserve_ai_scan(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid    := auth.uid();
  v_today      date    := (now() at time zone 'Europe/Istanbul')::date;
  v_reset      timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_user_limit integer;
  v_global_cap integer;
  v_used       integer;
  v_global     integer;
  v_status     text;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'idempotency_key gerekli';
  end if;

  select coalesce((value::text)::int, 3)
    into v_user_limit from public.app_settings where key = 'ai_scan_user_daily_limit';
  v_user_limit := coalesce(v_user_limit, 3);
  select coalesce((value::text)::int, 1000)
    into v_global_cap from public.app_settings where key = 'ai_scan_daily_cap';
  v_global_cap := coalesce(v_global_cap, 1000);

  select status into v_status
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key;
  if v_status = 'reserved' then
    select coalesce(used, 0) into v_used
      from public.ai_scan_usage where user_id = v_uid and day = v_today;
    return jsonb_build_object('ok', true,
      'remaining', greatest(0, v_user_limit - coalesce(v_used, 0)),
      'reset_at', v_reset);
  end if;

  insert into public.ai_scan_usage (user_id, day, used)
  values (v_uid, v_today, 0)
  on conflict (user_id, day) do nothing;
  select used into v_used
    from public.ai_scan_usage where user_id = v_uid and day = v_today for update;

  if v_used >= v_user_limit then
    return jsonb_build_object('ok', false, 'remaining', 0, 'reset_at', v_reset);
  end if;

  select coalesce(sum(used), 0) into v_global
    from public.ai_scan_usage where day = v_today;
  if v_global >= v_global_cap then
    return jsonb_build_object('ok', false,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  update public.ai_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;

  insert into public.ai_scan_reservations (idempotency_key, user_id, day, status)
  values (p_idempotency_key, v_uid, v_today, 'reserved')
  on conflict (idempotency_key) do update set status = 'reserved';

  return jsonb_build_object('ok', true,
    'remaining', greatest(0, v_user_limit - (v_used + 1)), 'reset_at', v_reset);
end;
$$;

-- ── 2 geri: post_media_read → geniş public SELECT (post_media_storage tanımı).
drop policy if exists post_media_read on storage.objects;
create policy post_media_read on storage.objects
  for select to public
  using (bucket_id = 'post-media');

-- ── 3 geri: report_content → g6_fixes tanımı (görünürlük kapısı/50 sınır/comment yok).
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

-- ── 4 geri: mod_resolve_report → g9_fixes tanımı (moderation_queue 'done' bloğu yok).
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
    end if;
  elsif p_action = 'dismiss' then
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

-- ── 5 geri: post_comments guard trigger + fonksiyon kaldırılır; delete_my_comment
--    g8_social tanımına (set_config'siz) döner.
drop trigger if exists post_comments_guard_protected_cols on public.post_comments;
drop function if exists public.post_comments_guard_protected_cols();

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

-- ── 6 geri: get_user_day_progress → g9_fixes tanımı (kapı auth.uid() NULL guard'ı yok).
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

commit;
