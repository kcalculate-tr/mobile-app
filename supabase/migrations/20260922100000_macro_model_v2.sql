-- Macro modeli v2 — "harcadıkça kazan, öğün olarak kullan"
--
-- Eski model (coin satın al -> 15 coin -> 30 gün %20 ayrıcalıklı üyelik) hiç
-- kullanılmadı: 609 profilin hiçbirinde bakiye, satın alım veya aktif üyelik yok.
-- Bu yüzden geriye dönük göç gerekmiyor, model doğrudan değiştiriliyor.
--
-- Yeni model:
--   * Her `macro_earn_threshold` TL (varsayılan 500) net ödeme = 1 Macro
--   * `macro_meal_cost` Macro (varsayılan 5) birikince otomatik olarak
--     kişiye özel "Ücretsiz Öğün" kuponu üretilir ve bakiyeden düşülür
--   * Kupon tekil öğünlerde geçerli; koli/çoklu tabak kategorileri hariç
--
-- KRİTİK GÜVENLİK: kazanım artık client'tan değil, sipariş "delivered"
-- olduğunda tetiklenen trigger'dan yapılıyor. Ayrıca profiles üzerindeki
-- hassas kolonlara istemci UPDATE yetkisi kaldırılıyor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) profiles: istemci artık bakiye/rol/ayrıcalık yazamaz
-- ─────────────────────────────────────────────────────────────────────────────
-- profiles_update_own politikası (id = auth.uid()) satır bazında doğru, ama
-- kolon yetkileri macro_balance, role, privileged_until gibi alanları da
-- kapsıyordu. Tek bir API çağrısıyla kendine bedava öğün tanımlamak mümkündü.
revoke update (
  id, created_at, role, branch_id,
  macro_balance, macro_points, privileged_until, total_macros_purchased,
  payment_customer_key
) on public.profiles from authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) settings: model parametreleri veritabanında (uygulamaya gömülü değil)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.settings
  add column if not exists macro_earn_threshold      numeric  not null default 500,
  add column if not exists macro_meal_cost           integer  not null default 5,
  add column if not exists macro_reward_valid_days   integer  not null default 90,
  add column if not exists macro_meal_min_cart       numeric  not null default 0,
  add column if not exists macro_meal_max_value      numeric  not null default 0,
  add column if not exists macro_meal_excluded_categories text[] not null
      default array['Koliye Özel Fırsatlar']::text[];

comment on column public.settings.macro_earn_threshold is
  'Kaç TL net ödeme 1 Macro kazandırır.';
comment on column public.settings.macro_meal_cost is
  'Bir ücretsiz öğün kuponu kaç Macro''ya mal olur.';
comment on column public.settings.macro_meal_max_value is
  'Ücretsiz öğün kuponunun üst sınırı (TL). 0 = sınırsız.';
comment on column public.settings.macro_meal_excluded_categories is
  'Ücretsiz öğün kuponunun geçerli OLMADIĞI ürün kategorileri (products.category).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) campaigns: ücretsiz öğün kuponu için kapsam alanları
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.campaigns
  add column if not exists excluded_categories text[],
  add column if not exists source text;

comment on column public.campaigns.excluded_categories is
  'discount_type = free_item için: kuponun geçmediği products.category değerleri.';
comment on column public.campaigns.source is
  'Kuponun nereden doğduğu: null = elle, macro_reward = Macro ödülü.';

create index if not exists campaigns_source_user_idx
  on public.campaigns (source, user_id) where source is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) macro_transactions: aynı sipariş iki kez kazandırmasın
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists macro_transactions_order_earn_uniq
  on public.macro_transactions (order_id)
  where type = 'order_earn' and order_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) free_item indirim tipi — validate_coupon'u SARMALAYAN yeni fonksiyon
-- ─────────────────────────────────────────────────────────────────────────────
-- Mevcut validate_coupon'a DOKUNULMUYOR. O fonksiyon ilk-sipariş kötüye
-- kullanım kontrolü dahil 150 satırlık hassas mantık taşıyor; yeniden yazmak
-- gereksiz risk. validate_coupon_v2 tüm uygunluk kontrolünü ona devrediyor,
-- yalnızca free_item kuponunda indirim tutarını sepet kalemlerinden hesaplıyor.
--
-- p_items: [{"category":"Yüksek Protein","price":425,"quantity":1}, ...]
-- free_item indirimi = uygun kalemler içindeki EN PAHALI bir adedin fiyatı.
create or replace function public.validate_coupon_v2(
  p_code text,
  p_cart_total numeric default 0,
  p_phone text default null,
  p_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r          jsonb;
  c          public.campaigns%rowtype;
  v_discount numeric;
begin
  r := public.validate_coupon(p_code, p_cart_total, p_phone);

  if coalesce((r->>'valid')::boolean, false) is not true then
    return r;
  end if;
  if coalesce(r->>'discount_type', '') <> 'free_item' then
    return r;
  end if;

  select * into c from public.campaigns where id = (r->>'campaign_id')::uuid;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'items_required');
  end if;

  select max(x.price) into v_discount
    from jsonb_to_recordset(p_items) as x(category text, price numeric, quantity int)
   where coalesce(x.price, 0) > 0
     and (c.excluded_categories is null
          or coalesce(x.category, '') <> all (c.excluded_categories));

  if v_discount is null then
    return jsonb_build_object('valid', false, 'reason', 'no_eligible_item');
  end if;

  if c.max_discount is not null and c.max_discount > 0 and v_discount > c.max_discount then
    v_discount := c.max_discount;
  end if;
  v_discount := round(v_discount, 2);
  if v_discount > p_cart_total then v_discount := p_cart_total; end if;

  return jsonb_set(
           jsonb_set(r, '{discount_amount}', to_jsonb(v_discount)),
           '{final_total}', to_jsonb(round(p_cart_total - v_discount, 2))
         );
