-- Geri alma: 20261110100100_g22_s1_subscriptions.sql
-- 1) reserve_ai_scan G19 gövdesine döner (tek limit: ai_scan_user_daily_limit, vars. 3).
-- 2) reserve_barcode_scan / my_entitlement / yardımcılar silinir.
-- 3) user_entitlements + barkod sayaç tabloları silinir — DİKKAT: abonelik kayıtları
--    kaybolur; RevenueCat yeniden gönderebilir (Dashboard › webhook › resend) ama önce
--    satır sayısını kontrol et: select count(*) from public.user_entitlements;
-- 4) app_settings anahtarları + 'abonelik' bayrağı + olay adları silinir.
begin;

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
  v_owner      uuid;
  v_status     text;
  v_day        date;
  v_has_result boolean;
  v_enabled    boolean;
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
  select coalesce((value #>> '{}')::boolean, true)
    into v_enabled from public.app_settings where key = 'ai_scan_enabled';
  v_enabled := coalesce(v_enabled, true);

  select user_id, status, day, (result is not null)
    into v_owner, v_status, v_day, v_has_result
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key
    for update;
  if found and v_owner is distinct from v_uid then
    raise exception 'baskasinin_anahtari' using errcode = '42501';
  end if;

  select coalesce(used, 0) into v_used
    from public.ai_scan_usage where user_id = v_uid and day = v_today;
  v_used := coalesce(v_used, 0);

  if v_status = 'consumed' and v_has_result then
    return jsonb_build_object('ok', true, 'cached', true,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  if not v_enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  if v_status = 'reserved' and v_day = v_today then
    return jsonb_build_object('ok', true,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  if v_status = 'reserved' and v_day <> v_today then
    update public.ai_scan_usage set used = greatest(0, used - 1)
     where user_id = v_uid and day = v_day;
    update public.ai_scan_reservations set status = 'released'
     where idempotency_key = p_idempotency_key;
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
    return jsonb_build_object('ok', false, 'reason', 'global_cap',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset);
  end if;

  update public.ai_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;

  insert into public.ai_scan_reservations (idempotency_key, user_id, day, status)
  values (p_idempotency_key, v_uid, v_today, 'reserved')
  on conflict (idempotency_key) do update
    set status = 'reserved', day = excluded.day, result = null;

  return jsonb_build_object('ok', true,
    'remaining', greatest(0, v_user_limit - (v_used + 1)), 'reset_at', v_reset);
end;
$$;
revoke all on function public.reserve_ai_scan(text) from public, anon;
grant execute on function public.reserve_ai_scan(text) to authenticated;

drop function if exists public.my_entitlement();
drop function if exists public.reserve_barcode_scan(text);
drop function if exists public._daily_limit(text, text);
drop function if exists public._entitlement_tier(uuid);

drop table if exists public.barcode_scan_log;
drop table if exists public.barcode_scan_usage;
drop table if exists public.user_entitlements;

delete from public.app_settings
 where key in ('ai_daily_free', 'ai_daily_fresh', 'ai_daily_balance', 'barcode_daily_free');
delete from public.feature_flags where key = 'abonelik';

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names
     where name in ('voice_start', 'voice_done', 'voice_empty', 'paywall_view',
                    'sub_purchase', 'sub_restore', 'barcode_limit');
  end if;
end $$;

commit;
