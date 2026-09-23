-- profiles.macro_points TANIM GEREĞİ eşiğin altındaki artıktır (trigger her
-- zaman v_remainder yazar). Eski macro modelinden devreden satırlarda bu
-- değer eşiğin çok üstünde kalmış (ör. 1620) ve hem sipariş özetindeki
-- "kazanacağın Macro" önizlemesini hem de GERÇEK kazanımı şişiriyordu:
-- floor((1620 + 585) / 500) = 4.
--
-- Artık aralık dışı bir artık 0 sayılıyor. Eski modelin puanının yeni
-- modelde tanımlı bir karşılığı yok; modülünü almak da uydurma olurdu.
-- İstemci tarafındaki eşi: src/lib/macros.ts -> normalizeCarryover().
create or replace function public.grant_macros_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s              record;
  v_profile      record;
  v_points       numeric;
  v_accumulated  numeric;
  v_earned       int;
  v_remainder    numeric;
  v_balance      int;
  v_coupon_count int;
  v_code         text;
  i              int;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status <> 'delivered' then return new; end if;
  if coalesce(new.payment_status, '') <> 'paid' then return new; end if;
  if coalesce(new.type, '') = 'macro_purchase' then return new; end if;
  if new.user_id is null then return new; end if;
  if coalesce(new.total_price, 0) <= 0 then return new; end if;

  if exists (
    select 1 from public.macro_transactions
     where order_id = new.id and type = 'order_earn'
  ) then
    return new;
  end if;

  select macro_earn_threshold, macro_meal_cost, macro_reward_valid_days,
         macro_meal_min_cart, macro_meal_max_value, macro_meal_excluded_categories,
         macro_rewards_enabled
    into s
    from public.settings where id = 1;

  if s.macro_earn_threshold is null or s.macro_earn_threshold <= 0 then
    return new;
  end if;

  select coalesce(macro_balance, 0) as balance, coalesce(macro_points, 0) as points
    into v_profile
    from public.profiles where id = new.user_id;
  if not found then return new; end if;

  -- ARALIK KORUMASI: artık [0, eşik) dışındaysa güvenilmez, 0 sayılır.
  v_points := v_profile.points;
  if v_points < 0 or v_points >= s.macro_earn_threshold then
    v_points := 0;
  end if;

  v_accumulated := v_points + new.total_price;
  v_earned      := floor(v_accumulated / s.macro_earn_threshold)::int;
  v_remainder   := v_accumulated - (v_earned * s.macro_earn_threshold);

  perform set_config('app.macro_engine', 'on', true);

  if v_earned <= 0 then
    update public.profiles set macro_points = v_remainder where id = new.user_id;
    perform set_config('app.macro_engine', '', true);
    return new;
  end if;

  v_balance := v_profile.balance + v_earned;

  insert into public.macro_transactions (user_id, type, amount, price_paid, order_id, note)
  values (new.user_id, 'order_earn', v_earned, 0, new.id,
          format('Siparişten %s Macro kazanıldı (₺%s)', v_earned, round(new.total_price::numeric, 2)));

  -- EMNİYET ANAHTARI: kapalıyken Macro birikir ama kupona DÖNÜŞTÜRÜLMEZ.
  -- Sebep: ödeme başlatma fonksiyonu free_item kuponunu 0 indirim olarak
  -- yeniden hesaplıyor; müşteri sepette bedava görüp tam ücret ödüyordu.
  if coalesce(s.macro_rewards_enabled, false) then
    v_coupon_count := floor(v_balance / greatest(s.macro_meal_cost, 1))::int;
  else
    v_coupon_count := 0;
  end if;

  for i in 1..greatest(v_coupon_count, 0) loop
    v_code := 'OGUN' || to_char(now(), 'YYMMDD')
              || upper(substr(md5(random()::text || new.id::text || i::text), 1, 5));

    insert into public.campaigns (
      title, description, code, badge,
      discount_type, discount_value, max_discount, min_cart_total,
      is_active, status, "order", start_date, end_date,
      user_id, max_uses_per_user, max_uses_total,
      excluded_categories, source
    ) values (
      'Ücretsiz Öğün',
      format('%s Macro karşılığı tek öğün hediye. Koli ve çoklu tabaklarda geçerli değildir.', s.macro_meal_cost),
      v_code, 'Macro Ödülü',
      'free_item', 0, coalesce(s.macro_meal_max_value, 0), coalesce(s.macro_meal_min_cart, 0),
      true, 'active', 0, current_date, current_date + coalesce(s.macro_reward_valid_days, 90),
      new.user_id, 1, 1,
      s.macro_meal_excluded_categories, 'macro_reward'
    );

    insert into public.macro_transactions (user_id, type, amount, price_paid, order_id, note)
    values (new.user_id, 'meal_reward', -s.macro_meal_cost, 0, new.id,
            format('Ücretsiz öğün kuponu üretildi (%s)', v_code));
  end loop;

  v_balance := v_balance - (v_coupon_count * s.macro_meal_cost);

  update public.profiles
     set macro_balance = v_balance,
         macro_points  = v_remainder,
         total_macros_purchased = coalesce(total_macros_purchased, 0) + v_earned
   where id = new.user_id;

  perform set_config('app.macro_engine', '', true);
  return new;
end;
$$;
