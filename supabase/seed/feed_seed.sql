-- G5-S1 — Keşfet tohum verisi: "Kcalculate" kurum hesabı + 20 TR, 10 EN gönderi.
-- meal_card'lar GERÇEK `products` satırlarından SELECT ile alınır (sayı uydurulmaz).
-- Beden/ölçü fotoğrafı YOK. Yalnız DOSYA — staging'de test EDİLMEDİ, uygulanmadı.
-- Tekrar çalıştırılabilir (ON CONFLICT ... DO NOTHING).
--
-- NOT: Kcalculate kurum hesabının auth kullanıcısı sabit bir UUID ile oluşturulur
-- (yerel/staging seed deseni). Parola yoktur; oturum Auth Admin API ile açılır.
-- ═════════════════════════════════════════════════════════════════════════════

-- Sabit kurum kullanıcısı UUID'si (determinist — tekrar çalıştırmada aynı).
-- a11ce000-... "alliance/kurum" anımsatıcı, geçerli v4 biçiminde.
do $$
declare
  v_kurum uuid := 'a11ce000-0000-4000-8000-00000000ca10';
begin
  -- 1) auth kullanıcısı (yoksa)
  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, encrypted_password
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_kurum, 'authenticated', 'authenticated',
    'kurum@kcalculate.app', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Kcalculate"}'::jsonb, ''
  )
  on conflict (id) do nothing;

  -- 2) profil (açık hesap + @kcalculate)
  insert into public.profiles (id, full_name, handle, bio, is_private, role, created_at)
  values (v_kurum, 'Kcalculate', 'kcalculate',
          'Dengeli beslenme, gerçek tariflerle. 🥗', false, 'customer', now())
  on conflict (id) do update
    set full_name = excluded.full_name,
        handle    = coalesce(public.profiles.handle, excluded.handle),
        bio       = coalesce(public.profiles.bio, excluded.bio);

  -- 3) üretici kaydı (kurum, doğrulanmış, yazabilir)
  insert into public.creators (user_id, role, verified_at, can_post)
  values (v_kurum, 'kurum', now(), true)
  on conflict (user_id) do update
    set can_post = true, verified_at = coalesce(public.creators.verified_at, now());
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Gönderiler. meal_card GERÇEK products satırından türetilir.
--    kcal = coalesce(calories, cal); makro = protein/carbs/fats; foto = img.
--    Yalnız adı/kalorisi olan ürünler seçilir; sabit sıra için id'ye göre.
-- ─────────────────────────────────────────────────────────────────────────────
with kurum as (
  select 'a11ce000-0000-4000-8000-00000000ca10'::uuid as id
),
src as (
  select
    p.id as product_id,
    p.name,
    coalesce(p.calories, p.cal, 0)::numeric as kcal,
    coalesce(p.protein, 0)::numeric as protein_g,
    coalesce(p.carbs, 0)::numeric   as carbs_g,
    coalesce(p.fats, 0)::numeric    as fat_g,
    p.img,
    row_number() over (order by p.id) as rn
  from public.products p
  where p.name is not null
    and coalesce(p.calories, p.cal) is not null
    and coalesce(p.is_available, true) = true
  order by p.id
  limit 30
),
-- TR: ilk 20 ürün · EN: sonraki 10 ürün (yetmezse baştan döner)
plan as (
  select rn, product_id, name, kcal, protein_g, carbs_g, fat_g, img,
         case when rn <= 20 then 'tr' else 'en' end as lang,
         case when rn <= 20 then rn else rn - 20 end as idx
  from src
)
insert into public.posts
  (author_id, lang, body, meal_card, status, published_at)
select
  (select id from kurum),
  pl.lang,
  case when pl.lang = 'tr'
    then pl.name || ' — yaklaşık ' || round(pl.kcal)::text || ' kcal, ' ||
         round(pl.protein_g)::text || ' g protein. Dengeli bir öğün için günlük hedefine göre porsiyonunu ayarla.'
    else pl.name || ' — about ' || round(pl.kcal)::text || ' kcal and ' ||
         round(pl.protein_g)::text || ' g protein. Adjust the portion to fit your daily target.'
  end,
  jsonb_build_object(
    'name',         pl.name,
    'kcal',         round(pl.kcal),
    'protein_g',    pl.protein_g,
    'carbs_g',      pl.carbs_g,
    'fat_g',        pl.fat_g,
    'portion_label','1 porsiyon',
    'photo_url',    pl.img,
    'product_id',   pl.product_id
  ),
  'published',
  now() - (pl.rn::text || ' hours')::interval   -- en yeni en üstte
from plan pl
-- kurum hesabının aynı ürün için zaten gönderisi varsa tekrar ekleme (idempotent-ish)
where not exists (
  select 1 from public.posts x
  where x.author_id = (select id from kurum)
    and x.meal_card->>'product_id' = pl.product_id::text
);
