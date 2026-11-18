-- G62-S1 — eatkcal siparişi değerlendir (v2) (18 Kas).
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261118120100_g62_order_rating_rollback.sql
--
-- v1 (canlı) ÜSTÜNE kurulur, veri kaybı yok — yalnız sütun EKLEME:
--   reviews (id, order_id, user_id, rating int2, comment, is_approved, created_at, admin_reply*, reply_seen_at)
--   review_item_feedback (id, review_id, order_id, user_id, product_id, product_name, liked, created_at)
-- İçerik:
--  1) feature_flags: siparis_degerlendirme (KAPALI, rollout 0, min 1.1.0).
--  2) reviews + delivery / calorie_fit / taste (1–5, FinEkRateSheet'in üç başlığı), photo_path
--     (user-media kovası, `<uid>/reviews/…`), version (v1 = 1, v2 = 2), moderation_id (uuid; moderasyon
--     kuyruğu/şikâyet tabloları uuid hedef ister, reviews.id bigint). `rating` = üç başlığın yuvarlanmış
--     ortalaması → restoran puanı ve tüm eski okuyucular (Boss paneli, vitrin, Yorumlarım) DEĞİŞMEDEN çalışır.
--  3) review_item_feedback + tags text[] (beyaz liste; ürün başına en fazla 6).
--  4) submit_order_rating(...) — tek yazma yolu (security definer): sahiplik, "teslim edildi",
--     7 gün penceresi, sipariş başına TEK değerlendirme (sipariş satırı kilitli), yorum ≤ 500,
--     ürün oyları yalnız siparişteki ürünlere; yorum/fotoğraf varsa moderation_queue('review').
--  5) restaurant_rating: alt boyutlar artık v2 sütunlarından (NULL'lar ortalamaya girmez; v2 satırı
--     yoksa NULL → istemci çizmez). Ana kural AYNEN: son 90 gün, tüm puanlar, <10 → is_new.
--  6) Moderasyon: content_reports / moderation_actions / moderation_queue hedef türlerine 'review'.
--  7) analytics_event_names: order_rate_prompt, order_rate_submit.
begin;

-- ─── 1) Bayrak ────────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'siparis_degerlendirme', false, 0, '1.1.0',
  'G62-S1: eatkcal siparişi değerlendir v2 (Teslimat / Kalori uyumu / Lezzet + ürün oyu + yorum + fotoğraf). Kapalıyken v1 akışı. Native yok → OTA.'
)
on conflict (key) do nothing;

-- ─── 2) reviews v2 sütunları ──────────────────────────────────────────────────
alter table public.reviews add column if not exists delivery    smallint;
alter table public.reviews add column if not exists calorie_fit smallint;
alter table public.reviews add column if not exists taste       smallint;
alter table public.reviews add column if not exists photo_path  text;
alter table public.reviews add column if not exists version     smallint not null default 1;
alter table public.reviews add column if not exists moderation_id uuid not null default gen_random_uuid();

alter table public.reviews drop constraint if exists reviews_v2_dims_check;
alter table public.reviews add  constraint reviews_v2_dims_check check (
  (delivery    is null or delivery    between 1 and 5) and
  (calorie_fit is null or calorie_fit between 1 and 5) and
  (taste       is null or taste       between 1 and 5)
);
alter table public.reviews drop constraint if exists reviews_photo_path_check;
alter table public.reviews add  constraint reviews_photo_path_check check (
  photo_path is null or (
    photo_path like user_id::text || '/reviews/%' and position('..' in photo_path) = 0 and length(photo_path) <= 200
  )
);
create unique index if not exists reviews_moderation_id_key on public.reviews (moderation_id);
create index if not exists reviews_order_id_idx on public.reviews (order_id);

comment on column public.reviews.version is 'G62: 1 = v1 (tek puan), 2 = v2 (Teslimat / Kalori uyumu / Lezzet; rating = yuvarlanmış ortalama).';
comment on column public.reviews.moderation_id is 'G62: moderation_queue / content_reports hedef kimliği (uuid).';

