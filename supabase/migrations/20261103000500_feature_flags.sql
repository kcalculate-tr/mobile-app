-- G4-S2 — Dalga dalga yayın için özellik bayrakları (feature flags) altyapısı
-- version: 20261103000500  name: feature_flags
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- Geri alma: 20261103000500_feature_flags_rollback.sql
--
-- Mevcut `public.settings` (id=1) tablosu sabit kolonlu bir MAĞAZA ayarı
-- singleton'ı (min_supported_version, macro_*, çalışma saatleri...) — anahtar
-- bazlı bir bayrak kaydı DEĞİL. Bu yüzden rollout_percent/platforms/kullanıcı
-- kilidi modeline uymuyor; ayrı `feature_flags` + `user_feature_unlocks`
-- tabloları kuruyoruz (ikinci bir genel ayar sistemi değil, bayrağa özel).

begin;

-- ──────────────────────────────────────────────────────────────────────────
-- 1) feature_flags — bayrak kayıtları. Yerel varsayılan her zaman KAPALI;
--    bir bayrağı açmak yalnızca service_role / admin (panel/SQL) işidir.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.feature_flags (
  key             text primary key,
  enabled         boolean not null default false,
  rollout_percent integer not null default 0
                    check (rollout_percent between 0 and 100),
  min_app_version text,
  platforms       text[],            -- null = tüm platformlar (ios/android/web)
  description     text,
  updated_at      timestamptz not null default now()
);

comment on table public.feature_flags is
  'Dalga dalga yayın için özellik bayrakları. Yazma yalnızca service_role/admin; istemci sadece get_my_features() ile okur.';
comment on column public.feature_flags.rollout_percent is
  '0-100. Kullanıcı, fnv1a32(key || '':'' || user_id) %% 100 < rollout_percent ise dalgaya dahil.';
comment on column public.feature_flags.platforms is
  'null = tüm platformlar. Aksi halde istemci platformu (ios/android/web) bu dizide olmalı.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2) user_feature_unlocks — kullanıcı bazlı kilit açma (referral/streak/promo
--    veya elle). Rollout'tan bağımsız: satır varsa bayrak o kullanıcıya AÇIK.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.user_feature_unlocks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  flag_key    text not null references public.feature_flags(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  source      text not null default 'manual'
                check (source in ('manual','referral','streak','promo')),
  primary key (user_id, flag_key)
);

comment on table public.user_feature_unlocks is
  'Kullanıcı bazlı bayrak kilidi açma. Satır varsa, rollout/enabled''dan bağımsız olarak bayrak o kullanıcı için açıktır (bkz. get_my_features).';

create index if not exists idx_user_feature_unlocks_user
  on public.user_feature_unlocks(user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3) RLS — authenticated yalnız feature_flags'i ve KENDİ unlock satırlarını
--    okur. İstemciden INSERT/UPDATE/DELETE yok; anon erişimi yok.
-- ──────────────────────────────────────────────────────────────────────────
alter table public.feature_flags       enable row level security;
alter table public.user_feature_unlocks enable row level security;

-- feature_flags: sadece okuma, sadece authenticated.
drop policy if exists feature_flags_select_authenticated on public.feature_flags;
create policy feature_flags_select_authenticated
  on public.feature_flags
  for select
  to authenticated
  using (true);

-- user_feature_unlocks: kullanıcı yalnız kendi satırlarını okur.
drop policy if exists user_feature_unlocks_select_own on public.user_feature_unlocks;
create policy user_feature_unlocks_select_own
  on public.user_feature_unlocks
  for select
  to authenticated
  using (user_id = auth.uid());

