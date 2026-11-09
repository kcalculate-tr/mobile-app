-- G18-S3 md.1 — eatkcal "Çok yakında" formları (FinWaitlistAdd / FinWaitlistSuggest).
-- CANLIYA UYGULANACAK (Claude/İlter). Bu dosya uygulanana kadar istemci gönderimi
-- hata vermez: satır cihazda kuyrukta tutulur, tablo/oturum hazır olunca gönderilir.
--
-- Kurallar: kullanıcı YALNIZ kendi satırını ekler ve okur; güncelleme/silme yok
-- (değerlendirme panelden service_role ile). Geriye uyumlu, yalnız yeni tablo.

create table if not exists public.eatkcal_waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('restaurant_add', 'restaurant_suggest')),
  country text not null default 'TR' check (char_length(country) between 2 and 16),
  city text not null check (char_length(btrim(city)) between 1 and 80),
  restaurant_name text not null check (char_length(btrim(restaurant_name)) between 1 and 120),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 32),
  email text check (email is null or char_length(email) <= 254),
  website text check (website is null or char_length(website) <= 200),
  district text check (district is null or char_length(district) <= 80),
  reason text check (reason is null or char_length(reason) <= 1000),
  lang text check (lang is null or lang in ('tr', 'en')),
  client_ref text check (client_ref is null or char_length(client_ref) <= 64),
  status text not null default 'new' check (status in ('new', 'contacted', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  -- Başvuru (ekle) için yetkili adı + telefon + e-posta zorunlu (Final formu).
  constraint eatkcal_waitlist_add_contact check (
    kind <> 'restaurant_add'
    or (contact_name is not null and btrim(contact_name) <> '' and phone is not null and btrim(phone) <> '' and email is not null and btrim(email) <> '')
  )
);

comment on table public.eatkcal_waitlist_requests is
  'G18-S3: eatkcal hizmet dışı şehir — Restoranını ekle (başvuru) / Restoran öner. Kullanıcı yalnız kendi satırını ekler/okur.';

-- Kuyruktan yeniden gönderimde çift satır olmasın (istemci referansı).
create unique index if not exists eatkcal_waitlist_requests_client_ref_uq
  on public.eatkcal_waitlist_requests (user_id, client_ref)
  where client_ref is not null;

create index if not exists eatkcal_waitlist_requests_created_idx
  on public.eatkcal_waitlist_requests (created_at desc);

alter table public.eatkcal_waitlist_requests enable row level security;

drop policy if exists eatkcal_waitlist_insert_own on public.eatkcal_waitlist_requests;
create policy eatkcal_waitlist_insert_own on public.eatkcal_waitlist_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'new');

drop policy if exists eatkcal_waitlist_select_own on public.eatkcal_waitlist_requests;
create policy eatkcal_waitlist_select_own on public.eatkcal_waitlist_requests
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.eatkcal_waitlist_requests from anon;
grant select, insert on public.eatkcal_waitlist_requests to authenticated;
