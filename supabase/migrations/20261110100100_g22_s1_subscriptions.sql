-- G22-S1 md.3 — kcalAI abonelikleri + sunucuda kademeli günlük haklar (İlter 10 Kas).
-- version: 20261110100100  name: g22_s1_subscriptions
--
-- DURUM: YALNIZ DOSYA (gece kuralı) — canlıya UYGULANMADI.
-- Geri alma: supabase/rollbacks/20261110100100_g22_s1_subscriptions_rollback.sql
-- İdempotent: tekrar çalıştırmak güvenli.
-- Önkoşul: 20261109190100_g19_ai_scan_hardening (reserve_ai_scan G19 gövdesi, result/
--          attempts sütunları, ai_scan_enabled / ai_scan_daily_cap ayarları).
--
-- 1) user_entitlements — kullanıcının kcalAI kademesi (free | fresh | balance).
--    Tek yazan: revenuecat-webhook edge fonksiyonu (service role). İstemci yalnız
--    kendi satırını OKUR (RLS); yazma politikası YOK (service role RLS'i aşar).
-- 2) app_settings — günlük haklar (kodda sabit yok):
--      ai_daily_free=2 · ai_daily_fresh=15 · ai_daily_balance=100 (adil kullanım tavanı)
--      barcode_daily_free=5 (Fresh/Balance barkod sınırsız — kural, sayı değil)
--    Fotoğraf + ses AI hakkı ORTAK (aynı reserve_ai_scan). Elle giriş sınırsız.
-- 3) reserve_ai_scan — kademeli limit. G19 davranışı AYNEN korunur (idempotency,
--    önbellek/cached, gece yarısı taşıma, acil kapatma, genel tavan). Yanıta `tier`,
--    `limit`, `unlimited` eklenir (istemci hak hapı: N/2 · N/15 · Sınırsız).
--    Balance adil kullanım tavanı dolarsa {ok:false, reason:'fair_use'}.
-- 4) reserve_barcode_scan(p_code) — günlük barkod sayacı (yalnız free sınırlı). Aynı
--    gün aynı barkod İKİNCİ KEZ sayılmaz (yeniden okutma hak yemez).
-- 5) my_entitlement() — kademe + bugünkü AI/barkod kullanımı (istemci doğrulaması).
-- 6) feature_flags 'abonelik' (KAPALI) — abonelik ekranları bayrağı.
--
-- SIRA (canlı): bu migration → revenuecat-webhook deploy → RevenueCat webhook URL +
-- Authorization değeri → bayrak (İlter). Migration'sız gelen OTA: istemci yeni RPC'leri
-- bulamazsa barkodu serbest bırakır (fail-open) ve hak hapını G19 yanıtından çizer.
begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 — user_entitlements
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.user_entitlements (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  tier           text not null default 'free' check (tier in ('free', 'fresh', 'balance')),
  product_id     text,
  expires_at     timestamptz,
  trial          boolean not null default false,
  store          text,
  will_renew     boolean not null default true,
  -- Webhook sırası: RevenueCat olayları sırasız gelebilir; eski olay yeniyi ezmesin.
  last_event_id  text,
  last_event_at  timestamptz,
  updated_at     timestamptz not null default now()
);

comment on table public.user_entitlements is
  'G22-S1: kcalAI kademesi. Yazan yalnız revenuecat-webhook (service role); kullanıcı kendi satırını okur.';
comment on column public.user_entitlements.tier is 'free | fresh | balance (RevenueCat yetkileri fresh/balance).';
comment on column public.user_entitlements.expires_at is 'Abonelik bitişi; geçmişse kademe free sayılır (_entitlement_tier).';
comment on column public.user_entitlements.trial is 'Yıllık planlarda 7 gün deneme (RevenueCat period_type = TRIAL).';
comment on column public.user_entitlements.store is 'APP_STORE | PLAY_STORE | … (RevenueCat store).';

alter table public.user_entitlements enable row level security;

