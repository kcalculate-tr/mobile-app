-- Saklı kart ile ödeme (paynkolay-cards) için "yeni cihaz" tespiti.
-- Görev 4'ün "1.000 TL üstü veya yeni cihaz -> 3D" kuralı bu tabloya bakar.
-- Cihaz sadece BAŞARILI bir ödemeden sonra "bilinen" işaretlenir (paynkolay-cards
-- içinde) — bu migration sadece şemayı açar.
create table public.user_known_devices (
  user_id      uuid not null references auth.users(id) on delete cascade,
  device_id    text not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- Hassas değil ama kullanıcıya özgü — failed_payments/user_card_secrets ile aynı
-- desen: RLS açık + POLİTİKA YOK -> yalnızca service_role (Edge Function) erişir.
alter table public.user_known_devices enable row level security;
