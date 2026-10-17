-- 1) profiles: istemci artık bakiye/rol/ayrıcalık yazamaz
revoke update (
  id, created_at, role, branch_id,
  macro_balance, macro_points, privileged_until, total_macros_purchased,
  payment_customer_key
) on public.profiles from authenticated, anon;

-- 2) settings: model parametreleri veritabanında
alter table public.settings
  add column if not exists macro_earn_threshold      numeric  not null default 500,
  add column if not exists macro_meal_cost           integer  not null default 5,
  add column if not exists macro_reward_valid_days   integer  not null default 90,
  add column if not exists macro_meal_min_cart       numeric  not null default 0,
  add column if not exists macro_meal_max_value      numeric  not null default 0,
  add column if not exists macro_meal_excluded_categories text[] not null
      default array['Koliye Özel Fırsatlar']::text[];

comment on column public.settings.macro_earn_threshold is
  'Kaç TL net ödeme 1 Macro kazandırır.';
comment on column public.settings.macro_meal_cost is
  'Bir ücretsiz öğün kuponu kaç Macro''ya mal olur.';
comment on column public.settings.macro_meal_max_value is
  'Ücretsiz öğün kuponunun üst sınırı (TL). 0 = sınırsız.';
comment on column public.settings.macro_meal_excluded_categories is
  'Ücretsiz öğün kuponunun geçerli OLMADIĞI ürün kategorileri (products.category).';

-- 3) campaigns: ücretsiz öğün kuponu için kapsam alanları
alter table public.campaigns
  add column if not exists excluded_categories text[],
  add column if not exists source text;

comment on column public.campaigns.excluded_categories is
  'discount_type = free_item için: kuponun geçmediği products.category değerleri.';
comment on column public.campaigns.source is
  'Kuponun nereden doğduğu: null = elle, macro_reward = Macro ödülü.';

create index if not exists campaigns_source_user_idx
  on public.campaigns (source, user_id) where source is not null;

-- 4) macro_transactions: aynı sipariş iki kez kazandırmasın
create unique index if not exists macro_transactions_order_earn_uniq
  on public.macro_transactions (order_id)
  where type = 'order_earn' and order_id is not null;;
