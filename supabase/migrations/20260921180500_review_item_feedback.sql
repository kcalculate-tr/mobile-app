-- Sipariş değerlendirmesinde ÜRÜN BAZINDA beğendim/beğenmedim.
-- reviews tablosu sipariş için tek puan tutuyor; hangi ürünün beğenildiği
-- bilgisi orada yok. Mutfak tarafı için asıl değerli sinyal bu.
create table if not exists public.review_item_feedback (
  id            bigserial primary key,
  review_id     bigint      references public.reviews(id) on delete cascade,
  order_id      integer     not null,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  product_id    integer     not null,
  -- Ürün adı sipariş ANINDAKİ haliyle saklanıyor: katalogdan kalkan ya da
  -- adı değişen üründe geçmiş geri bildirim okunamaz hale gelmesin.
  product_name  text,
  liked         boolean     not null,
  created_at    timestamptz not null default now(),
  -- Bir kullanıcı aynı siparişteki aynı ürüne tek kez oy verir.
  unique (order_id, user_id, product_id)
);

create index if not exists review_item_feedback_product_idx
  on public.review_item_feedback (product_id, liked);
create index if not exists review_item_feedback_order_idx
  on public.review_item_feedback (order_id);

alter table public.review_item_feedback enable row level security;

drop policy if exists review_item_feedback_select_own on public.review_item_feedback;
create policy review_item_feedback_select_own
  on public.review_item_feedback for select
  using (auth.uid() = user_id);

drop policy if exists review_item_feedback_insert_own on public.review_item_feedback;
create policy review_item_feedback_insert_own
  on public.review_item_feedback for insert
  with check (auth.uid() = user_id);
