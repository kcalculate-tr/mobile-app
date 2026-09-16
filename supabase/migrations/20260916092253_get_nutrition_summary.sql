-- Görev 1.1 (Sprint 1): Kcalculate / Profil / Ana sayfa arasındaki hedef-tüketilen-kalan
-- rakam farkının kök nedeni: ProfileScreen.tsx `user_nutrition_profiles.daily_calories_goal`
-- (böyle bir kolon yok) ve legacy `meal_logs` tablosunu okuyordu; hiçbir yazma yolu bu
-- kolon/tabloya veri yazmıyordu. Tracker ise güncel `target_calories/target_protein/
-- target_carbs/target_fat` + `meal_consumptions`'ı kullanıyordu. Bu fonksiyon tek,
-- sunucu taraflı kaynak olarak üç ekranın da kullanacağı hedef/tüketilen/kalan
-- değerlerini döner; gün sınırı Europe/Istanbul saat dilimine göre hesaplanır.
--
-- RLS notu: fonksiyon SECURITY INVOKER (varsayılan) olarak tanımlıdır; çağıranın
-- auth.uid()'sinden farklı bir p_user_id verilse dahi user_nutrition_profiles ve
-- meal_consumptions üzerindeki mevcut "select own" RLS politikaları satırları
-- görünmez kılar, dolayısıyla başka bir kullanıcının verisi sızmaz.
create or replace function public.get_nutrition_summary(
  p_user_id uuid,
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
    from (select p_user_id as user_id) u
    left join public.user_nutrition_profiles unp on unp.user_id = u.user_id
  ),
  consumed as (
    select
      coalesce(sum(mc.calories), 0) as consumed_kcal,
      coalesce(sum(mc.protein), 0) as consumed_protein,
      coalesce(sum(mc.carbs), 0) as consumed_carb,
      coalesce(sum(mc.fat), 0) as consumed_fat
    from bounds, public.meal_consumptions mc
    where mc.user_id = p_user_id
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

grant execute on function public.get_nutrition_summary(uuid, date) to authenticated;