drop policy if exists user_entitlements_select_own on public.user_entitlements;
create policy user_entitlements_select_own on public.user_entitlements
  for select to authenticated
  using (user_id = auth.uid());

-- Yazma yok: insert/update/delete yetkisi istemci rollerinden alınır (politika da yok).
revoke insert, update, delete on public.user_entitlements from anon, authenticated;
grant select on public.user_entitlements to authenticated;

-- Geçerli kademe: süresi geçmiş abonelik = free. expires_at NULL (ömür boyu/promosyon) = geçerli.
create or replace function public._entitlement_tier(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.tier from public.user_entitlements e
      where e.user_id = p_uid
        and e.tier in ('fresh', 'balance')
        and (e.expires_at is null or e.expires_at > now())),
    'free');
$$;
revoke all on function public._entitlement_tier(uuid) from public, anon, authenticated;

-- Kademeye göre günlük limit (NULL = sınırsız). Ayar yoksa yorumdaki varsayılan.
create or replace function public._daily_limit(p_kind text, p_tier text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key  text;
  v_def  integer;
  v_val  integer;
begin
  if p_kind = 'ai' then
    v_key := 'ai_daily_' || p_tier;
    v_def := case p_tier when 'balance' then 100 when 'fresh' then 15 else 2 end;
  elsif p_kind = 'barcode' then
    if p_tier in ('fresh', 'balance') then
      return null; -- barkod sınırsız (ücretli kademeler)
    end if;
    v_key := 'barcode_daily_free';
    v_def := 5;
  else
    raise exception 'bilinmeyen tur: %', p_kind;
  end if;
  begin
    select (value #>> '{}')::int into v_val from public.app_settings where key = v_key;
  exception when others then
    v_val := null;
  end;
  return greatest(0, coalesce(v_val, v_def));
end;
$$;
revoke all on function public._daily_limit(text, text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2 — app_settings
-- ════════════════════════════════════════════════════════════════════════════
insert into public.app_settings (key, value, description) values
  ('ai_daily_free',      '2'::jsonb,   'G22-S1: Ücretsiz kademe günlük AI hakkı (fotoğraf + ses ORTAK).'),
  ('ai_daily_fresh',     '15'::jsonb,  'G22-S1: kcalAI Fresh günlük AI hakkı (fotoğraf + ses ORTAK).'),
  ('ai_daily_balance',   '100'::jsonb, 'G22-S1: kcalAI Balance adil kullanım tavanı (istemcide "Sınırsız").'),
  ('barcode_daily_free', '5'::jsonb,   'G22-S1: Ücretsiz kademe günlük barkod hakkı (Fresh/Balance sınırsız).')
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 — reserve_ai_scan (kademeli). Gövde G19 ile birebir; yalnız v_user_limit kaynağı
--     ve yanıt alanları (tier/limit/unlimited, fair_use) değişti.
-- ════════════════════════════════════════════════════════════════════════════
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
  v_tier       text;
  v_user_limit integer;
  v_unlimited  boolean;
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

  v_tier       := public._entitlement_tier(v_uid);
  v_user_limit := public._daily_limit('ai', v_tier);
  v_unlimited  := (v_tier = 'balance');

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
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset,
      'tier', v_tier, 'limit', v_user_limit, 'unlimited', v_unlimited);
  end if;

  if not v_enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset,
      'tier', v_tier, 'limit', v_user_limit, 'unlimited', v_unlimited);
  end if;

  if v_status = 'reserved' and v_day = v_today then
    return jsonb_build_object('ok', true,
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset,
      'tier', v_tier, 'limit', v_user_limit, 'unlimited', v_unlimited);
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
    -- Balance: adil kullanım tavanı ("Sınırsız" yazdığımız için ayrı neden).
    if v_unlimited then
      return jsonb_build_object('ok', false, 'reason', 'fair_use', 'remaining', 0,
        'reset_at', v_reset, 'tier', v_tier, 'limit', v_user_limit, 'unlimited', true);
    end if;
    return jsonb_build_object('ok', false, 'remaining', 0, 'reset_at', v_reset,
      'tier', v_tier, 'limit', v_user_limit, 'unlimited', false);
  end if;

  select coalesce(sum(used), 0) into v_global
    from public.ai_scan_usage where day = v_today;
  if v_global >= v_global_cap then
    return jsonb_build_object('ok', false, 'reason', 'global_cap',
      'remaining', greatest(0, v_user_limit - v_used), 'reset_at', v_reset,
      'tier', v_tier, 'limit', v_user_limit, 'unlimited', v_unlimited);
  end if;

  update public.ai_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;

  insert into public.ai_scan_reservations (idempotency_key, user_id, day, status)
  values (p_idempotency_key, v_uid, v_today, 'reserved')
  on conflict (idempotency_key) do update
    set status = 'reserved', day = excluded.day, result = null;

  return jsonb_build_object('ok', true,
    'remaining', greatest(0, v_user_limit - (v_used + 1)), 'reset_at', v_reset,
    'tier', v_tier, 'limit', v_user_limit, 'unlimited', v_unlimited);
end;
$$;

revoke all on function public.reserve_ai_scan(text) from public, anon;
grant execute on function public.reserve_ai_scan(text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 — reserve_barcode_scan (günlük barkod sayacı, kademeli)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.barcode_scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  used    integer not null default 0,
  primary key (user_id, day)
);
create table if not exists public.barcode_scan_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  code    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day, code)
);
comment on table public.barcode_scan_usage is 'G22-S1: günlük barkod hakkı sayacı (yalnız reserve_barcode_scan yazar).';
comment on table public.barcode_scan_log is 'G22-S1: aynı gün aynı barkod ikinci kez sayılmasın diye (yalnız RPC yazar).';
alter table public.barcode_scan_usage enable row level security;
alter table public.barcode_scan_log enable row level security;
drop policy if exists barcode_scan_usage_select_own on public.barcode_scan_usage;
create policy barcode_scan_usage_select_own on public.barcode_scan_usage
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.barcode_scan_usage from anon, authenticated;
revoke all on public.barcode_scan_log from anon, authenticated;

