-- D-S1 — KPI katmanı: olay sözlüğü, analytics_events yazım düzeltmeleri, görünümler, admin_kpi()
-- version: 20261109100300  name: d_s1_kpi
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- PGlite ile 2 kez (idempotent) denendi: supabase/tests/d_s1.check.mjs
-- Önkoşul: 20261109100100_d_s1_adisyo_orders.sql. Metrik tanımları:
-- docs/night/KPI_SOZLUGU.md. Geri alma: supabase/rollbacks/20261109100300_d_s1_kpi_rollback.sql
--
-- İstemci yazımı (src/lib/analytics.ts, okundu — DEĞİŞTİRİLMEDİ):
--   track() → supabase.from('analytics_events').insert(row) ; başarısızsa
--   AsyncStorage kuyruğu (en çok 50) → bir sonraki track()'te TOPLU insert.
--   RLS: "insert own events" (user_id is null or user_id = auth.uid()).
-- Bulunan açıklar ve düzeltme (hepsi sunucu tarafında, BEFORE INSERT tetikleyici):
--   A1 Kuyruk kilidi: oturum kapanınca/hesap değişince kuyruktaki satırların
--      user_id'si auth.uid() ile uyuşmuyor → RLS TÜM toplu insert'i reddediyor →
--      kuyruk sonsuza dek takılıyor ve o cihazdan gelen eski olaylar kayboluyor.
--      Düzeltme: istemci rolünde uyuşmayan user_id NULL'a çekilir
--      (props._user_mismatch=true); anon_id korunur. (RLS WITH CHECK, BEFORE
--      tetikleyiciden SONRA değerlendirilir → satır geçer, başkası adına yazılamaz.)
--   A2 Saat: created_at istemciden geliyor (cihaz saati) → geleceğe/çok geçmişe
--      tarihli olay DAU/tutma metriklerini bozuyor. Düzeltme: > now()+5 dk ya da
--      < now()-30 gün ise now() (props._ts_clamped=true).
--   A3 Kişisel veri: props serbest jsonb. Düzeltme: üst düzey bilinen kişisel
--      anahtarlar (email, phone, address, lat/lng, full_name …) silinir; 8 KB üstü
--      props {"_truncated":true} olur.
--   A4 Olay adı serbest metin. Düzeltme: trim + küçük harf + 64 karakter;
--      sözlük (analytics_event_names) YUMUŞAK — bilinmeyen ad reddedilmez (eski
--      sürümlerin toplu kuyruğu kilitlenmesin), kpi_unknown_event_names
--      görünümünde ve admin_kpi.tracking.unknown altında görünür.
--   A5 Yetki: politika "public" rolüne açıktı; yalnız anon+authenticated'e
--      daraltıldı, istemciye yalnız INSERT yetkisi (okuma/güncelleme/silme yok).

begin;

