-- ROLLBACK — 20261109190100_g19_ai_scan_hardening
-- reserve_ai_scan G10 sürümüne (20261105000200_g10_fixes.sql §1) döner; G19 sütunları,
-- indeks ve app_settings anahtarları kaldırılır. ÖNCE analyze-ai-scan'in G19 öncesi
-- sürümünü deploy et (G19 edge sütunları yoksa eski davranışa düşer, yine de sıra bu).

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

  select user_id, status into v_owner, v_status
    from public.ai_scan_reservations where idempotency_key = p_idempotency_key;
  if found and v_owner is distinct from v_uid then
    raise exception 'baskasinin_anahtari' using errcode = '42501';
  end if;

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

revoke all on function public.reserve_ai_scan(text) from public, anon;
grant execute on function public.reserve_ai_scan(text) to authenticated;

drop index if exists public.ai_scan_reservations_user_attempt_idx;
alter table public.ai_scan_reservations
  drop column if exists result,
  drop column if exists attempts,
  drop column if exists last_attempt_at;

delete from public.app_settings where key in ('ai_scan_per_minute', 'ai_scan_max_key_attempts', 'ai_scan_enabled');

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('scan_open', 'scan_limit');
  end if;
end $$;

commit;