create or replace function public.reserve_barcode_scan(p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'Europe/Istanbul')::date;
  v_reset  timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_tier   text;
  v_limit  integer;
  v_used   integer;
  v_code   text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if v_code is not null and (length(v_code) > 32 or v_code !~ '^[0-9]+$') then
    raise exception 'gecersiz_barkod';
  end if;

  v_tier  := public._entitlement_tier(v_uid);
  v_limit := public._daily_limit('barcode', v_tier);

  insert into public.barcode_scan_usage (user_id, day, used)
  values (v_uid, v_today, 0)
  on conflict (user_id, day) do nothing;
  select used into v_used
    from public.barcode_scan_usage where user_id = v_uid and day = v_today for update;

  -- Aynı gün aynı barkod: hak düşmez.
  if v_code is not null and exists (
    select 1 from public.barcode_scan_log where user_id = v_uid and day = v_today and code = v_code
  ) then
    return jsonb_build_object('ok', true, 'repeat', true, 'tier', v_tier, 'limit', v_limit,
      'unlimited', v_limit is null,
      'remaining', case when v_limit is null then null else greatest(0, v_limit - v_used) end,
      'reset_at', v_reset);
  end if;

  if v_limit is not null and v_used >= v_limit then
    return jsonb_build_object('ok', false, 'tier', v_tier, 'limit', v_limit, 'unlimited', false,
      'remaining', 0, 'reset_at', v_reset);
  end if;

  update public.barcode_scan_usage set used = used + 1
   where user_id = v_uid and day = v_today;
  if v_code is not null then
    insert into public.barcode_scan_log (user_id, day, code)
    values (v_uid, v_today, v_code)
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'tier', v_tier, 'limit', v_limit,
    'unlimited', v_limit is null,
    'remaining', case when v_limit is null then null else greatest(0, v_limit - (v_used + 1)) end,
    'reset_at', v_reset);