-- ── 1) Olay sözlüğü ────────────────────────────────────────────────────────
create table if not exists public.analytics_event_names (
  name           text primary key,
  category       text not null,
  source         text not null default 'client',
  description_tr text not null,
  description_en text not null,
  props_hint     text,
  alias_of       text,
  is_kpi         boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_event_names_name_chk') then
    alter table public.analytics_event_names add constraint analytics_event_names_name_chk
      check (name ~ '^[a-z][a-z0-9_]{1,63}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analytics_event_names_source_chk') then
    alter table public.analytics_event_names add constraint analytics_event_names_source_chk
      check (source in ('client', 'server'));
  end if;
end $$;

comment on table public.analytics_event_names is
  'D-S1: analytics_events olay sözlüğü (TR/EN). Yumuşak: bilinmeyen ad reddedilmez, kpi_unknown_event_names''te görünür. İstemci sözleşmesi: G19-S3 track().';

alter table public.analytics_event_names enable row level security;
drop policy if exists analytics_event_names_read on public.analytics_event_names;
create policy analytics_event_names_read on public.analytics_event_names
  for select to authenticated using (true);
revoke all on public.analytics_event_names from public, anon, authenticated;
grant select on public.analytics_event_names to authenticated;
grant all on public.analytics_event_names to service_role;

insert into public.analytics_event_names (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi) values
  -- yaşam döngüsü
  ('app_open',            'lifecycle', 'client', 'Uygulama açıldı (soğuk/sıcak başlangıç)', 'App opened (cold/warm start)', 'cold:boolean', null, true),
  ('first_touch',         'lifecycle', 'client', 'İlk açılış kaynağı (derin bağlantı / UTM / QR / saha kodu)', 'First-open attribution (deep link / UTM / QR / field code)', 'source, medium, campaign, code', null, true),
  ('signup',              'lifecycle', 'client', 'Hesap oluşturuldu', 'Account created', 'method: apple|google|email|phone', null, true),
  ('onb_step',            'lifecycle', 'client', 'Karşılama/kurulum adımı tamamlandı', 'Onboarding step completed', 'step, index', null, false),
  ('welcome_view',        'lifecycle', 'client', 'Karşılama ekranı görüldü', 'Welcome screen viewed', null, null, false),
  ('welcome_login_click', 'lifecycle', 'client', 'Karşılamada giriş tıklandı', 'Welcome login tapped', null, null, false),
  ('welcome_skip_click',  'lifecycle', 'client', 'Karşılama atlandı', 'Welcome skipped', null, null, false),
  -- takip (kcalculate)
  ('scan_start',          'tracking',  'client', 'AI yemek taraması başlatıldı', 'AI food scan started', null, null, false),
  ('scan_success',        'tracking',  'client', 'AI taraması sonuç verdi', 'AI scan succeeded', 'kcal', null, true),
  ('scan_failed',         'tracking',  'client', 'AI taraması başarısız', 'AI scan failed', 'reason', null, false),
  ('log_meal',            'tracking',  'client', 'Öğün kaydedildi', 'Meal logged', 'source: scan|manual|order|post', null, true),
  ('log_water',           'tracking',  'client', 'Su kaydedildi', 'Water logged', 'ml', null, false),
  ('log_activity',        'tracking',  'client', 'Etkinlik/adım kaydedildi', 'Activity logged', 'type, minutes', null, false),
  -- sosyal (Keşfet)
  ('share',               'social',    'client', 'Paylaşım yapıldı (gönderi / gün kartı / ürün)', 'Content shared (post / day card / product)', 'target: post|day|product|app', null, true),
  ('follow',              'social',    'client', 'Kullanıcı takip edildi', 'User followed', null, null, false),
  -- ticaret (eatkcal)
  ('home_view',           'commerce',  'client', 'Ana sayfa görüldü', 'Home viewed', null, null, false),
  ('banner_view',         'commerce',  'client', 'Afiş görüldü', 'Banner viewed', 'banner_id', null, false),
  ('banner_click',        'commerce',  'client', 'Afiş tıklandı', 'Banner tapped', 'banner_id', null, false),
  ('announcement_strip_click', 'commerce', 'client', 'Duyuru şeridi tıklandı', 'Announcement strip tapped', null, null, false),
  ('product_view',        'commerce',  'client', 'Ürün görüldü', 'Product viewed', 'product_id, price', null, true),
  ('add_to_cart',         'commerce',  'client', 'Sepete eklendi', 'Added to cart', 'product_id, quantity, price', null, true),
  ('remove_from_cart',    'commerce',  'client', 'Sepetten çıkarıldı', 'Removed from cart', 'product_id', null, false),
  ('cart_view',           'commerce',  'client', 'Sepet görüldü', 'Cart viewed', 'item_count, total', null, false),
  ('begin_checkout',      'commerce',  'client', 'Ödemeye geçildi', 'Checkout started', 'total, item_count', null, true),
  ('checkout_start',      'commerce',  'client', 'Ödemeye geçildi (yeni ad)', 'Checkout started (new name)', 'total, item_count', 'begin_checkout', true),
  ('payment_attempt',     'commerce',  'client', 'Ödeme denendi', 'Payment attempted', 'price, provider', null, false),
  ('payment_pending',     'commerce',  'client', 'Ödeme beklemede (3D vb.)', 'Payment pending (3DS etc.)', null, null, false),
  ('payment_success',     'commerce',  'client', 'Ödeme başarılı (istemci)', 'Payment succeeded (client)', 'order_id', null, false),
  ('pay_success',         'commerce',  'client', 'Ödeme başarılı (yeni ad)', 'Payment succeeded (new name)', 'order_id', 'payment_success', false),
  ('payment_failed',      'commerce',  'client', 'Ödeme başarısız', 'Payment failed', 'reason', null, false),
  ('coupon_apply',        'marketing', 'client', 'Kupon kodu uygulandı', 'Coupon code applied', 'code, ok:boolean', null, true),
  ('saha_code_apply',     'marketing', 'client', 'Saha (satış temsilcisi) kodu uygulandı', 'Field-sales code applied', 'code, ok:boolean', null, true),
  ('reorder_from_home',          'commerce', 'client', 'Ana sayfadan tekrar sipariş', 'Reorder from home', 'order_id', null, false),
  ('reorder_from_order_detail',  'commerce', 'client', 'Sipariş detayından tekrar sipariş', 'Reorder from order detail', 'order_id', null, false),
  ('reorder_from_empty_cart',    'commerce', 'client', 'Boş sepetten tekrar sipariş', 'Reorder from empty cart', 'order_id', null, false),
  ('order_review_submitted',     'commerce', 'client', 'Sipariş değerlendirildi', 'Order review submitted', 'order_id, rating', null, false),
  -- sunucu
  ('purchase',            'commerce',  'server', 'Satın alma (sunucu: onaylı + ödenmiş sipariş)', 'Purchase (server: confirmed + paid order)', 'order_id, price, branch_id', null, true),
  ('order_delivered',     'commerce',  'server', 'Sipariş teslim edildi (sunucu)', 'Order delivered (server)', 'order_id, branch_id', null, true)
on conflict (name) do update set
  category = excluded.category, source = excluded.source,
  description_tr = excluded.description_tr, description_en = excluded.description_en,
  props_hint = excluded.props_hint, alias_of = excluded.alias_of, is_kpi = excluded.is_kpi;

-- ── 2) analytics_events yazım düzeltmeleri (A1–A5) ─────────────────────────
-- SECURITY INVOKER (bilerek): current_user çağıran rol olmalı (anon/authenticated).
create or replace function public.analytics_events_sanitize()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_flags jsonb := '{}'::jsonb;
begin
  new.event_name := left(lower(btrim(coalesce(new.event_name, ''))), 64);
  if new.event_name = '' then new.event_name := 'unknown'; end if;

  if new.props is null or jsonb_typeof(new.props) <> 'object' then
    new.props := case when new.props is null then '{}'::jsonb else jsonb_build_object('_value', new.props) end;
  end if;
  new.props := new.props - array[
    'email','e_mail','mail','phone','phone_number','telefon','tel','gsm','address','adres','full_address',
    'first_name','last_name','full_name','customer_name','name_surname','lat','lng','lon','latitude','longitude',
    'card_number','pan','cvv','iban','tckn','tc_kimlik','password','token','access_token','refresh_token'
  ];
  if pg_column_size(new.props) > 8192 then
    new.props := jsonb_build_object('_truncated', true);
  end if;

  new.anon_id     := left(new.anon_id, 64);
  new.session_id  := left(new.session_id, 64);
  new.platform    := left(new.platform, 16);
  new.app_version := left(new.app_version, 32);

  -- Saat kırpması yalnız istemci rollerinde (sunucu/geri doldurma yazımları güvenilir).
  if new.created_at is null then
    new.created_at := now();
  elsif current_user in ('anon', 'authenticated')
        and (new.created_at > now() + interval '5 minutes' or new.created_at < now() - interval '30 days') then
    new.created_at := now();
    v_flags := v_flags || '{"_ts_clamped": true}'::jsonb;
  end if;

  if current_user in ('anon', 'authenticated')
     and new.user_id is not null
     and new.user_id is distinct from auth.uid() then
    new.user_id := null;
    v_flags := v_flags || '{"_user_mismatch": true}'::jsonb;
  end if;

  if v_flags <> '{}'::jsonb then new.props := new.props || v_flags; end if;
  return new;
