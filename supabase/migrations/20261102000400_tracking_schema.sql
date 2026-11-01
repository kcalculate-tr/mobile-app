-- S1 görev 4 — Takip verisi için ayrı `tracking` şeması (TASLAK)
--
-- Amaç (bkz. docs/night/S1-TRACKING_SCHEMA.md): Kcalculate AI (kalori takibi)
-- servisi ileride ayrı şirkete taşınabilsin diye takip verisini public (sipariş/
-- eatkcal) şemasından ayırmak. Bu migration YALNIZCA yeni şema + tabloları kurar;
-- mevcut public.meal_logs / meal_consumptions / user_nutrition_profiles'a
-- DOKUNMAZ, veri taşımaz. Taşıma ayrı bir iş (tasarım notunda anlatıldı).
--
-- NOT: `tracking` şeması varsayılan olarak PostgREST API'sine açık DEĞİL
-- (Dashboard "Exposed schemas" ONAYSIZ). Bu yüzden şimdilik yalnızca edge
-- function'lar (service_role) ve ileride API'ye eklenirse kullanılacak. RLS yine
-- de kuruldu ki açıldığında güvenli olsun.
--
-- staging MCP oturumda olmadığı için BU MIGRATION TEST EDİLMEDİ.

begin;

create schema if not exists tracking;

-- Roller şemayı görebilsin (tablo erişimi RLS + grant ile kısıtlı).
grant usage on schema tracking to authenticated, service_role;

-- updated_at dokunma fonksiyonu (şemaya özel, public'e bağımlı olmasın).
create or replace function tracking.touch_updated_at()
returns trigger language plpgsql set search_path = tracking, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 1) tracking.meal_entries — öğün logları (public.meal_logs + meal_consumptions superset'i).
create table if not exists tracking.meal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null,
  consumed_at timestamptz not null default now(),
  meal_type   text,                         -- kahvalti/ogle/aksam/ara
  source      text not null default 'manual', -- manual | ai | order | barcode
  source_ref  text,                         -- ör. order_id, ürün id, barkod
  name        text,
  calories    integer,
  protein     numeric,
  carbs       numeric,
  fat         numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists meal_entries_user_date_idx on tracking.meal_entries(user_id, entry_date);

-- 2) tracking.daily_goals — tarih bazlı günlük hedef anlık görüntüsü.
--    (public.user_nutrition_profiles yalnızca GÜNCEL hedefi tutuyor; burada
--     tarihe göre hedef geçmişi saklanır.)
create table if not exists tracking.daily_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  goal_date       date not null,
  target_calories integer,
  target_protein  integer,
  target_carbs    integer,
  target_fat      integer,
  target_water    numeric,
  source          text not null default 'profile', -- profile | ai | manual
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint daily_goals_user_date_unique unique (user_id, goal_date)
);

-- 3) tracking.ai_requests — AI istek kayıtları ve maliyeti.
create table if not exists tracking.ai_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  feature       text not null,              -- ne_yemeli | kesfet | analiz | ...
  provider      text,                       -- anthropic | openai | ...
  model         text,                       -- claude-... / gpt-...
  input_tokens  integer,
  output_tokens integer,
  total_tokens  integer generated always as (coalesce(input_tokens,0) + coalesce(output_tokens,0)) stored,
  cost_usd      numeric(12,6),
  currency      text not null default 'USD',
  latency_ms    integer,
  status        text not null default 'ok', -- ok | error | timeout
  error         text,
  request_ref   text,                       -- idempotency / izleme anahtarı
  created_at    timestamptz not null default now()
);
create index if not exists ai_requests_user_created_idx on tracking.ai_requests(user_id, created_at desc);
create index if not exists ai_requests_feature_created_idx on tracking.ai_requests(feature, created_at desc);

-- updated_at trigger'ları
drop trigger if exists meal_entries_touch on tracking.meal_entries;
create trigger meal_entries_touch before update on tracking.meal_entries
  for each row execute function tracking.touch_updated_at();
drop trigger if exists daily_goals_touch on tracking.daily_goals;
create trigger daily_goals_touch before update on tracking.daily_goals
  for each row execute function tracking.touch_updated_at();

-- RLS — kullanıcı yalnızca kendi verisi; ai_requests kullanıcıya salt-okunur,
-- yazımı service_role (edge function) yapar.
alter table tracking.meal_entries enable row level security;
alter table tracking.daily_goals  enable row level security;
alter table tracking.ai_requests  enable row level security;

grant select, insert, update, delete on tracking.meal_entries to authenticated;
grant select, insert, update, delete on tracking.daily_goals  to authenticated;
grant select on tracking.ai_requests to authenticated;
grant all on all tables in schema tracking to service_role;

create policy meal_entries_own on tracking.meal_entries
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy daily_goals_own on tracking.daily_goals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_requests_select_own on tracking.ai_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

commit;
