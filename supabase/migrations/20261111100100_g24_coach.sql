-- G24-S1 md.2 — kcalAI Koç (yalnız Balance; Free/Fresh 3 deneme) — sunucu.
-- version: 20261111100100  name: g24_coach
--
-- DURUM: UYGULANMADI (yalnız dosya). Geri alma: supabase/rollbacks/20261111100100_g24_coach_rollback.sql
-- İdempotent: tekrar çalıştırmak güvenli.
-- Önkoşul: 20261110100100_g22_s1_subscriptions (_entitlement_tier, user_entitlements),
--          20261109210100_g20_s1_user_consents (user_consents CHECK listeleri).
--
-- 1) coach_messages — sohbet satırları. YAZAN yalnız `coach-chat` edge fonksiyonu (service role).
--    İstemci: kendi satırını OKUR, yalnız `feedback` sütununu GÜNCELLER (Koç yanıtında),
--    kendi satırlarını SİLER. INSERT yetkisi istemci rollerinde YOK.
-- 2) coach_usage (Balance günlük sayaç, gün = Europe/Istanbul, 00.00'da yenilenir — AI tarama
--    hakkıyla aynı saat) + coach_trial_usage (Free/Fresh ömür boyu deneme sayacı) +
--    coach_reservations (model hatasında iade için; release yalnız service role).
-- 3) app_settings: coach_daily_balance=30 · coach_trial_free=3 · coach_per_minute=6 ·
--    coach_retention_days=30 · coach_enabled=true (acil kapatma). on conflict do nothing.
-- 4) reserve_coach_message() · release_coach_message(uuid) · consume_coach_message(uuid) ·
--    my_coach_status() · delete_coach_history().
-- 5) feature_flags 'koc' (KAPALI, min_app_version 1.1.0). Koç native modül istemez → 1.1.0
--    yayınlandıktan sonra OTA ile gelir; bayrak İlter'in kararıyla açılır.
-- 6) user_consents: kind 'ai_coach' + source 'coach' (koç için ayrı AI izni kaydı).
-- 7) analytics_event_names: coach_* olayları (D-S1 sözlüğü varsa).
--
-- SIRA (canlı): bu migration → `supabase functions deploy coach-chat` (secret ANTHROPIC_API_KEY
-- zaten var; isteğe bağlı COACH_MODEL) → bayrak 'koc' (İlter).
begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 — coach_messages
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  body        text not null check (char_length(body) between 1 and 4000),
  cards       jsonb check (cards is null or jsonb_typeof(cards) = 'array'),
  feedback    smallint check (feedback is null or feedback in (-1, 1)),
  created_at  timestamptz not null default now()
);

comment on table public.coach_messages is
  'G24-S1: kcalAI Koç sohbeti. Yazan yalnız coach-chat (service role); kullanıcı kendi satırını okur, feedback günceller, siler.';
comment on column public.coach_messages.cards is
  'Yapılandırılmış kartlar: meal_suggestion{name,kcal,p,c,f} · recipe{post_id} · eatkcal_product{product_id} (yalnız İzmir) · weekly_chart{metric} · safety.';
comment on column public.coach_messages.feedback is '"Bu yanıt yararlı mı?" — 1 yararlı, -1 yararlı değil, NULL yanıt yok.';

create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;

drop policy if exists coach_messages_select_own on public.coach_messages;
create policy coach_messages_select_own on public.coach_messages
  for select to authenticated
  using (user_id = auth.uid());

-- Geri bildirim yalnız Koç yanıtında; sütun yetkisi yalnız `feedback` (aşağıda).
drop policy if exists coach_messages_update_feedback_own on public.coach_messages;
create policy coach_messages_update_feedback_own on public.coach_messages
  for update to authenticated
  using (user_id = auth.uid() and role = 'assistant')
  with check (user_id = auth.uid() and role = 'assistant');

drop policy if exists coach_messages_delete_own on public.coach_messages;
create policy coach_messages_delete_own on public.coach_messages
  for delete to authenticated
  using (user_id = auth.uid());

-- INSERT politikası YOK + yetki geri alınır: satırı yalnız edge fonksiyonu (service role) yazar.
revoke all on public.coach_messages from anon;
revoke insert, update, delete, truncate on public.coach_messages from authenticated;
grant select, delete on public.coach_messages to authenticated;
grant update (feedback) on public.coach_messages to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2 — sayaçlar + rezervasyonlar (yalnız RPC yazar)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  used    integer not null default 0 check (used >= 0),
  primary key (user_id, day)
);
create table if not exists public.coach_trial_usage (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  used       integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.coach_reservations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('daily', 'trial')),
  day        date not null,
  status     text not null default 'reserved' check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now()
);
create index if not exists coach_reservations_user_idx on public.coach_reservations (user_id, created_at desc);

comment on table public.coach_usage is 'G24-S1: Balance günlük Koç mesaj sayacı (gün Europe/Istanbul). Yalnız RPC yazar.';
comment on table public.coach_trial_usage is 'G24-S1: Free/Fresh ömür boyu Koç deneme sayacı. Yalnız RPC yazar.';
comment on table public.coach_reservations is 'G24-S1: model hatasında hak iadesi (release yalnız service role).';