end;
$$;

drop trigger if exists analytics_events_sanitize on public.analytics_events;
create trigger analytics_events_sanitize
  before insert on public.analytics_events
  for each row execute function public.analytics_events_sanitize();

drop policy if exists "insert own events" on public.analytics_events;
drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own on public.analytics_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.analytics_events from public, anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant all on public.analytics_events to service_role;

create index if not exists analytics_events_created_at_idx   on public.analytics_events (created_at);
create index if not exists analytics_events_session_idx      on public.analytics_events (session_id, created_at) where session_id is not null;
create index if not exists analytics_events_anon_idx         on public.analytics_events (anon_id, created_at) where anon_id is not null;

-- ── 3) Görünümler (service_role; panel admin_kpi RPC'sini kullanır) ────────
-- Tek sipariş akışı: uygulama siparişleri (orders) ∪ Adisyo'daki uygulama DIŞI
-- siparişler (adisyo_orders). Çift sayım kuralları:
--   · adisyo_orders.app_order_id dolu ya da orders.adisyo_order_id eşleşiyorsa → orders'tan sayılır
--   · orders.source <> 'app' (ör. trendyolgo) ve aynı pazar yeri kodu adisyo_orders.external_ref'te
--     varsa → adisyo_orders'tan sayılır
create or replace view public.kpi_orders_unified
with (security_invoker = true) as
select
  'orders'::text                                              as src,
  o.id::text                                                  as ref,
  o.created_at                                                as at,
  (o.created_at at time zone 'Europe/Istanbul')::date         as day,
  o.branch_id,
  case
    when coalesce(o.source, 'app') = 'app'                    then 'app'
    when o.source ilike 'trendyol%'                           then 'trendyol_go'
    when o.source ilike 'yemek%sepeti%'                       then 'yemeksepeti'
    when o.source ilike 'getir%'                              then 'getir'
    when o.source ilike 'migros%'                             then 'migros'
    else 'diger'
  end                                                         as channel,
  coalesce(o.total_amount, o.total_price::numeric, 0)         as total,
  coalesce(o.discount_amount, 0)                              as discount,
  o.user_id,
  nullif(upper(btrim(o.coupon_code)), '')                     as coupon_code
from public.orders o
where o.payment_status = 'paid'
  and o.status in ('confirmed', 'preparing', 'on_way', 'delivered')
  and (
    coalesce(o.source, 'app') = 'app'
    or not exists (
      select 1 from public.adisyo_orders a
       where a.external_ref is not null
         and a.external_ref in (o.external_code, o.external_order_id)
    )
  )
union all
select
  'adisyo'::text,
  a.adisyo_order_id::text,
  a.inserted_at,
  (a.inserted_at at time zone 'Europe/Istanbul')::date,
  a.branch_id,
  a.channel,
  coalesce(a.total, 0),
  coalesce(a.discount, 0),
  null::uuid,
  null::text
from public.adisyo_orders a
where a.is_cancelled = false
  and a.inserted_at is not null
  and a.app_order_id is null
  and a.channel <> 'app'
  and not exists (select 1 from public.orders o where o.adisyo_order_id = a.adisyo_order_id);

comment on view public.kpi_orders_unified is
  'D-S1: tüm kanallar tek sipariş akışı (orders: paid + confirmed..delivered; adisyo_orders: uygulama dışı, iptal değil). Bkz. KPI_SOZLUGU.md';

create or replace view public.kpi_daily_orders
with (security_invoker = true) as
select day, branch_id, channel,
       count(*)::int                         as orders,
       round(sum(total), 2)                  as revenue,
       round(sum(total) / nullif(count(*), 0), 2) as avg_basket
  from public.kpi_orders_unified
 group by day, branch_id, channel;

create or replace view public.kpi_unknown_event_names
with (security_invoker = true) as
select e.event_name, count(*)::int as events, max(e.created_at) as last_seen
  from public.analytics_events e
 where e.created_at >= now() - interval '30 days'
   and not exists (select 1 from public.analytics_event_names n where n.name = e.event_name)
 group by e.event_name;

revoke all on public.kpi_orders_unified, public.kpi_daily_orders, public.kpi_unknown_event_names
  from public, anon, authenticated;
grant select on public.kpi_orders_unified, public.kpi_daily_orders, public.kpi_unknown_event_names
  to service_role;

-- ── 4) Hedef ayarı ─────────────────────────────────────────────────────────
insert into public.app_settings (key, value, description) values
  ('kpi_targets', '{"daily_orders": 150}'::jsonb,
   'D-S1: KPI hedefleri. daily_orders = tüm kanallar günlük sipariş hedefi (admin_kpi.target).')