-- ─── 3) Ürün etiketleri ───────────────────────────────────────────────────────
alter table public.review_item_feedback add column if not exists tags text[] not null default '{}';
alter table public.review_item_feedback drop constraint if exists review_item_feedback_tags_check;
alter table public.review_item_feedback add  constraint review_item_feedback_tags_check
  check (cardinality(tags) <= 6);

-- ─── 4) submit_order_rating ───────────────────────────────────────────────────
-- Etiket beyaz listesi = istemci src/modules/eatkcal/v2/model/orderRate.ts ITEM_TAGS.
create or replace function public.submit_order_rating(
  p_order_id    bigint,
  p_delivery    integer,
  p_calorie_fit integer,
  p_taste       integer,
  p_comment     text    default null,
  p_photo_path  text    default null,
  p_items       jsonb   default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_order   record;
  v_at      timestamptz;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_photo   text := nullif(btrim(coalesce(p_photo_path, '')), '');
  v_rating  smallint;
  v_review  bigint;
  v_mod     uuid;
  v_item    jsonb;
  v_pid     integer;
  v_name    text;
  v_tags    text[];
  v_n       integer := 0;
  c_tags    constant text[] := array[
    'lezzetli', 'doyurucu', 'taze', 'porsiyon_iyi', 'kalori_tutarli',
    'soguk', 'az_porsiyon', 'tuzlu_yagli', 'eksik_urun', 'kalori_tutmadi'
  ];
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  -- Sipariş satırı kilitlenir: aynı siparişe eşzamanlı iki gönderim tek değerlendirme bırakır.
  select o.id, o.user_id, o.status, o.items, o.delivered_at, o.updated_at
    into v_order
    from public.orders o
   where o.id = p_order_id
   for update;
  if not found or v_order.user_id is distinct from v_uid then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_order.status is distinct from 'delivered' then
    raise exception 'not_delivered' using errcode = 'P0001';
  end if;
  v_at := coalesce(v_order.delivered_at, v_order.updated_at);
  if v_at is null or v_at < now() - interval '7 days' then
    raise exception 'expired' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reviews r where r.order_id = p_order_id) then
    raise exception 'already_rated' using errcode = 'P0001';
  end if;
  if p_delivery is null or p_calorie_fit is null or p_taste is null
     or p_delivery not between 1 and 5 or p_calorie_fit not between 1 and 5 or p_taste not between 1 and 5 then
    raise exception 'bad_rating' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 500 then
    raise exception 'comment_too_long' using errcode = '22023';
  end if;
  if v_photo is not null and (
       v_photo not like v_uid::text || '/reviews/%' or position('..' in v_photo) > 0 or length(v_photo) > 200
     ) then
    raise exception 'bad_photo' using errcode = '22023';
  end if;

  v_rating := round((p_delivery + p_calorie_fit + p_taste)::numeric / 3)::smallint;

  insert into public.reviews (order_id, user_id, rating, comment, is_approved,
                              delivery, calorie_fit, taste, photo_path, version)
  values (p_order_id, v_uid, v_rating, v_comment, false,
          p_delivery, p_calorie_fit, p_taste, v_photo, 2)
  returning id, moderation_id into v_review, v_mod;

  -- Ürün oyları: yalnız bu siparişteki ürünler; ad sipariş ANINDAKİ hâliyle (orders.items).
  if jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) limit 30 loop
      begin
        v_pid := (v_item ->> 'product_id')::integer;
      exception when others then
        v_pid := null;
      end;
      continue when v_pid is null or jsonb_typeof(v_item -> 'liked') <> 'boolean';
      select e ->> 'name' into v_name
        from jsonb_array_elements(case when jsonb_typeof(v_order.items) = 'array' then v_order.items else '[]'::jsonb end) e
       where (e ->> 'id') ~ '^[0-9]+$' and (e ->> 'id')::integer = v_pid
       limit 1;
      continue when not found;
      select coalesce(array_agg(distinct t), '{}') into v_tags
        from (
          select t from jsonb_array_elements_text(
            case when jsonb_typeof(v_item -> 'tags') = 'array' then v_item -> 'tags' else '[]'::jsonb end
          ) t
          where t = any (c_tags)
          limit 6
        ) s;
      insert into public.review_item_feedback (review_id, order_id, user_id, product_id, product_name, liked, tags)
      values (v_review, p_order_id, v_uid, v_pid, v_name, (v_item ->> 'liked')::boolean, v_tags)
      on conflict (order_id, user_id, product_id) do nothing;
      v_n := v_n + 1;
    end loop;
  end if;

  -- Yorum ya da fotoğraf varsa AI denetimi (moderate-content target_type 'review'); onaylanınca
  -- is_approved = true → herkese açık yorum listelerine (yalnız onaylılar) girer.
  if v_comment is not null or v_photo is not null then
    insert into public.moderation_queue (target_type, target_id)
    values ('review', v_mod)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'review_id', v_review,
    'moderation_id', v_mod,
    'rating', v_rating,
    'items', v_n,
    'moderation', (v_comment is not null or v_photo is not null)
  );