end;
$$;
revoke all on function public.reserve_barcode_scan(text) from public, anon;
grant execute on function public.reserve_barcode_scan(text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 — my_entitlement()
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.my_entitlement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'Europe/Istanbul')::date;
  v_reset   timestamptz := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_tier    text;
  v_row     public.user_entitlements%rowtype;
  v_ai_lim  integer;
  v_bc_lim  integer;
  v_ai_used integer;
  v_bc_used integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  v_tier := public._entitlement_tier(v_uid);
  select * into v_row from public.user_entitlements where user_id = v_uid;
  v_ai_lim := public._daily_limit('ai', v_tier);
  v_bc_lim := public._daily_limit('barcode', v_tier);
  select coalesce(used, 0) into v_ai_used from public.ai_scan_usage where user_id = v_uid and day = v_today;
  select coalesce(used, 0) into v_bc_used from public.barcode_scan_usage where user_id = v_uid and day = v_today;
  v_ai_used := coalesce(v_ai_used, 0);
  v_bc_used := coalesce(v_bc_used, 0);

  return jsonb_build_object(
    'tier', v_tier,
    'product_id', case when v_tier = 'free' then null else v_row.product_id end,
    'expires_at', case when v_tier = 'free' then null else v_row.expires_at end,
    'trial', case when v_tier = 'free' then false else coalesce(v_row.trial, false) end,
    'store', case when v_tier = 'free' then null else v_row.store end,
    'will_renew', case when v_tier = 'free' then false else coalesce(v_row.will_renew, true) end,
    'reset_at', v_reset,
    'ai', jsonb_build_object('limit', v_ai_lim, 'used', v_ai_used,
      'remaining', greatest(0, v_ai_lim - v_ai_used), 'unlimited', v_tier = 'balance'),
    'barcode', jsonb_build_object('limit', v_bc_lim, 'used', v_bc_used,
      'remaining', case when v_bc_lim is null then null else greatest(0, v_bc_lim - v_bc_used) end,
      'unlimited', v_bc_lim is null)
  );
end;
$$;
revoke all on function public.my_entitlement() from public, anon;
grant execute on function public.my_entitlement() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 — feature_flags 'abonelik' (KAPALI; İlter açar). Yeni native derleme gerekir
--     (react-native-purchases) → min_app_version 1.2.0.
-- ════════════════════════════════════════════════════════════════════════════
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'abonelik', false, 0, '1.2.0',
  'G22-S1: kcalAI abonelikleri (FinSubPaywall, hak sheet''leri, Profil › Abonelik). RevenueCat anahtarları + webhook gerekir; 1.2.0+ (react-native-purchases).'
)
on conflict (key) do nothing;

-- Olay adları (D-S1 sözlüğü varsa).
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g22_s1_subscriptions: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('voice_start',     'tracking', 'client', 'Sesle ekleme: dinleme başladı', 'Voice add: listening started', 'lang', null, false),
    ('voice_done',      'tracking', 'client', 'Sesle ekleme: metin analize gönderildi', 'Voice add: transcript sent to analysis', 'chars', null, false),
    ('voice_empty',     'tracking', 'client', 'Sesle ekleme: konuşma duyulmadı', 'Voice add: no speech heard', null, null, false),
    ('paywall_view',    'commerce', 'client', 'Abonelik ekranı görüntülendi', 'Paywall viewed', 'from: limit_ai|limit_barcode|limit_voice|profile|pill|other', null, false),
    ('sub_purchase',    'commerce', 'client', 'Abonelik satın alma sonucu', 'Subscription purchase result', 'product, result: success|cancelled|pending|error', null, false),
    ('sub_restore',     'commerce', 'client', 'Satın alımları geri yükleme', 'Restore purchases', 'result', null, false),
    ('barcode_limit',   'tracking', 'client', 'Günlük ücretsiz barkod hakkı bitti', 'Daily free barcode scans used up', null, null, false)
  on conflict (name) do nothing;
end $$;

commit;
