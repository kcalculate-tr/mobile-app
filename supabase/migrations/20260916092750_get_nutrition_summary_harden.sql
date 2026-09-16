-- Görev 1.1 güvenlik sertleştirmesi.
--
-- Doğrulama: get_nutrition_summary SECURITY INVOKER'dı ve altındaki
-- user_nutrition_profiles/meal_consumptions tabloları "select own"
-- (user_id = auth.uid()) RLS politikalarıyla korunuyordu; A kullanıcısının
-- oturumuyla B'nin id'si gönderildiğinde test edildi — sonuç tüm alanlarda 0
-- döndü (B'nin gerçek verisi sızmadı). Yani fiili bir veri sızıntısı yoktu.
--
-- Yine de savunma derinliği için: p_user_id parametresi tamamen kaldırılıyor
-- (spoof edilecek bir alan bırakılmıyor, fonksiyon her zaman çağıranın
-- auth.uid()'sini kullanıyor) ve fonksiyonun EXECUTE yetkisi anon/PUBLIC'ten
-- alınıp yalnızca authenticated rolüne veriliyor (önceden şema varsayılan
-- yetkilendirmesiyle anon'da da EXECUTE vardı).
drop function if exists public.get_nutrition_summary(uuid, date);

create function public.get_nutrition_summary(
  p_date date default (now() at time zone 'Europe/Istanbul')::date
)
returns table (
  target_kcal integer,
  target_protein integer,
  target_carb integer,
  target_fat integer,
  consumed_kcal numeric,
  consumed_protein numeric,
  consumed_carb numeric,
  consumed_fat numeric,
  remaining_kcal numeric,
  remaining_protein numeric,
  remaining_carb numeric,
  remaining_fat numeric
)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (p_date::timestamp at time zone 'Europe/Istanbul') as day_start,
      ((p_date + 1)::timestamp at time zone 'Europe/Istanbul') as day_end
  ),
  targets as (
    select
      coalesce(unp.target_calories, 0) as target_kcal,
      coalesce(unp.target_protein, 0) as target_protein,
      coalesce(unp.target_carbs, 0) as target_carb,
      coalesce(unp.target_fat, 0) as target_fat
    from (select auth.uid() as user_id) u
    left join public.user_nutrition_profiles unp on unp.user_id = u.user_id
  ),
  consumed as (
    select
      coalesce(sum(mc.calories), 0) as consumed_kcal,
      coalesce(sum(mc.protein), 0) as consumed_protein,
      coalesce(sum(mc.carbs), 0) as consumed_carb,
      coalesce(sum(mc.fat), 0) as consumed_fat
    from bounds, public.meal_consumptions mc
    where mc.user_id = auth.uid()
      and mc.consumed_at >= bounds.day_start
      and mc.consumed_at < bounds.day_end
  )
  select
    t.target_kcal, t.target_protein, t.target_carb, t.target_fat,
    c.consumed_kcal, c.consumed_protein, c.consumed_carb, c.consumed_fat,
    greatest(t.target_kcal - c.consumed_kcal, 0) as remaining_kcal,
    greatest(t.target_protein - c.consumed_protein, 0) as remaining_protein,
    greatest(t.target_carb - c.consumed_carb, 0) as remaining_carb,
    greatest(t.target_fat - c.consumed_fat, 0) as remaining_fat
  from targets t, consumed c;
$$;

revoke all on function public.get_nutrition_summary(date) from public;
revoke all on function public.get_nutrition_summary(date) from anon;
grant execute on function public.get_nutrition_summary(date) to authenticated;