alter table public.coach_usage enable row level security;
alter table public.coach_trial_usage enable row level security;
alter table public.coach_reservations enable row level security;
drop policy if exists coach_usage_select_own on public.coach_usage;
create policy coach_usage_select_own on public.coach_usage
  for select to authenticated using (user_id = auth.uid());
drop policy if exists coach_trial_usage_select_own on public.coach_trial_usage;
create policy coach_trial_usage_select_own on public.coach_trial_usage
  for select to authenticated using (user_id = auth.uid());
revoke all on public.coach_usage from anon;
revoke all on public.coach_trial_usage from anon;
revoke all on public.coach_reservations from anon, authenticated;
revoke insert, update, delete, truncate on public.coach_usage from authenticated;
revoke insert, update, delete, truncate on public.coach_trial_usage from authenticated;
grant select on public.coach_usage to authenticated;
grant select on public.coach_trial_usage to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 — app_settings (kodda sabit yok; istemci/edge yedekleri aynı sayılar)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.app_settings (key, value, description) values
  ('coach_daily_balance',  '30'::jsonb,   'G24-S1: kcalAI Koç — Balance günlük mesaj hakkı (00.00 Europe/Istanbul yenilenir).'),
  ('coach_trial_free',     '3'::jsonb,    'G24-S1: kcalAI Koç — Free/Fresh ömür boyu deneme mesajı.'),
  ('coach_per_minute',     '6'::jsonb,    'G24-S1: kcalAI Koç — kullanıcı başına dakikada en çok mesaj (coach-chat).'),
  ('coach_retention_days', '30'::jsonb,   'G24-S1: kcalAI Koç — sohbet saklama süresi (gün); daha eskisi coach-chat çağrısında silinir.'),
  ('coach_enabled',        'true'::jsonb, 'G24-S1: kcalAI Koç acil kapatma (false → reserve_coach_message reason=disabled).')
on conflict (key) do nothing;

