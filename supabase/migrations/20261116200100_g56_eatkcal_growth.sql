-- G56-S1 — eatkcal ana sayfa sipariş artırma bölümleri (16 Kas).
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261116200100_g56_eatkcal_growth_rollback.sql
--
-- İçerik:
--  0) banner_cells.audience  — hücre bazında OPSİYONEL görünürlük koşulu (boş = herkes).
--     Hedef bağlantıları mevcut `navigate_to` METİN şemasında kalır (yeni tip gerekmedi):
--       Invite                      → Davet ekranı
--       SubPaywall:fresh:yearly     → paywall, Fresh yıllık seçili
--       ProductList:<filtre>        → Filtrelenmiş liste (high_protein, under_500, vegan, low_carb, dessert, drinks, all)
--       CategoryProducts:<kategori> → Filtrelenmiş liste (o kategori)
--       Campaign:<campaigns.id>     → Kampanyalar ve kuponlar, kampanya detayı açık
--  5) top_products_week(p_limit) — son 7 gün, teslim edilmiş siparişler, aktif ürünler; < 3 ürün → boş.
--  6) Davet: referral_codes, referrals, my_referral(), apply_referral_code(p_code),
--     teslimatta kupon tetikleyicisi, settings.referral_reward_tl / referral_min_order_tl,
--     feature_flags 'davet' (KAPALI).
--  +) analytics_event_names: eatkcal_sec_view, eatkcal_sec_tap, referral_share, referral_apply.
begin;

-- ─── 0) Banner koşulu ──────────────────────────────────────────────────────────
alter table public.banner_cells add column if not exists audience text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'banner_cells_audience_chk') then
    alter table public.banner_cells add constraint banner_cells_audience_chk
      check (audience is null or audience in ('signed_in', 'guest', 'no_orders', 'has_orders'));
  end if;
end $$;
comment on column public.banner_cells.audience is
  'G56: opsiyonel görünürlük. null = herkes · signed_in · guest · no_orders (hiç teslim edilmiş siparişi yok, ör. "ilk siparişe özel") · has_orders. Invite hedefi ayrıca misafirde ve davet bayrağı kapalıyken gizlenir.';
comment on column public.banner_cells.navigate_to is
  'Hedef: ProductDetail:<id> · BrandLanding:<key> · CategoryProducts:<ad> · ProductList:<filtre> · Invite · SubPaywall[:fresh|balance[:yearly|monthly]] · Campaign:<campaigns.id> · eski ekran adı.';

-- ─── 5) Bu hafta en çok sipariş edilenler ──────────────────────────────────────
-- Yalnız toplu sayı döner (kişisel veri yok) → anon + authenticated çağırabilir.
-- order_count = ürünü içeren teslim edilmiş sipariş sayısı (aynı siparişte 2 adet = 1 sipariş).
create or replace function public.top_products_week(p_limit int default 10)
returns table (product_id bigint, rank int, order_count int)
language sql
stable
security definer
set search_path = public
as $$
  with agg as (
    select oi.product_id, count(distinct o.id)::int as order_count, sum(oi.quantity)::int as qty
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.products p on p.id = oi.product_id
     where o.status = 'delivered'
       and o.created_at >= now() - interval '7 days'
       and coalesce(p.is_available, true)
       and coalesce(p.in_stock, true)
     group by oi.product_id
  ),
  ranked as (
    select a.product_id,
           (row_number() over (order by a.order_count desc, a.qty desc, a.product_id))::int as rank,
           a.order_count
      from agg a
  )
  select r.product_id, r.rank, r.order_count
    from ranked r
   where (select count(*) from agg) >= 3
     and r.rank <= greatest(1, least(coalesce(p_limit, 10), 50))
   order by r.rank;
$$;
revoke all on function public.top_products_week(int) from public;
grant execute on function public.top_products_week(int) to anon, authenticated;

-- ─── 6) Davet ─────────────────────────────────────────────────────────────────
alter table public.settings add column if not exists referral_reward_tl numeric;
alter table public.settings add column if not exists referral_min_order_tl numeric;
comment on column public.settings.referral_reward_tl is 'G56 davet: iki tarafa tanımlanan sabit kupon tutarı (TL). Boş → ödül verilmez, davet girişleri gizli.';
comment on column public.settings.referral_min_order_tl is 'G56 davet: davet edilenin ilk siparişi (ara toplam) ve kuponun minimum sepeti (TL). Boş → 0.';

create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now(),
  constraint referral_codes_code_chk check (code ~ '^[A-HJKMNP-Z2-9]{6,8}$')
);

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null unique references auth.users(id) on delete cascade,
  code        text not null,
  status      text not null default 'pending',
  order_id    bigint references public.orders(id) on delete set null,
  void_reason text,
  created_at  timestamptz not null default now(),
  earned_at   timestamptz,
  constraint referrals_status_chk check (status in ('pending', 'earned', 'void')),
  constraint referrals_not_self_chk check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

