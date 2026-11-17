-- Geri alma: 20261117210100_g58s2_ucretsiz_ogun_kuponu.sql
-- referral_on_delivery ve my_referral G56 gövdelerine (20261116200100_g56_eatkcal_growth.sql) BİREBİR döner;
-- yeni fonksiyonlar/tablolar kaldırılır. DİKKAT: free_meal_grants silinir — üretilmiş kuponlar (campaigns
-- satırları, source in ('referral','izmir_fresh')) KALIR (kullanıcıya verilmiş hak geri alınmaz).

drop function if exists public.mark_free_meal_notices_seen(uuid[]);
drop function if exists public.my_free_meal_notices();
drop function if exists public.record_subscription_offer(text);
drop table if exists public.subscription_offer_intents;

create or replace function public.referral_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_reward numeric;
  v_min numeric;
  v_amount numeric;
  v_user uuid;
begin
  if new.status <> 'delivered' then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  if new.user_id is null then return new; end if;
  if coalesce(new.type, '') = 'macro_purchase' then return new; end if;
  if coalesce(new.payment_status, '') <> 'paid' then return new; end if; -- Macro motoruyla aynı kural

  select * into r from public.referrals where referee_id = new.user_id and status = 'pending' for update;
  if not found then return new; end if;

  -- Yalnız İLK teslim edilmiş sipariş: başka teslim edilmiş siparişi varsa davet ödülsüz kapanır.
  if exists (select 1 from public.orders o where o.user_id = new.user_id and o.status = 'delivered' and o.id <> new.id) then
    update public.referrals set status = 'void', void_reason = 'not_first_order', order_id = new.id where id = r.id;
    return new;
  end if;

  if public.referral_same_person(r.referrer_id, r.referee_id) then
    update public.referrals set status = 'void', void_reason = 'same_person', order_id = new.id where id = r.id;
    return new;
  end if;

  select referral_reward_tl, referral_min_order_tl into v_reward, v_min from public.settings where id = 1;
  if v_reward is null or v_reward <= 0 then
    return new; -- ödül ayarı yok → bekler (kupon verilmez)
  end if;

  v_amount := coalesce(new.subtotal_amount, new.total_amount, new.total_price, 0);
  if v_amount < coalesce(v_min, 0) then
    update public.referrals set status = 'void', void_reason = 'below_min', order_id = new.id where id = r.id;
    return new;
  end if;

  foreach v_user in array array[r.referrer_id, r.referee_id] loop
    insert into public.campaigns (
      title, description, code, badge,
      discount_type, discount_value, min_cart_total,
      is_active, status, "order", start_date, end_date,
      user_id, max_uses_per_user, max_uses_total, source
    ) values (
      format('Davet kuponu %s TL', trim(trailing '.' from to_char(v_reward, 'FM999999990.##'))),
      'Arkadaşını davet et ödülü. Tek kullanımlık.',
      'DAVET' || upper(substr(md5(random()::text || r.id::text || v_user::text), 1, 6)),
      'Davet',
      'fixed', v_reward, coalesce(v_min, 0),
      true, 'active', 0, current_date, current_date + 90,
      v_user, 1, 1, 'referral'
    );
  end loop;

  update public.referrals set status = 'earned', earned_at = now(), order_id = new.id where id = r.id;
  return new;
-- 16 Kas (güvenlik): davet mantığındaki hiçbir hata sipariş durum güncellemesini (teslim) DURDURMAZ.
exception when others then
  raise warning 'referral_on_delivery(%): %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.referral_on_delivery() from public;

create or replace function public.my_referral()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_reward numeric;
  v_min numeric;
  v_history jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  select code into v_code from public.referral_codes where user_id = v_uid;
  if v_code is null then
    insert into public.referral_codes (user_id, code)
    values (v_uid, public.gen_referral_code())
    on conflict (user_id) do nothing;
    select code into v_code from public.referral_codes where user_id = v_uid;
  end if;
  select referral_reward_tl, referral_min_order_tl into v_reward, v_min from public.settings where id = 1;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'name', nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''),
                          case when nullif(trim(p.last_name), '') is not null then left(trim(p.last_name), 1) || '.' end)), ''),
           'status', r.status,
           'created_at', r.created_at,
           'earned_at', r.earned_at
         ) order by r.created_at desc), '[]'::jsonb)
    into v_history
    from public.referrals r
    left join public.profiles p on p.id = r.referee_id
   where r.referrer_id = v_uid;
  return jsonb_build_object('ok', true, 'code', v_code, 'reward_tl', v_reward, 'min_order_tl', v_min, 'history', v_history);
end;
$$;
revoke all on function public.my_referral() from public;
grant execute on function public.my_referral() to authenticated;

drop function if exists public.void_free_meals(uuid, text, text);
drop function if exists public.grant_free_meals(uuid, text, text, integer);
drop table if exists public.free_meal_grants;

alter table public.settings drop column if exists free_meal_valid_days;
alter table public.settings drop column if exists free_meal_excluded_categories;
alter table public.settings drop column if exists free_meal_max_tl;