end;
$$;

comment on function public.submit_order_rating(bigint, integer, integer, integer, text, text, jsonb) is
  'G62-S1: sipariş değerlendirmesi v2 — sahiplik + teslim + 7 gün + tek kez; rating = 3 başlığın yuvarlanmış ortalaması.';
revoke all on function public.submit_order_rating(bigint, integer, integer, integer, text, text, jsonb) from public, anon;
grant execute on function public.submit_order_rating(bigint, integer, integer, integer, text, text, jsonb) to authenticated;

-- ─── 5) restaurant_rating — alt boyutlar v2'den ───────────────────────────────
-- G22-S1 gövdesi AYNEN (son 90 gün, tüm puanlar, <10 → is_new); yalnız üç NULL sütun dolduruldu.
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
    select rv.rating, rv.taste, rv.delivery, rv.calorie_fit
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
    round(avg(r.taste)::numeric, 2),
    round(avg(r.delivery)::numeric, 2),
    round(avg(r.calorie_fit)::numeric, 2),
    now() - interval '90 days'
  from r;
$$;

comment on function public.restaurant_rating(uuid) is
  'G22-S1 + G62-S1: son 90 gün puan ortalaması + sayı; <10 değerlendirme → is_new; alt boyutlar v2 satırlarından. NULL şube = tümü.';
revoke all on function public.restaurant_rating(uuid) from public;
grant execute on function public.restaurant_rating(uuid) to anon, authenticated;

-- ─── 6) Moderasyon — 'review' hedefi ──────────────────────────────────────────
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add  constraint content_reports_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review'));

alter table public.moderation_actions drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions add  constraint moderation_actions_target_type_check
  check (target_type in ('post', 'user', 'day_card', 'comment', 'story', 'review'));

alter table public.moderation_queue drop constraint if exists moderation_queue_target_type_check;
alter table public.moderation_queue add  constraint moderation_queue_target_type_check
  check (target_type in ('post', 'comment', 'story', 'review'));

-- ─── 7) Olay adları ───────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g62_order_rating: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('order_rate_prompt', 'commerce', 'client', 'Sipariş değerlendirme istemi görüldü', 'Order rating prompt shown', 'order_id: id, surface: home|order_detail', null, false),
    ('order_rate_submit', 'commerce', 'client', 'Sipariş değerlendirmesi gönderildi', 'Order rating submitted', 'order_id: id, rating: number, delivery/calorie_fit/taste: number, item_count: number, has_comment: boolean, has_photo: boolean, surface', null, false)
  on conflict (name) do nothing;
end $$;

commit;
