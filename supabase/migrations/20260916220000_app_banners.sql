-- Görev 1.3: app_banners altyapısı — içeriksiz (tablo + RLS, UI/CRUD/event
-- kablolaması yok, banner satırı da yok). Ana sayfa slotu ve Boss panel CRUD
-- ayrı bir görevde eklenecek.
create table public.app_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  deeplink text,
  zone_ids uuid[],            -- S4'te kullanılacak; şimdilik null = herkese
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on public.app_banners (is_active, priority desc);

alter table public.app_banners enable row level security;

-- Herkes (anon dahil) yalnızca aktif + tarih penceresi içindeki banner'ları
-- okuyabilir — Home ekranı henüz giriş yapmamış kullanıcıya da görünebilir.
create policy "read active banners" on public.app_banners
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- Yazma yalnızca admin_allowlist — orders/campaigns'teki mevcut admin bypass
-- pattern'iyle tutarlı (Boss panel Grid Yönetimi bu üzerinden CRUD yapacak).
create policy "app_banners_admin_write" on public.app_banners
  for all
  using (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()))
  with check (exists (select 1 from admin_allowlist a where a.user_id = auth.uid()));
