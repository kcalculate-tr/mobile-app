-- G58-S2 md.4 (17 Kas, İlter kararı) — Ücretsiz öğün kuponu: Davet + İzmir teklifi.
-- Geri alma: supabase/rollbacks/20261117210100_g58s2_ucretsiz_ogun_kuponu_rollback.sql
-- CANLIYA UYGULANMADI (dosya). İdempotent: tekrar çalıştırılabilir.
--
-- Mevcut `free_item` kupon tipi kullanılır (Macro ödülüyle aynı yol): kişiye özel campaigns satırı,
-- indirim ödeme başlatmada validate_coupon_v2 ile SEPETTEN hesaplanır = uygun kalemler içindeki EN
-- PAHALI bir adedin katalog fiyatı (paynkolay-payment-init). Kural:
--   • sepetteki en pahalı 1 ana öğün ücretsiz; içecek ve yan ürünler hariç
--     (settings.free_meal_excluded_categories; varsayılan 'Detoks & Shake' = içecek, 'Soslar' = yan ürün,
--      'Koliye Özel Fırsatlar' = çoklu paket — Macro kuponuyla aynı)
--   • üst sınır settings.free_meal_max_tl, boşsa sınırsız (campaigns.max_discount 0 = sınırsız)
--   • tek kullanım (max_uses_per_user = max_uses_total = 1), 30 gün geçerli (free_meal_valid_days)
--
-- 1) settings: free_meal_max_tl · free_meal_excluded_categories · free_meal_valid_days
-- 2) free_meal_grants: kim, hangi kaynaktan (referral | izmir_fresh), hangi olay/ref için, hangi kuponlar;
--    idempotensi = unique (user_id, source, ref); İzmir teklifi kişi başı BİR KEZ (kısmi unique).
--    seen_at → uygulama içi "kuponun tanımlandı" bildirimi bir kez.
-- 3) grant_free_meals / void_free_meals — yalnız service_role ve tetikleyiciler (SECURITY DEFINER).
-- 4) referral_on_delivery: TL kuponu yerine İKİ tarafa 1 ücretsiz öğün kuponu (davet edilenin ilk
--    siparişi teslim edilince). 20261116210100'deki TL ödül ayarı GEÇERSİZ (o dosya _superseded).
-- 5) subscription_offer_intents + record_subscription_offer(): paywall teklifi (izmir_fresh) sunucuya
--    yazılır; revenuecat-webhook RevenueCat subscriber attribute'u YOKSA bu kayda bakar.
-- 6) my_free_meal_notices() / mark_free_meal_notices_seen(): uygulama içi bildirim.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) settings
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.settings add column if not exists free_meal_max_tl numeric;
alter table public.settings add column if not exists free_meal_excluded_categories text[] not null
  default array['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar']::text[];
alter table public.settings add column if not exists free_meal_valid_days integer not null default 30;
comment on column public.settings.free_meal_max_tl is
  'G58-S2: ücretsiz öğün kuponunun (davet / İzmir) üst sınırı (TL). Boş → sınırsız.';
comment on column public.settings.free_meal_excluded_categories is
  'G58-S2: ücretsiz öğün kuponunun geçmediği products.category değerleri (içecek + yan ürün + koli).';
comment on column public.settings.free_meal_valid_days is
  'G58-S2: ücretsiz öğün kuponunun geçerlilik süresi (gün). Varsayılan 30.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) free_meal_grants
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.free_meal_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  source       text not null,
  ref          text not null,
  count        integer not null default 1,
  campaign_ids uuid[] not null default '{}',
  status       text not null default 'active',
  void_reason  text,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  seen_at      timestamptz,
  constraint free_meal_grants_source_chk check (source in ('referral', 'izmir_fresh')),
  constraint free_meal_grants_status_chk check (status in ('active', 'void')),
  constraint free_meal_grants_count_chk check (count between 1 and 5),
  constraint free_meal_grants_once unique (user_id, source, ref)
);
-- İzmir teklifi kişi başı BİR KEZ (farklı olay kimliğiyle gelse bile).
create unique index if not exists free_meal_grants_izmir_once
  on public.free_meal_grants (user_id) where source = 'izmir_fresh';
create index if not exists free_meal_grants_user_idx on public.free_meal_grants (user_id, created_at desc);