-- Ayar okuma (yoksa varsayılan).
create or replace function public._coach_int_setting(p_key text, p_default integer)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v integer;
begin
  begin
    select (value #>> '{}')::int into v from public.app_settings where key = p_key;
  exception when others then
    v := null;
  end;
  return greatest(0, coalesce(v, p_default));
end;
$$;
revoke all on function public._coach_int_setting(text, integer) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 — RPC'ler
-- ════════════════════════════════════════════════════════════════════════════
-- reserve_coach_message(): çağıranın (auth.uid) hakkından BİR mesaj ayırır.
--   balance → günlük coach_daily_balance (vars. 30), kind 'daily', resets_at = yarın 00.00 İstanbul
--   free/fresh → ömür boyu coach_trial_free (vars. 3), kind 'trial', resets_at NULL
-- Döner: {ok, used, limit, kind, reason, tier, resets_at, reservation_id}
--   reason: null | 'limit' (günlük doldu) | 'trial_used' (deneme bitti) | 'disabled'
create or replace function public.reserve_coach_message()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'Europe/Istanbul')::date;
  v_reset   timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_tier    text;
  v_kind    text;
  v_limit   integer;
  v_used    integer;
  v_enabled boolean;
  v_res     uuid;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  v_tier := public._entitlement_tier(v_uid);
  if v_tier = 'balance' then
    v_kind := 'daily';
    v_limit := public._coach_int_setting('coach_daily_balance', 30);
  else
    v_kind := 'trial';
    v_limit := public._coach_int_setting('coach_trial_free', 3);
  end if;

  begin
    select coalesce((value #>> '{}')::boolean, true) into v_enabled from public.app_settings where key = 'coach_enabled';
  exception when others then
    v_enabled := true;
  end;
  v_enabled := coalesce(v_enabled, true);

  if v_kind = 'daily' then
    insert into public.coach_usage (user_id, day, used) values (v_uid, v_today, 0)
    on conflict (user_id, day) do nothing;
    select used into v_used from public.coach_usage where user_id = v_uid and day = v_today for update;
  else
    insert into public.coach_trial_usage (user_id, used) values (v_uid, 0)
    on conflict (user_id) do nothing;
    select used into v_used from public.coach_trial_usage where user_id = v_uid for update;
  end if;
  v_used := coalesce(v_used, 0);

  if not v_enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled', 'used', v_used, 'limit', v_limit,
      'kind', v_kind, 'tier', v_tier, 'resets_at', case when v_kind = 'daily' then v_reset end);
  end if;
  if v_used >= v_limit then
    return jsonb_build_object('ok', false,
      'reason', case when v_kind = 'daily' then 'limit' else 'trial_used' end,
      'used', v_used, 'limit', v_limit, 'kind', v_kind, 'tier', v_tier,
      'resets_at', case when v_kind = 'daily' then v_reset end);
  end if;

  if v_kind = 'daily' then
    update public.coach_usage set used = used + 1 where user_id = v_uid and day = v_today;
  else
    update public.coach_trial_usage set used = used + 1, updated_at = now() where user_id = v_uid;
  end if;
  insert into public.coach_reservations (user_id, kind, day) values (v_uid, v_kind, v_today)
  returning id into v_res;

  return jsonb_build_object('ok', true, 'reason', null, 'used', v_used + 1, 'limit', v_limit,
    'kind', v_kind, 'tier', v_tier, 'resets_at', case when v_kind = 'daily' then v_reset end,
    'reservation_id', v_res);
end;
$$;
revoke all on function public.reserve_coach_message() from public, anon;
grant execute on function public.reserve_coach_message() to authenticated;

-- release_coach_message(id): model/servis hatasında hakkı geri verir. YALNIZ service role
-- (istemci başarılı mesajdan sonra iade isteyip hakkı sonsuzlaştıramasın). Yalnız 'reserved'.
create or replace function public.release_coach_message(p_reservation uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_reservations%rowtype;
begin
  select * into v_row from public.coach_reservations where id = p_reservation for update;
  if not found or v_row.status <> 'reserved' then
    return false;
  end if;
  if v_row.kind = 'daily' then
    update public.coach_usage set used = greatest(0, used - 1)
     where user_id = v_row.user_id and day = v_row.day;
  else
    update public.coach_trial_usage set used = greatest(0, used - 1), updated_at = now()
     where user_id = v_row.user_id;
  end if;
  update public.coach_reservations set status = 'released' where id = p_reservation;
  return true;
end;
$$;
revoke all on function public.release_coach_message(uuid) from public, anon, authenticated;
grant execute on function public.release_coach_message(uuid) to service_role;

-- consume_coach_message(id): başarılı yanıt → 'consumed' (artık iade edilemez). Yalnız service role.
create or replace function public.consume_coach_message(p_reservation uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.coach_reservations set status = 'consumed'
     where id = p_reservation and status = 'reserved'
    returning 1
  )
  select exists (select 1 from u);
$$;
revoke all on function public.consume_coach_message(uuid) from public, anon, authenticated;
grant execute on function public.consume_coach_message(uuid) to service_role;

-- my_coach_status(): hap için {used, limit, kind, resets_at, tier, remaining}.
create or replace function public.my_coach_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_reset timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_tier  text;
  v_kind  text;
  v_limit integer;
  v_used  integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  v_tier := public._entitlement_tier(v_uid);
  if v_tier = 'balance' then
    v_kind := 'daily';
    v_limit := public._coach_int_setting('coach_daily_balance', 30);
    select used into v_used from public.coach_usage where user_id = v_uid and day = v_today;
  else
    v_kind := 'trial';
    v_limit := public._coach_int_setting('coach_trial_free', 3);
    select used into v_used from public.coach_trial_usage where user_id = v_uid;
  end if;
  v_used := coalesce(v_used, 0);
  return jsonb_build_object('used', v_used, 'limit', v_limit, 'kind', v_kind, 'tier', v_tier,
    'remaining', greatest(0, v_limit - v_used),
    'resets_at', case when v_kind = 'daily' then v_reset end);
end;
$$;
revoke all on function public.my_coach_status() from public, anon;
grant execute on function public.my_coach_status() to authenticated;

-- delete_coach_history(): çağıranın bütün Koç mesajlarını siler (geri alınamaz). Sayaçlar
-- DEĞİŞMEZ (silmek hak iadesi değildir). Döner: silinen satır sayısı.
create or replace function public.delete_coach_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  delete from public.coach_messages where user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.delete_coach_history() from public, anon;
grant execute on function public.delete_coach_history() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 — feature_flags 'koc' (KAPALI)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'koc', false, 0, '1.1.0',
  'G24-S1: kcalAI Koç (sohbet, geçmiş, girişler: Ana sayfa / Tara sonucu / Profil / tarif). coach-chat edge fonksiyonu gerekir. Native modül yok → OTA ile gelir.'
)
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 — user_consents: koç için ayrı AI izni (kind ai_coach, source coach)
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.user_consents') is null then
    raise notice 'g24_coach: user_consents yok — CHECK güncellemesi atlandı';
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_kind_check;
  alter table public.user_consents
    add constraint user_consents_kind_check
    check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo', 'ai_coach'));
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach'));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7 — olay adları (D-S1 sözlüğü varsa)
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g24_coach: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('coach_open',     'tracking',   'client', 'kcalAI Koç açıldı', 'kcalAI Coach opened', 'from: home|scan|profile|recipe|other', null, false),
    ('coach_send',     'tracking',   'client', 'Koç''a mesaj gönderildi', 'Message sent to the Coach', 'via: text|chip|voice, kind: daily|trial', null, false),
    ('coach_limit',    'tracking',   'client', 'Koç mesaj hakkı doldu', 'Coach message limit reached', 'kind: daily|trial', null, false),
    ('coach_upsell',   'commerce',   'client', '"Koç Balance''ta" sheet''i', '"Coach is on Balance" sheet', 'action: view|plans|dismiss', null, false),
    ('coach_feedback', 'tracking',   'client', 'Koç yanıtına geri bildirim', 'Feedback on a Coach reply', 'value: up|down|clear', null, false)
  on conflict (name) do nothing;
end $$;

commit;
