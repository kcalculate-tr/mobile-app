-- G33-S1 md.4 — Öğün planı + alışveriş listesi (Tur 26m) — veri katmanı.
-- version: 20261112100100  name: g33_meal_plan
--
-- DURUM: UYGULANMADI (yalnız dosya). Geri alma: supabase/rollbacks/20261112100100_g33_meal_plan_rollback.sql
-- İdempotent: tekrar çalıştırmak güvenli.
-- Önkoşul: 20261111230100_g27_health_consent (user_consents CHECK listeleri), feature_flags tablosu.
--
-- 1) ingredient_nutrition — malzeme başına 100 g kcal/P/K/Y + kaynak (USDA FDC SR Legacy, fdc_id).
--    Herkes OKUR; yazan yalnız migration/service role.
-- 2) recipes + recipe_ingredients — tarifler (gram). recipes.kcal/protein/carbs/fat malzemelerden
--    HESAPLANMIŞ önbellektir (tohum: 20261112100200_g33_recipe_seed). status 'draft' | 'published':
--    istemci rolleri yalnız 'published' satırları görür (taslak onaylanınca açılır).
-- 3) meal_plans (kullanıcı × hafta başı Pazartesi) + meal_plan_items (tarih, öğün yuvası, kaynak
--    recipe|eatkcal|custom, ref id, porsiyon, kcal/makro ANLIK değeri, logged_consumption_id).
-- 4) shopping_list_items — elle eklenen satırlar (source 'manual') + plandan türetilen satırların
--    kullanıcı durumu (source 'plan', ingredient_key: alındı / silindi). Ad, miktar, birim, kategori.
-- 5) RLS: kullanıcı yalnız kendi plan/öğe/alışveriş satırını görür ve yazar; tarifler herkese okunur.
-- 6) feature_flags 'ogun_plani' (KAPALI, min_app_version 1.1.0). Native modül yok → OTA.
-- 7) user_consents.source CHECK'e 'meal_plan' (alerjen açık rızası: kind 'health_data').
--
-- SIRA (canlı): bu migration → 20261112100200_g33_recipe_seed → (onay sonrası) tarif status
-- 'published' → `supabase functions deploy meal-plan-generate` → bayrak 'ogun_plani' (İlter).
begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 — ingredient_nutrition
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.ingredient_nutrition (
  key                text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name_tr            text not null,
  name_en            text not null,
  category           text not null check (category in ('produce', 'protein', 'dairy', 'grains', 'spices', 'other')),
  unit               text not null default 'g' check (unit in ('g', 'ml', 'adet', 'dis', 'dilim', 'demet', 'kutu', 'yk', 'tk', 'ck')),
  unit_grams         numeric(8,2) not null default 1 check (unit_grams > 0),
  kcal_100g          numeric(7,2) not null check (kcal_100g >= 0),
  protein_100g       numeric(6,2) not null check (protein_100g >= 0),
  carbs_100g         numeric(6,2) not null check (carbs_100g >= 0),
  fat_100g           numeric(6,2) not null check (fat_100g >= 0),
  allergens          text[] not null default '{}',
  origin             text not null default 'plant' check (origin in ('plant', 'dairy', 'egg', 'meat', 'fish', 'honey')),
  source             text not null default 'usda_fdc_sr_legacy',
  fdc_id             integer,
  source_description text,
  updated_at         timestamptz not null default now(),
  constraint ingredient_nutrition_allergens_check
    check (allergens <@ array['peanut', 'milk', 'egg', 'gluten', 'seafood', 'treenut', 'sesame', 'soy']::text[])
);
comment on table public.ingredient_nutrition is
  'G33-S1: malzeme besin değeri (100 g). Kaynak USDA FoodData Central SR Legacy; fdc_id her satırda. Herkes okur.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2 — recipes + recipe_ingredients
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.recipes (
  key        text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  name_tr    text not null,
  name_en    text not null,
  slot       text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  kcal       integer not null check (kcal >= 0),
  protein    numeric(6,1) not null check (protein >= 0),
  carbs      numeric(6,1) not null check (carbs >= 0),
  fat        numeric(6,1) not null check (fat >= 0),
  allergens  text[] not null default '{}',
  diets      text[] not null default '{}',
  photo_url  text,
  status     text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_allergens_check
    check (allergens <@ array['peanut', 'milk', 'egg', 'gluten', 'seafood', 'treenut', 'sesame', 'soy']::text[]),
  constraint recipes_diets_check
    check (diets <@ array['vegetarian', 'vegan', 'pescatarian', 'high_protein', 'low_carb']::text[])
);
comment on table public.recipes is
  'G33-S1: öğün planı tarifleri. kcal/makro recipe_ingredients × ingredient_nutrition''dan HESAPLANIR (önbellek). İstemci yalnız published okur.';

create table if not exists public.recipe_ingredients (
  recipe_key     text not null references public.recipes (key) on delete cascade,
  ingredient_key text not null references public.ingredient_nutrition (key) on delete restrict,
  grams          numeric(7,1) not null check (grams > 0),
  position       smallint not null default 0,
  primary key (recipe_key, ingredient_key)
);
create index if not exists recipe_ingredients_ing_idx on public.recipe_ingredients (ingredient_key);

alter table public.ingredient_nutrition enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

drop policy if exists ingredient_nutrition_read_all on public.ingredient_nutrition;
create policy ingredient_nutrition_read_all on public.ingredient_nutrition
  for select to anon, authenticated using (true);

