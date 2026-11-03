-- G5-S2 — Gün halkası paylaşımları (`day_shares`) + öğün fotoğraf yolu
-- version: 20261103020100  name: day_shares
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- STAGING'DE TEST EDİLMEDİ. Geri alma: 20261103020100_day_shares_rollback.sql
--
-- Gün halkası (G5-CONTRACT.md §Gün halkası): kullanıcı bir öğününü (meal_consumption)
-- "Günüme ekle" ile 24 saatliğine paylaşır. Erişim süresi SUNUCUDA kesilir (expires_at).
-- Fotoğraf: `meal_consumptions`'ta foto kolonu yoktu → özel `photo_path` eklenir
-- (user-media kovasındaki yol; istemci imzalı URL üretir). Geriye uyumlu (nullable).

begin;

-- Öğün fotoğrafı: user-media (özel) kovasındaki YOL. Public URL DEĞİL.
alter table public.meal_consumptions
  add column if not exists photo_path text;
comment on column public.meal_consumptions.photo_path is
  'user-media (özel) kovasındaki fotoğraf yolu (AI tarama / Gün kartı). İstemci kısa ömürlü imzalı URL üretir.';

create table if not exists public.day_shares (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  consumption_id uuid        not null references public.meal_consumptions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  -- 24 saat sonra erişim kesilir (get_day_cards expires_at > now() süzer).
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  -- Aynı öğün bir kez paylaşılır; tekrar paylaşım süreyi tazeler (RPC upsert).
  unique (user_id, consumption_id)
);

create index if not exists day_shares_user_active_idx
  on public.day_shares (user_id, expires_at desc);
create index if not exists day_shares_expires_idx
  on public.day_shares (expires_at);

comment on table public.day_shares is
  'Gün halkası: kullanıcının 24 saatliğine paylaştığı öğünler. Başkalarının kartları yalnız get_day_cards (definer) üzerinden, görünürlük+süre denetimiyle okunur.';

-- RLS: istemci yalnız KENDİ paylaşımlarını doğrudan okur/siler. Başkasının
-- kartları RPC (security definer) ile sunulur. Yazma (insert) RPC üzerinden.
alter table public.day_shares enable row level security;

drop policy if exists day_shares_select_own on public.day_shares;
create policy day_shares_select_own on public.day_shares
  for select to authenticated using (user_id = auth.uid());

drop policy if exists day_shares_delete_own on public.day_shares;
create policy day_shares_delete_own on public.day_shares
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.day_shares from anon, authenticated, public;
grant  select, delete on public.day_shares to authenticated;

commit;
