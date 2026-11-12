-- G22-S1 md.6 — Restoran puanı (son 3 ay).
-- version: 20261110100200  name: g22_s1_restaurant_rating
--
-- DURUM: YALNIZ DOSYA (gece kuralı) — canlıya UYGULANMADI. İdempotent.
-- Geri alma: supabase/rollbacks/20261110100200_g22_s1_restaurant_rating_rollback.sql
--
-- restaurant_rating(p_branch_id uuid default null) → tek satır:
--   branch_id, average (1–5, 2 ondalık; yarım yıldız yuvarlama İSTEMCİDE), review_count,
--   is_new (review_count < 10), taste / delivery / calorie_fit (alt boyutlar), since.
-- Kaynak: reviews (rating int2) ⋈ orders (branch_id) — son 90 gün (created_at).
-- p_branch_id NULL = tüm şubeler (eatkcal mağazası marka bazlı; istemcide seçili şube yok).
--
-- Alt boyutlar: CANLI_SEMA_2026-11-09.md'de `reviews` yalnız `rating` taşıyor (lezzet /
-- teslimat / kalori uyumu kolonu YOK) → üçü de NULL döner; istemci NULL'ı çizmez
-- (ReviewsSheet "veri yoksa çizilmez" kuralı). Kolonlar eklenirse yalnız bu fonksiyon
-- güncellenir (istemci sözleşmesi aynı).
--
-- Puan = verilen yıldız (yorum metni değil): onay (is_approved) yorum METNİNİN moderasyonu
-- olduğu için ortalamaya tüm puanlar girer (KARAR, G22-S1-LOG). Kişisel veri dönmez
-- (yalnız toplu sayı) → SECURITY DEFINER + anon/authenticated'a açık.
begin;

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

create or replace function public.restaurant_rating(p_branch_id uuid default null)
returns table (
  branch_id    uuid,
  average      numeric,
  review_count integer,
  is_new       boolean,
  taste        numeric,
  delivery     numeric,
  calorie_fit  numeric,
  since        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select rv.rating
      from public.reviews rv
      join public.orders o on o.id = rv.order_id
     where rv.created_at >= now() - interval '90 days'
       and rv.rating between 1 and 5
       and (p_branch_id is null or o.branch_id = p_branch_id)
  )
  select
    p_branch_id,
    case when count(*) = 0 then null else round(avg(r.rating)::numeric, 2) end,
    count(*)::int,
    count(*) < 10,
    null::numeric,
    null::numeric,
    null::numeric,
    now() - interval '90 days'
  from r;
$$;

comment on function public.restaurant_rating(uuid) is
  'G22-S1: son 90 gün puan ortalaması + sayı; <10 değerlendirme → is_new. NULL şube = tümü.';

revoke all on function public.restaurant_rating(uuid) from public;
grant execute on function public.restaurant_rating(uuid) to anon, authenticated;

commit;