-- Yazma politikası YOK → istemciden insert/update/delete reddedilir.
-- Tablo yazımı yalnız service_role (RLS'yi baypas eder) üzerinden.
revoke all   on public.feature_flags        from anon, authenticated, public;
revoke all   on public.user_feature_unlocks from anon, authenticated, public;
grant  select on public.feature_flags        to authenticated;
grant  select on public.user_feature_unlocks to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4) Yardımcılar (immutable, saf) — rollout hash ve sürüm karşılaştırma.
--    fnv1a32: istemcideki src/core/flags/rollout.ts ile BİREBİR aynı algoritma
--    (FNV-1a 32-bit, UTF-8 bayt dizisi üzerinde) — sunucu ve istemci aynı
--    kovayı hesaplar.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public._ff_fnv1a_bucket(p_text text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  bytes bytea := convert_to(coalesce(p_text, ''), 'UTF8');
  h     bigint := 2166136261;      -- FNV offset basis (32-bit)
  i     integer;
begin
  for i in 0 .. octet_length(bytes) - 1 loop
    h := (h # get_byte(bytes, i));                 -- XOR bayt
    h := (h * 16777619) % 4294967296;              -- * FNV prime, mod 2^32
  end loop;
  return (h % 100)::integer;                       -- 0..99
end;
$$;

-- "1.2.3" → biçimsel semver karşılaştırma. a >= b ise true.
-- Bozuk/NULL girişte false (güvenli taraf: eşleşme yok sayılır).
create or replace function public._ff_version_gte(p_current text, p_min text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  ca integer[];
  cb integer[];
  n  integer;
  i  integer;
  av integer;
  bv integer;
begin
  if p_current is null or p_min is null then
    return false;
  end if;
  begin
    ca := string_to_array(regexp_replace(trim(p_current), '[^0-9.]', '', 'g'), '.')::integer[];
    cb := string_to_array(regexp_replace(trim(p_min),     '[^0-9.]', '', 'g'), '.')::integer[];
  exception when others then
    return false;
  end;
  if ca is null or cb is null then
    return false;
  end if;
  n := greatest(array_length(ca, 1), array_length(cb, 1));
  for i in 1 .. n loop
    av := coalesce(ca[i], 0);
    bv := coalesce(cb[i], 0);
    if av > bv then return true;  end if;
    if av < bv then return false; end if;
  end loop;
  return true;  -- eşit
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5) get_my_features() — çağıran kullanıcı için her bayrağın ÇÖZÜMLENMİŞ
--    boolean değerini { key: bool } jsonb olarak döner.
--
--    Bir bayrak kullanıcıya açık sayılır EĞER:
--      (enabled
--        AND kovası < rollout_percent
--        AND (min_app_version yoksa  VEYA  istemci sürümü >= min_app_version)
--        AND (platforms yoksa        VEYA  istemci platformu listede))
--      VEYA kullanıcının o bayrak için user_feature_unlocks satırı var.
--
--    Sürüm/platform bilgisi istemciden gelir; verilmezse ve kısıt varsa
--    güvenli tarafta KAPALI kalır (bayraklar varsayılan kapalıdır, yanlışlıkla
--    eski istemcide yeni özellik açmayız).
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_features(
  p_app_version text default null,
  p_platform    text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      ff.key,
      (
        (
          ff.enabled
          and public._ff_fnv1a_bucket(ff.key || ':' || auth.uid()::text) < ff.rollout_percent
          and (ff.min_app_version is null or public._ff_version_gte(p_app_version, ff.min_app_version))
          and (ff.platforms is null or (p_platform is not null and p_platform = any(ff.platforms)))
        )
        or exists (
          select 1 from public.user_feature_unlocks u
          where u.user_id = auth.uid() and u.flag_key = ff.key
        )
      )
    ),
    '{}'::jsonb
  )
  from public.feature_flags ff;
$$;

comment on function public.get_my_features(text, text) is
  'Çağıran kullanıcı için tüm bayrakların çözümlenmiş { key: bool } değeri. Sürüm/platform istemciden gelir.';

-- Yardımcılar ve RPC: yalnız authenticated çağırabilir; anon/public yok.
revoke all on function public._ff_fnv1a_bucket(text)       from public, anon, authenticated;
revoke all on function public._ff_version_gte(text, text)  from public, anon, authenticated;
revoke all on function public.get_my_features(text, text)  from public, anon;
grant  execute on function public.get_my_features(text, text) to authenticated;

commit;
