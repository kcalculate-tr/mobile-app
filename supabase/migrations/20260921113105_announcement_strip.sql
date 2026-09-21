-- Ana sayfa duyuru şeridi (marquee) — "Bu Hafta Popüler" başlığının üstünde
-- sürekli akan ince yazı şeridi. İçerik Boss panel > Vitrin > Grid Yönetimi'nden
-- yönetilir. app_banners ile aynı okuma/yazma deseni kullanılır.
create table public.announcement_strip (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  -- Bir turun süresi (ms). Küçük değer = hızlı akış.
  speed_ms int not null default 18000,
  bg_color text,              -- null => marka yeşili (#C6F04F)
  text_color text,            -- null => siyah
  navigate_to text,           -- opsiyonel deeplink (app_banners.deeplink ile aynı format)
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.announcement_strip (is_active, priority desc);

alter table public.announcement_strip enable row level security;

-- Anasayfa oturumsuz da görünüyor (FAZ G) → anon okuma şart.
create policy "read active announcement strip" on public.announcement_strip
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy "announcement_strip_admin_write" on public.announcement_strip
  for all
  using (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()));