end;
$function$;

grant execute on function public.validate_coupon_v2(text, numeric, text, jsonb) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Kazanım: sipariş TESLİM EDİLDİĞİNDE trigger ile (client'tan DEĞİL)
-- ─────────────────────────────────────────────────────────────────────────────
-- Teslimatta veriliyor; iptal/iade edilen sipariş macro kazandırmaz.
-- total_price net ödenen tutardır (indirim düşülmüş), bu yüzden %100 sponsor
-- kuponuyla verilen 0 TL'lik sipariş macro üretmez.
create or replace function public.grant_macros_on_delivery()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s              record;
  v_profile      record;
  v_accumulated  numeric;
  v_earned       int;
  v_remainder    numeric;
  v_balance      int;
  v_coupon_count int;
  v_code         text;
  i              int;
begin
  -- Yalnızca "delivered"a GEÇİŞ anında, ödenmiş ve gerçek sipariş için çalış.
  if new.status is not distinct from old.status then return new; end if;
  if new.status <> 'delivered' then return new; end if;
  if coalesce(new.payment_status, '') <> 'paid' then return new; end if;
  if coalesce(new.type, '') = 'macro_purchase' then return new; end if;
  if new.user_id is null then return new; end if;
  if coalesce(new.total_price, 0) <= 0 then return new; end if;

  -- Aynı sipariş iki kez kazandırmasın (unique index de ayrıca koruyor).
  if exists (
    select 1 from public.macro_transactions
     where order_id = new.id and type = 'order_earn'
  ) then
    return new;
  end if;

  select macro_earn_threshold, macro_meal_cost, macro_reward_valid_days,
         macro_meal_min_cart, macro_meal_max_value, macro_meal_excluded_categories
    into s
    from public.settings where id = 1;

  if s.macro_earn_threshold is null or s.macro_earn_threshold <= 0 then
    return new;
  end if;

  select coalesce(macro_balance, 0) as balance, coalesce(macro_points, 0) as points
    into v_profile
    from public.profiles where id = new.user_id;
  if not found then return new; end if;

  -- macro_points = eşiğe ulaşmayan birikmiş harcama (TL)
  v_accumulated := v_profile.points + new.total_price;
  v_earned      := floor(v_accumulated / s.macro_earn_threshold)::int;
  v_remainder   := v_accumulated - (v_earned * s.macro_earn_threshold);

  -- profiles_guard_protected_cols bu bayrağı görünce geçiş veriyor.
  -- true = işlem-yerel; transaction bitince kendiliğinden düşer.
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

  -- Eşiği dolduran her paket için bir "Ücretsiz Öğün" kuponu üret.
  v_coupon_count := floor(v_balance / greatest(s.macro_meal_cost, 1))::int;

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
$function$;

drop trigger if exists trg_grant_macros_on_delivery on public.orders;
create trigger trg_grant_macros_on_delivery
  after update of status on public.orders
  for each row
  execute function public.grant_macros_on_delivery();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) macro_transactions.type: yeni tipler
-- ─────────────────────────────────────────────────────────────────────────────
-- order_earn  : harcamadan kazanım (pozitif)
-- meal_reward : ücretsiz öğün kuponuna dönüşen macro (negatif)
-- purchase / membership_unlock eski modelden kalıyor; geçmiş kayıtlar bozulmasın
-- diye listeden çıkarılmadı, ama yeni akışta üretilmiyorlar.
alter table public.macro_transactions
  drop constraint if exists macro_transactions_type_check;

alter table public.macro_transactions
  add constraint macro_transactions_type_check
  check (type = any (array[
    'purchase'::text, 'reward'::text, 'membership_unlock'::text,
    'order_earn'::text, 'meal_reward'::text, 'expired'::text, 'admin_adjust'::text
  ]));
