-- Apple ile giriş yapan kullanıcıların refresh_token'ı — SADECE hesap silme
-- akışında Apple'a "bu kullanıcının bağlantısını kes" (revoke) demek için
-- kullanılır. Bilinçli olarak HİÇBİR RLS politikası eklenmiyor: RLS enable +
-- politika yok = anon/authenticated için tam ret; sadece Edge Function'ların
-- kullandığı service_role (RLS bypass) okuyup yazabilir.
create table public.user_apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_apple_tokens enable row level security;