on conflict (key) do nothing;

-- ── 5) admin_kpi(from, to, branch?) ────────────────────────────────────────
-- Tarihler İstanbul takvim günü, ikisi de DAHİL. Şube süzgeci sipariş temelli
-- bölümlere uygulanır (orders_daily, totals, channels, customers, coupons,
-- saha, target); kullanıcı/etkinlik metrikleri (active, retention, scans,
-- explore, tracking) şubeden bağımsızdır.
create or replace function public.admin_kpi(p_from date, p_to date, p_branch uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start  timestamptz;
  v_end    timestamptz;
  v_today  date := (now() at time zone 'Europe/Istanbul')::date;
  v_target integer;
  v_out    jsonb;
begin
  if not (public.is_admin() or coalesce(auth.jwt()->>'role', '') = 'service_role') then
    raise exception 'admin_kpi: yetki yok' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'admin_kpi: geçersiz tarih aralığı (en çok 400 gün)' using errcode = '22023';
  end if;

  v_start  := (p_from::timestamp) at time zone 'Europe/Istanbul';
  v_end    := ((p_to + 1)::timestamp) at time zone 'Europe/Istanbul';
  v_target := coalesce((select (s.value->>'daily_orders')::int from public.app_settings s where s.key = 'kpi_targets'), 150);

  with
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  o as (
    select * from public.kpi_orders_unified u
     where u.day between p_from and p_to
       and (p_branch is null or u.branch_id = p_branch)
  ),
  daily as (
    select d.day,
           count(o.ref)::int                                  as orders,
           coalesce(round(sum(o.total), 2), 0)                as revenue,
           round(sum(o.total) / nullif(count(o.ref), 0), 2)   as avg_basket,
           (count(o.ref) filter (where o.channel = 'app'))::int as app_orders
      from days d left join o on o.day = d.day
     group by d.day
  ),
  tot as (
    select count(*)::int as orders, coalesce(round(sum(total), 2), 0) as revenue,
           round(sum(total) / nullif(count(*), 0), 2) as avg_basket,
           coalesce(round(sum(discount), 2), 0) as discount
      from o
  ),
  ch as (
    select o.channel, count(*)::int as orders, round(sum(o.total), 2) as revenue
      from o group by o.channel
  ),
  -- yeni / tekrar müşteri (yalnız uygulama; kullanıcının ilk ödenmiş siparişi)
  app_users as (
    select distinct o.user_id from o where o.src = 'orders' and o.channel = 'app' and o.user_id is not null
  ),
  first_order as (
    select u.user_id, min(x.day) as first_day
      from app_users u
      join public.kpi_orders_unified x on x.user_id = u.user_id and x.src = 'orders'
     group by u.user_id
  ),
  cust as (
    select count(*) filter (where f.first_day between p_from and p_to)::int as new_customers,
           count(*) filter (where f.first_day <  p_from)::int              as returning_customers
      from first_order f
  ),
  -- etkinlik
  act as (
    select (e.created_at at time zone 'Europe/Istanbul')::date as day,
           coalesce(e.user_id::text, 'a:' || e.anon_id) as actor
      from public.analytics_events e
     where e.created_at >= least(v_start, ((p_to - 29)::timestamp) at time zone 'Europe/Istanbul')
       and e.created_at <  v_end
       and coalesce(e.user_id::text, e.anon_id) is not null
  ),
  dau as (
    select d.day, count(distinct a.actor)::int as dau
      from days d left join act a on a.day = d.day group by d.day
  ),
  -- tutma: kayıt (profiles.created_at) kohortu, D+N günü herhangi bir olay
  cohort as (
    select p.id as user_id, (p.created_at at time zone 'Europe/Istanbul')::date as cday
      from public.profiles p
     where p.created_at >= v_start and p.created_at < v_end
  ),
  ret as (
    select n.n,
           count(c.user_id) filter (where c.cday + n.n < v_today)::int as cohort,
           count(c.user_id) filter (where c.cday + n.n < v_today and exists (
             select 1 from public.analytics_events e
              where e.user_id = c.user_id
                and e.created_at >= ((c.cday + n.n)::timestamp) at time zone 'Europe/Istanbul'
                and e.created_at <  ((c.cday + n.n + 1)::timestamp) at time zone 'Europe/Istanbul'))::int as retained
      from (values (1), (7), (30)) n(n)
      left join cohort c on true
     group by n.n
  ),
  scans as (
    select d.day, coalesce(sum(s.used), 0)::int as scans, count(s.user_id)::int as users
      from days d left join public.ai_scan_usage s on s.day = d.day and s.used > 0
     group by d.day
  ),
  coupons as (
    select o.coupon_code as code,
           (select c.source from public.campaigns c where upper(c.code) = o.coupon_code order by c.created_at desc limit 1) as source,
           count(*)::int as orders,
           round(sum(o.total), 2) as revenue,
           round(sum(o.discount), 2) as discount,
           (count(*) filter (where exists (
              select 1 from first_order f where f.user_id = o.user_id and f.first_day = o.day)))::int as first_orders
      from o
     where o.coupon_code is not null
     group by o.coupon_code
  ),
  tracking as (
    select coalesce(jsonb_agg(jsonb_build_object('name', k.event_name, 'events', k.events) order by k.events desc), '[]'::jsonb) as unknown
      from (select e.event_name, count(*)::int as events
              from public.analytics_events e
             where e.created_at >= v_start and e.created_at < v_end
               and not exists (select 1 from public.analytics_event_names n where n.name = e.event_name)
             group by e.event_name order by 2 desc limit 20) k
  )
  select jsonb_build_object(
    'range',  jsonb_build_object('from', p_from, 'to', p_to, 'branch_id', p_branch, 'days', p_to - p_from + 1,
                                 'tz', 'Europe/Istanbul', 'generated_at', now()),
    'orders_daily', (select coalesce(jsonb_agg(to_jsonb(daily) order by daily.day), '[]'::jsonb) from daily),
    'totals', (select jsonb_build_object('orders', t.orders, 'revenue', t.revenue, 'avg_basket', t.avg_basket,
                                         'discount', t.discount,
                                         'avg_daily_orders', round(t.orders::numeric / (p_to - p_from + 1), 2)) from tot t),
    'channels', (select coalesce(jsonb_agg(jsonb_build_object(
                    'channel', ch.channel, 'orders', ch.orders, 'revenue', ch.revenue,
                    'order_share',   round(ch.orders::numeric / nullif((select orders from tot), 0), 4),
                    'revenue_share', round(ch.revenue / nullif((select revenue from tot), 0), 4)
                  ) order by ch.orders desc), '[]'::jsonb) from ch),
    'customers', (select jsonb_build_object('new', c.new_customers, 'returning', c.returning_customers,
                    'returning_share', round(c.returning_customers::numeric / nullif(c.new_customers + c.returning_customers, 0), 4))
                    from cust c),
    'retention', (select jsonb_object_agg('d' || r.n, jsonb_build_object('cohort', r.cohort, 'retained', r.retained,
                    'rate', round(r.retained::numeric / nullif(r.cohort, 0), 4))) from ret r),
    'active', jsonb_build_object(
        'dau_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', dau.day, 'dau', dau.dau) order by dau.day), '[]'::jsonb) from dau),
        'dau_avg',   (select round(avg(dau.dau), 2) from dau),
        'wau', (select count(distinct a.actor)::int from act a where a.day between p_to - 6 and p_to),
        'mau', (select count(distinct a.actor)::int from act a where a.day between p_to - 29 and p_to)
      ),
    'scans', jsonb_build_object(
        'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', sc.day, 'scans', sc.scans, 'users', sc.users)
                                            order by sc.day), '[]'::jsonb) from scans sc),
        'total', (select coalesce(sum(scans.scans), 0)::int from scans),
        'per_day_avg', (select round(avg(scans.scans), 2) from scans)
      ),
    'explore', jsonb_build_object(
        'posts', (select count(*)::int from public.posts p
                   where p.status = 'published' and p.published_at >= v_start and p.published_at < v_end),
        'posting_users', (select count(distinct p.author_id)::int from public.posts p
                   where p.status = 'published' and p.published_at >= v_start and p.published_at < v_end),
        'day_shares', (select count(*)::int from public.day_shares s where s.created_at >= v_start and s.created_at < v_end),
        'share_events', (select count(*)::int from public.analytics_events e
                   where e.event_name = 'share' and e.created_at >= v_start and e.created_at < v_end)
      ),
    'coupons', (select coalesce(jsonb_agg(to_jsonb(coupons) order by coupons.orders desc), '[]'::jsonb)
                  from (select * from coupons where coalesce(source, '') not ilike 'saha%' and code not like 'SAHA%'
                         order by orders desc limit 50) coupons),
    'saha', jsonb_build_object(
        'codes', (select coalesce(jsonb_agg(to_jsonb(coupons) order by coupons.orders desc), '[]'::jsonb)
                    from coupons where coalesce(source, '') ilike 'saha%' or code like 'SAHA%'),
        'apply_events', (select count(*)::int from public.analytics_events e
                    where e.event_name = 'saha_code_apply' and e.created_at >= v_start and e.created_at < v_end),
        'apply_ok', (select count(*)::int from public.analytics_events e
                    where e.event_name = 'saha_code_apply' and e.props->>'ok' = 'true'
                      and e.created_at >= v_start and e.created_at < v_end)
      ),
    'coupon_events', jsonb_build_object(
        'apply_events', (select count(*)::int from public.analytics_events e
                    where e.event_name = 'coupon_apply' and e.created_at >= v_start and e.created_at < v_end),
        'apply_ok', (select count(*)::int from public.analytics_events e
                    where e.event_name = 'coupon_apply' and e.props->>'ok' = 'true'
                      and e.created_at >= v_start and e.created_at < v_end)
      ),
    'target', jsonb_build_object(
        'daily_orders', v_target,
        'days_hit', (select count(*)::int from daily where daily.orders >= v_target),
        'avg_progress', (select round(avg(daily.orders)::numeric / nullif(v_target, 0), 4) from daily),
        'today', case when v_today between p_from and p_to then
                   (select jsonb_build_object('day', daily.day, 'orders', daily.orders,
                            'progress', round(daily.orders::numeric / nullif(v_target, 0), 4),
                            'remaining', greatest(v_target - daily.orders, 0))
                      from daily where daily.day = v_today)
                 else null end
      ),
    'tracking', jsonb_build_object('unknown', (select unknown from tracking))
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.admin_kpi(date, date, uuid) from public, anon;
grant execute on function public.admin_kpi(date, date, uuid) to authenticated, service_role;

comment on function public.admin_kpi(date, date, uuid) is
  'D-S1: panel KPI özeti (jsonb). Yalnız admin_allowlist (is_admin) ya da service_role. Tanımlar: docs/night/KPI_SOZLUGU.md';

commit;