alter table public.free_meal_grants enable row level security;
drop policy if exists free_meal_grants_own_read on public.free_meal_grants;
create policy free_meal_grants_own_read on public.free_meal_grants for select using (user_id = auth.uid());
revoke insert, update, delete on public.free_meal_grants from anon, authenticated;
grant select on public.free_meal_grants to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) grant / void
-- ─────────────────────────────────────────────────────────────────────────────
-- Kupon(lar)ı tanımlar. Aynı (kullanıcı, kaynak, ref) ikinci kez gelirse HİÇBİR ŞEY yapmaz
-- (duplicate:true). İzmir teklifi kişi başı bir kez (kısmi unique) → already:true.
create or replace function public.grant_free_meals(
  p_user uuid,
  p_source text,
  p_ref text,
  p_count integer default 1
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s record;
  v_grant uuid;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_code text;
  v_title text;
  v_badge text;
  i int;
begin
  if p_user is null or coalesce(p_ref, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  if p_source not in ('referral', 'izmir_fresh') then
    return jsonb_build_object('ok', false, 'error', 'bad_source');
  end if;
  if exists (select 1 from public.free_meal_grants where user_id = p_user and source = p_source and ref = p_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if p_source = 'izmir_fresh' and exists (select 1 from public.free_meal_grants where user_id = p_user and source = 'izmir_fresh') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  begin
    insert into public.free_meal_grants (user_id, source, ref, count)
    values (p_user, p_source, p_ref, greatest(1, least(coalesce(p_count, 1), 5)))
    returning id into v_grant;
  exception when unique_violation then
    -- Eşzamanlı ikinci teslimat (aynı olay iki kez aynı anda) → tekrar verme.
    return jsonb_build_object('ok', true, 'duplicate', true);
  end;

  select free_meal_max_tl, free_meal_excluded_categories, free_meal_valid_days
    into s from public.settings where id = 1;

  v_title := '1 Öğün Ücretsiz';
  v_badge := case p_source when 'referral' then 'Davet' else 'İzmir teklifi' end;

  for i in 1..greatest(1, least(coalesce(p_count, 1), 5)) loop
    v_code := 'OGUN' || to_char(now(), 'YYMMDD')
              || upper(substr(md5(random()::text || v_grant::text || i::text), 1, 5));
    insert into public.campaigns (
      title, description, code, badge,
      discount_type, discount_value, max_discount, min_cart_total,
      is_active, status, "order", start_date, end_date,
      user_id, max_uses_per_user, max_uses_total,
      excluded_categories, source
    ) values (
      v_title,
      'Sepetteki en pahalı 1 ana öğün ücretsiz. İçecek ve yan ürünler hariç. Tek kullanımlık.',
      v_code, v_badge,
      'free_item', 0, coalesce(s.free_meal_max_tl, 0), 0,
      true, 'active', 0, current_date, current_date + coalesce(s.free_meal_valid_days, 30),
      p_user, 1, 1,
      coalesce(s.free_meal_excluded_categories, array['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar']::text[]),
      p_source
    ) returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  update public.free_meal_grants set campaign_ids = v_ids where id = v_grant;
  return jsonb_build_object('ok', true, 'grant_id', v_grant, 'campaign_ids', to_jsonb(v_ids));
end;
$$;
revoke all on function public.grant_free_meals(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.grant_free_meals(uuid, text, text, integer) to service_role;

-- İade / iptal: KULLANILMAMIŞ kuponlar pasif (campaign_uses'ta kaydı olan dokunulmaz), hak 'void'.
create or replace function public.void_free_meals(p_user uuid, p_source text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  g record;
  v_voided int := 0;
  n int;
begin
  for g in
    select * from public.free_meal_grants
     where user_id = p_user and source = p_source and status = 'active'
     for update
  loop
    update public.campaigns c
       set is_active = false
     where c.id = any (g.campaign_ids)
       and c.user_id = p_user
       and not exists (select 1 from public.campaign_uses u where u.campaign_id = c.id);
    get diagnostics n = row_count;
    v_voided := v_voided + n;
    update public.free_meal_grants
       set status = 'void', voided_at = now(), void_reason = left(coalesce(p_reason, 'void'), 60)
     where id = g.id;
  end loop;
  return jsonb_build_object('ok', true, 'voided_coupons', v_voided);
end;
$$;
revoke all on function public.void_free_meals(uuid, text, text) from public, anon, authenticated;
grant execute on function public.void_free_meals(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Davet: iki tarafa 1 ücretsiz öğün (TL kuponu yok)
-- ─────────────────────────────────────────────────────────────────────────────
-- Davet edilenin İLK siparişi teslim edilince (ödenmiş, Macro alımı değil). `davet` bayrağı kapalıyken
-- apply_referral_code kodu kabul etmediği için 'pending' satır oluşmaz → ödül de yok.
-- referral_min_order_tl doluysa alt sınır olarak kalır (boş → yok).
create or replace function public.referral_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_min numeric;
  v_amount numeric;
  v_user uuid;
begin
  if new.status <> 'delivered' then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  if new.user_id is null then return new; end if;
  if coalesce(new.type, '') = 'macro_purchase' then return new; end if;
  if coalesce(new.payment_status, '') <> 'paid' then return new; end if;

  select * into r from public.referrals where referee_id = new.user_id and status = 'pending' for update;
  if not found then return new; end if;

  if exists (select 1 from public.orders o where o.user_id = new.user_id and o.status = 'delivered' and o.id <> new.id) then
    update public.referrals set status = 'void', void_reason = 'not_first_order', order_id = new.id where id = r.id;
    return new;
  end if;

  if public.referral_same_person(r.referrer_id, r.referee_id) then
    update public.referrals set status = 'void', void_reason = 'same_person', order_id = new.id where id = r.id;
    return new;
  end if;

  select referral_min_order_tl into v_min from public.settings where id = 1;
  v_amount := coalesce(new.subtotal_amount, new.total_amount, new.total_price, 0);
  if v_min is not null and v_amount < v_min then
    update public.referrals set status = 'void', void_reason = 'below_min', order_id = new.id where id = r.id;
    return new;
  end if;

  -- İki tarafa da 1 ücretsiz öğün; ref = davet satırı (aynı davet iki kez ödül vermez).
  foreach v_user in array array[r.referrer_id, r.referee_id] loop
    perform public.grant_free_meals(v_user, 'referral', r.id::text, 1);
  end loop;

  update public.referrals set status = 'earned', earned_at = now(), order_id = new.id where id = r.id;
  return new;
-- Davet mantığındaki hiçbir hata teslim güncellemesini DURDURMAZ.
exception when others then
  raise warning 'referral_on_delivery(%): %', new.id, sqlerrm;
  return new;
end;
$$;
revoke all on function public.referral_on_delivery() from public;

-- my_referral: ödül türünü de döndür (istemci TL göstermez; "ikinize de 1 öğün").
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
  select referral_min_order_tl into v_min from public.settings where id = 1;
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
  return jsonb_build_object('ok', true, 'code', v_code, 'reward_kind', 'free_meal', 'reward_tl', null,
                            'min_order_tl', v_min, 'history', v_history);
end;
$$;
revoke all on function public.my_referral() from public;
grant execute on function public.my_referral() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Paywall teklif kaydı (izmir_fresh)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.subscription_offer_intents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  offer      text not null,
  created_at timestamptz not null default now(),
  constraint subscription_offer_intents_offer_chk check (offer in ('izmir_fresh'))
);
create index if not exists subscription_offer_intents_user_idx
  on public.subscription_offer_intents (user_id, offer, created_at desc);
alter table public.subscription_offer_intents enable row level security;
drop policy if exists subscription_offer_intents_own_read on public.subscription_offer_intents;
create policy subscription_offer_intents_own_read on public.subscription_offer_intents
  for select using (user_id = auth.uid());
revoke insert, update, delete on public.subscription_offer_intents from anon, authenticated;
grant select on public.subscription_offer_intents to authenticated;

-- İstemci satın almadan HEMEN ÖNCE çağırır (yalnız bilinen teklif; dakikada en çok 1 satır).
create or replace function public.record_subscription_offer(p_offer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if p_offer is distinct from 'izmir_fresh' then return jsonb_build_object('ok', false, 'error', 'unknown_offer'); end if;
  if exists (select 1 from public.subscription_offer_intents
              where user_id = v_uid and offer = p_offer and created_at > now() - interval '1 minute') then
    return jsonb_build_object('ok', true, 'recent', true);
  end if;
  insert into public.subscription_offer_intents (user_id, offer) values (v_uid, p_offer);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.record_subscription_offer(text) from public, anon;
grant execute on function public.record_subscription_offer(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Uygulama içi bildirim: görülmemiş (aktif) kupon tanımları
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.my_free_meal_notices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'source', g.source, 'count', g.count, 'created_at', g.created_at)
                            order by g.created_at), '[]'::jsonb)
    from public.free_meal_grants g
   where g.user_id = auth.uid() and g.status = 'active' and g.seen_at is null;
$$;
revoke all on function public.my_free_meal_notices() from public, anon;
grant execute on function public.my_free_meal_notices() to authenticated;

create or replace function public.mark_free_meal_notices_seen(p_ids uuid[])
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.free_meal_grants set seen_at = now()
   where user_id = auth.uid() and id = any (p_ids) and seen_at is null;
$$;
revoke all on function public.mark_free_meal_notices_seen(uuid[]) from public, anon;
grant execute on function public.mark_free_meal_notices_seen(uuid[]) to authenticated;
