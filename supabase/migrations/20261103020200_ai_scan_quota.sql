-- G5-S2 — AI tarama kotası: kullanım + rezervasyon + genel ayar (`app_settings`)
-- version: 20261103020200  name: ai_scan_quota
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: 20261103020200_ai_scan_quota_rollback.sql
--
-- Kota (G5-CONTRACT.md §AI tarama): kullanıcı başına günde 3 tarama (Europe/Istanbul
-- gece yarısı sıfırlanır); başarısız analizde hak iade. Ayrıca tüm kullanıcılar için
-- günlük toplam harcama tavanı (maliyet koruması). Yetki/kota SUNUCUDA; bkz.
-- reserve_ai_scan / release_ai_scan (20261103020400_g5_rpcs.sql).
--
-- NOT: Mevcut `public.settings` (id=1) MAĞAZA singleton'u (sabit kolonlu). Genel/
-- anahtar-bazlı uygulama ayarı için ayrı, küçük bir key-value tablosu kuruyoruz.

begin;

-- ── 1) app_settings — genel anahtar-değer uygulama ayarı ────────────────────
create table if not exists public.app_settings (
  key         text        primary key,
  value       jsonb       not null,
  description text,
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is
  'Genel anahtar-değer uygulama ayarı (mağaza singleton `settings`''ten ayrı). Yazma yalnız service_role/admin; istemci okur.';

alter table public.app_settings enable row level security;
drop policy if exists app_settings_select_auth on public.app_settings;
create policy app_settings_select_auth on public.app_settings
  for select to authenticated using (true);
revoke all   on public.app_settings from anon, authenticated, public;
grant  select on public.app_settings to authenticated;

insert into public.app_settings (key, value, description) values
  ('ai_scan_user_daily_limit', '3'::jsonb,    'Kullanıcı başına günlük AI tarama hakkı (Europe/Istanbul gece yarısı sıfırlanır).'),
  ('ai_scan_daily_cap',        '1000'::jsonb, 'Tüm kullanıcılar için günlük toplam AI tarama tavanı (maliyet koruması).')
on conflict (key) do nothing;

-- ── 2) ai_scan_usage — kullanıcı+gün başına sayaç ──────────────────────────
create table if not exists public.ai_scan_usage (
  user_id uuid    not null references auth.users(id) on delete cascade,
  day     date    not null,                       -- Europe/Istanbul takvim günü
  used    integer not null default 0 check (used >= 0),
  primary key (user_id, day)
);
create index if not exists ai_scan_usage_day_idx on public.ai_scan_usage (day);

comment on table public.ai_scan_usage is
  'Kullanıcı başına günlük AI tarama sayacı. `day` = Europe/Istanbul takvim günü. reserve_ai_scan artırır, release_ai_scan azaltır.';

-- ── 3) ai_scan_reservations — idempotent rezervasyon kaydı ─────────────────
create table if not exists public.ai_scan_reservations (
  idempotency_key text        primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  day             date        not null,
  status          text        not null default 'reserved'
                    check (status in ('reserved', 'released')),
  created_at      timestamptz not null default now()
);
create index if not exists ai_scan_reservations_user_idx
  on public.ai_scan_reservations (user_id, day);

comment on table public.ai_scan_reservations is
  'AI tarama rezervasyonları. idempotency_key ile aynı istek iki kez saymaz; release_ai_scan status=released yapıp sayacı iade eder.';

-- ── 4) RLS — kullanıcı yalnız kendi satırlarını okur; yazma RPC (definer) ──
alter table public.ai_scan_usage        enable row level security;
alter table public.ai_scan_reservations enable row level security;

drop policy if exists ai_scan_usage_select_own on public.ai_scan_usage;
create policy ai_scan_usage_select_own on public.ai_scan_usage
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ai_scan_reservations_select_own on public.ai_scan_reservations;
create policy ai_scan_reservations_select_own on public.ai_scan_reservations
  for select to authenticated using (user_id = auth.uid());

revoke all   on public.ai_scan_usage        from anon, authenticated, public;
revoke all   on public.ai_scan_reservations from anon, authenticated, public;
grant  select on public.ai_scan_usage        to authenticated;
grant  select on public.ai_scan_reservations to authenticated;

commit;