-- İstemci yalnız KENDİ satırını okur; yazma yalnız aşağıdaki SECURITY DEFINER fonksiyonlarla.
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
drop policy if exists referral_codes_own_read on public.referral_codes;
create policy referral_codes_own_read on public.referral_codes for select using (user_id = auth.uid());
drop policy if exists referrals_own_read on public.referrals;
create policy referrals_own_read on public.referrals for select using (referrer_id = auth.uid() or referee_id = auth.uid());

-- Karışmayan harf/rakam: I, L, O, 0, 1 yok. 7 karakter (31^7 ≈ 27 milyar).
create or replace function public.gen_referral_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v text;
  i int;
begin
  loop
    v := '';
    for i in 1..7 loop
      v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes where code = v);
  end loop;
  return v;
end;
$$;
revoke all on function public.gen_referral_code() from public;

-- Kod yoksa üretir; kod + ödül ayarları + davet geçmişi (ad yalnız "Ad S." biçiminde).
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

-- Telefonları karşılaştırmak için yalnız rakamlar, son 10 hane (0 / +90 farkı yok sayılır).
create or replace function public.referral_phone_key(p text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10), '');
$$;

-- Aynı kişi mi? Mevcut veriyle: aynı telefon (profiles.phone) ya da ortak bilinen cihaz
-- (user_known_devices — yalnız başarılı kartlı ödemeden sonra dolar).
create or replace function public.referral_same_person(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from public.profiles pa, public.profiles pb
            where pa.id = a and pb.id = b
              and public.referral_phone_key(pa.phone) is not null
              and public.referral_phone_key(pa.phone) = public.referral_phone_key(pb.phone)
         )
      or exists (
           select 1 from public.user_known_devices da
             join public.user_known_devices db on db.device_id = da.device_id
            where da.user_id = a and db.user_id = b
         );
$$;
revoke all on function public.referral_same_person(uuid, uuid) from public;

-- Kod girişi: yalnız hiç siparişi olmayan kullanıcı, kendi kodu değil, kişi başı bir kez.
-- "Sipariş" = ödeme başarısız / süresi dolmuş / iptal dışındaki her sipariş satırı.
create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_owner uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if not exists (select 1 from public.feature_flags where key = 'davet' and enabled) then
    return jsonb_build_object('ok', false, 'error', 'disabled');
  end if;
  if v_code !~ '^[A-HJKMNP-Z2-9]{6,8}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  select user_id into v_owner from public.referral_codes where code = v_code;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_owner = v_uid then
    return jsonb_build_object('ok', false, 'error', 'own_code');
  end if;
  if exists (select 1 from public.referrals where referee_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already_applied');
  end if;
  if exists (
    select 1 from public.orders
     where user_id = v_uid
       and coalesce(status, '') not in ('payment_failed', 'expired', 'cancelled')
  ) then
    return jsonb_build_object('ok', false, 'error', 'has_orders');
  end if;
  if public.referral_same_person(v_owner, v_uid) then
    return jsonb_build_object('ok', false, 'error', 'same_person');
  end if;
  insert into public.referrals (referrer_id, referee_id, code) values (v_owner, v_uid, v_code)
  on conflict (referee_id) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_applied');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated;

-- Davet edilenin İLK siparişi teslim edilince iki tarafa mevcut kupon sistemiyle (campaigns,
-- kişiye özel satır) sabit tutarlı kupon. Ödül ayarı boşsa satır 'pending' kalır, kupon yok.
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
end;
$$;
revoke all on function public.referral_on_delivery() from public;

drop trigger if exists trg_referral_on_delivery on public.orders;
create trigger trg_referral_on_delivery
  after insert or update of status on public.orders
  for each row execute function public.referral_on_delivery();

-- Bayrak: KAPALI. Kapalıyken uygulamada hiçbir davet girişi / banner'ı görünmez ve kod girişi reddedilir.
insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values ('davet', false, 0, '1.1.0',
        'G56-S1: Arkadaşını davet et (ana sayfa kartı, üst şerit Invite banner''ı, Davet ekranı, Profil satırı, sepette kod satırı). Ödül settings.referral_reward_tl boşsa yine gizli.')
on conflict (key) do nothing;

-- ─── Olay sözlüğü (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir. ─
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g56_eatkcal_growth: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('eatkcal_sec_view', 'commerce', 'client', 'eatkcal ana sayfa bölümü görüldü', 'eatkcal home section viewed', 'sec: banners|chips|reorder|kcal|plan|top|invite, st: text', null, false),
    ('eatkcal_sec_tap', 'commerce', 'client', 'eatkcal ana sayfa bölümü dokunuşu', 'eatkcal home section tap', 'sec: …, action: text', null, false),
    ('referral_share', 'commerce', 'client', 'Davet kodu paylaşıldı / kopyalandı', 'Invite code shared / copied', 'method: share|copy', null, false),
    ('referral_apply', 'commerce', 'client', 'Davet kodu girildi', 'Invite code applied', 'result: ok|invalid_code|own_code|already_applied|has_orders|same_person|disabled|error, where: cart', null, false)
  on conflict (name) do nothing;
end $$;

commit;
