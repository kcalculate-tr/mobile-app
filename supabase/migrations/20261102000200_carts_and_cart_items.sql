-- S1 düzeltme 3b — Sunucu taraflı sepet kalıcılığı (carts / cart_items)
--
-- Durum: Canlıda sepet SADECE istemci tarafında (AsyncStorage) tutuluyor;
-- hiçbir cart/sepet/basket tablosu yok. Cihaz değişince / oturum yenilenince
-- sepet kayboluyor, çapraz cihaz senkron yok, "sepet terk" push'u (cron 16)
-- yalnızca orders taslaklarına bakabiliyor.
--
-- Bu migration kullanıcı başına kalıcı bir sepet + satırları ekler. RLS:
-- kullanıcı YALNIZCA kendi sepetini görür/yazar. order_items ile aynı
-- biçim (selected_options jsonb, quantity, unit_price) kullanıldı.
--
-- Geriye uyumlu (yalnızca yeni tablolar; mevcut akış bozulmaz).
-- staging MCP oturumda olmadığı için BU MIGRATION TEST EDİLMEDİ.

begin;

-- 1) carts — kullanıcı başına tek aktif sepet.
create table if not exists public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  branch_id  uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_user_unique unique (user_id)
);

create index if not exists carts_user_id_idx on public.carts(user_id);

-- 2) cart_items — sepet satırları.
create table if not exists public.cart_items (
  id               uuid primary key default gen_random_uuid(),
  cart_id          uuid not null references public.carts(id) on delete cascade,
  product_id       bigint not null references public.products(id) on delete cascade,
  quantity         integer not null default 1 check (quantity > 0),
  selected_options jsonb not null default '[]'::jsonb,
  unit_price       numeric,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists cart_items_cart_id_idx on public.cart_items(cart_id);
create index if not exists cart_items_product_id_idx on public.cart_items(product_id);

-- 3) updated_at dokunma trigger'ları (mevcut touch_updated_at kalıbı).
drop trigger if exists carts_touch_updated on public.carts;
create trigger carts_touch_updated
  before update on public.carts
  for each row execute function public.touch_updated_at();

drop trigger if exists cart_items_touch_updated on public.cart_items;
create trigger cart_items_touch_updated
  before update on public.cart_items
  for each row execute function public.touch_updated_at();

-- 4) RLS — kullanıcı yalnızca kendi sepeti. auth.uid() initplan için (select ...).
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

create policy carts_select_own on public.carts
  for select to authenticated using (user_id = (select auth.uid()));
create policy carts_insert_own on public.carts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy carts_update_own on public.carts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy carts_delete_own on public.carts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy cart_items_select_own on public.cart_items
  for select to authenticated
  using (exists (select 1 from public.carts c
                  where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));
create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (exists (select 1 from public.carts c
                       where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));
create policy cart_items_update_own on public.cart_items
  for update to authenticated
  using (exists (select 1 from public.carts c
                  where c.id = cart_items.cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c
                       where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));
create policy cart_items_delete_own on public.cart_items
  for delete to authenticated
  using (exists (select 1 from public.carts c
                  where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));

commit;