drop policy if exists recipes_read_published on public.recipes;
create policy recipes_read_published on public.recipes
  for select to anon, authenticated using (status = 'published');

drop policy if exists recipe_ingredients_read_published on public.recipe_ingredients;
create policy recipe_ingredients_read_published on public.recipe_ingredients
  for select to anon, authenticated
  using (exists (select 1 from public.recipes r where r.key = recipe_key and r.status = 'published'));

revoke insert, update, delete, truncate on public.ingredient_nutrition from anon, authenticated;
revoke insert, update, delete, truncate on public.recipes from anon, authenticated;
revoke insert, update, delete, truncate on public.recipe_ingredients from anon, authenticated;
grant select on public.ingredient_nutrition to anon, authenticated;
grant select on public.recipes to anon, authenticated;
grant select on public.recipe_ingredients to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 — meal_plans + meal_plan_items
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.meal_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  source     text not null default 'manual' check (source in ('manual', 'template', 'coach')),
  note       text check (note is null or char_length(note) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
comment on table public.meal_plans is 'G33-S1: kullanıcının haftalık öğün planı (hafta başı Pazartesi). note = Koç kısa açıklaması (Balance).';

create table if not exists public.meal_plan_items (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references public.meal_plans (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  date                  date not null,
  slot                  text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  source                text not null check (source in ('recipe', 'eatkcal', 'custom')),
  ref_id                text,
  name                  text not null check (char_length(name) between 1 and 120),
  portion               numeric(4,2) not null default 1 check (portion > 0 and portion <= 4),
  kcal                  integer not null check (kcal >= 0 and kcal <= 5000),
  protein               numeric(6,1) not null default 0 check (protein >= 0),
  carbs                 numeric(6,1) not null default 0 check (carbs >= 0),
  fat                   numeric(6,1) not null default 0 check (fat >= 0),
  price                 numeric(8,2),
  logged_consumption_id uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (plan_id, date, slot)
);
comment on column public.meal_plan_items.kcal is 'Ekleme anındaki ANLIK değer (tarif/ürün sonradan değişse de plan aynı kalır).';
comment on column public.meal_plan_items.logged_consumption_id is '"Logla" ile yazılan meal_consumptions.id (Geri al → NULL).';
create index if not exists meal_plan_items_user_date_idx on public.meal_plan_items (user_id, date);

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

drop policy if exists meal_plans_own on public.meal_plans;
create policy meal_plans_own on public.meal_plans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists meal_plan_items_own on public.meal_plan_items;
create policy meal_plan_items_own on public.meal_plan_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

revoke all on public.meal_plans from anon;
revoke all on public.meal_plan_items from anon;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plan_items to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 — shopping_list_items
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.shopping_list_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  week_start     date not null check (extract(isodow from week_start) = 1),
  name           text not null check (char_length(name) between 1 and 80),
  quantity       numeric(8,2),
  unit           text,
  category       text not null default 'other' check (category in ('produce', 'protein', 'dairy', 'grains', 'spices', 'other')),
  source         text not null default 'manual' check (source in ('plan', 'manual')),
  ingredient_key text,
  checked        boolean not null default false,
  removed        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.shopping_list_items is
  'G33-S1: alışveriş listesi. source plan → plandan türetilen malzemenin durumu (alındı/silindi, ingredient_key); manual → elle eklenen.';
-- Plan satırı başına tek durum satırı (manual satırlarda ingredient_key NULL → NULL'lar ayrık, çakışmaz).
-- Kısmi indeks DEĞİL: PostgREST upsert (on_conflict) tam kısıt ister.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shopping_list_items_plan_key_uq') then
    alter table public.shopping_list_items
      add constraint shopping_list_items_plan_key_uq unique (user_id, week_start, source, ingredient_key);
  end if;
end $$;
create index if not exists shopping_list_user_week_idx on public.shopping_list_items (user_id, week_start);

alter table public.shopping_list_items enable row level security;
drop policy if exists shopping_list_items_own on public.shopping_list_items;
create policy shopping_list_items_own on public.shopping_list_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.shopping_list_items from anon;
grant select, insert, update, delete on public.shopping_list_items to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 — updated_at
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public._g33_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meal_plans_touch on public.meal_plans;
create trigger meal_plans_touch before update on public.meal_plans
  for each row execute function public._g33_touch_updated_at();
drop trigger if exists meal_plan_items_touch on public.meal_plan_items;
create trigger meal_plan_items_touch before update on public.meal_plan_items
  for each row execute function public._g33_touch_updated_at();
drop trigger if exists shopping_list_items_touch on public.shopping_list_items;
create trigger shopping_list_items_touch before update on public.shopping_list_items
  for each row execute function public._g33_touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 6 — feature flag (KAPALI)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'ogun_plani', false, 0, '1.1.0',
  'G33-S1 (Tur 26m): Öğün planı + alışveriş listesi (Profil satırları, haftalık plan, oluşturma). Kapalı → gizli. Native modül yok → OTA.'
)
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 7 — user_consents: source 'meal_plan' (alerjen açık rızası, kind 'health_data')
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.user_consents') is null then
    raise notice 'g33_meal_plan: user_consents yok — CHECK güncellemesi atlandı';
    return;
  end if;
  alter table public.user_consents drop constraint if exists user_consents_source_check;
  alter table public.user_consents
    add constraint user_consents_source_check
    check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan', 'coach', 'takibe', 'meal_plan'));
end $$;

commit;
