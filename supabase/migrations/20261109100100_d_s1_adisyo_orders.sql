-- D-S1 — Adisyo TÜM siparişler tablosu (uygulama + pazar yerleri + salon + telefon)
-- version: 20261109100100  name: d_s1_adisyo_orders
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya UYGULANMADI (gece kuralı).
-- PGlite ile 2 kez (idempotent) denendi: supabase/tests/d_s1.check.mjs
-- Geri alma: supabase/rollbacks/20261109100100_d_s1_adisyo_orders_rollback.sql
--
-- Neden: Adisyo webhook'u bütün kanalların siparişlerini gönderiyor (13 Eki'ye
-- kadar 2.576 uygulama dışı olay) ama biz yalnız uygulama siparişlerini
-- işliyorduk; geri kalanı `unknown_adisyo_order_id` hatasıyla atılıyordu.
-- Bu tablo GET /Order/{id} yanıtının KİŞİSEL VERİ İÇERMEYEN özetini tutar:
-- müşteri adı / telefon / adres / konum / sipariş notu / kurye-garson adı YOK.
--
-- Yazma: yalnız service_role (adisyo-webhook-receiver, adisyo-reconcile)
--        `adisyo_order_upsert(jsonb)` üzerinden. Okuma: yalnız admin_allowlist.

begin;

-- ── 1) Tablo ────────────────────────────────────────────────────────────────
create table if not exists public.adisyo_orders (
  adisyo_order_id bigint      primary key,
  order_number    text,
  restaurant_key  text,
  branch_id       uuid        references public.branches(id) on delete set null,
  channel         text        not null default 'diger',
  channel_raw     text,
  status_id       integer,
  order_type      text,
  total           numeric(12,2),
  discount        numeric(12,2),
  tax             numeric(12,2),
  payment_method  text,
  inserted_at     timestamptz,
  closed_at       timestamptz,
  prepared_at     timestamptz,
  is_cancelled    boolean     not null default false,
  cancel_reason   text,
  external_ref    text,
  items           jsonb       not null default '[]'::jsonb,
  app_order_id    bigint      references public.orders(id) on delete set null,
  raw_hash        text        not null,
  first_seen_at   timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'adisyo_orders_channel_chk') then
    alter table public.adisyo_orders add constraint adisyo_orders_channel_chk
      check (channel in ('app','yemeksepeti','trendyol_go','getir','migros','salon','telefon','diger'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'adisyo_orders_items_array_chk') then
    alter table public.adisyo_orders add constraint adisyo_orders_items_array_chk
      check (jsonb_typeof(items) = 'array');
  end if;
end $$;

comment on table public.adisyo_orders is
  'D-S1: Adisyo''daki tüm siparişlerin kişisel veri içermeyen özeti (kanal, tutar, ürünler). Yazma yalnız service_role (adisyo_order_upsert); okuma admin_allowlist.';
comment on column public.adisyo_orders.channel is
  'app · yemeksepeti · trendyol_go · getir · migros · salon · telefon · diger (salesChannelName/externalAppName normalize; orders.adisyo_order_id eşleşirse app).';
comment on column public.adisyo_orders.app_order_id is
  'orders.id — sipariş uygulamadan geldiyse (orders.adisyo_order_id eşleşmesi). KPI çift sayımı bununla önlenir.';
comment on column public.adisyo_orders.items is
  'Yalnız [{name, quantity, unit_price, product_id}] — ürün notu dahil serbest metin YOK.';
comment on column public.adisyo_orders.raw_hash is
  'Saklanan alanların sha256''sı; aynıysa upsert satırı güncellemez.';
comment on column public.adisyo_orders.restaurant_key is
  'Adisyo restaurantKey (kişisel değil). branches.adisyo_config->>restaurantKey ile şubeye eşlenir.';

create index if not exists adisyo_orders_inserted_at_idx on public.adisyo_orders (inserted_at desc);
create index if not exists adisyo_orders_branch_idx      on public.adisyo_orders (branch_id, inserted_at desc);
create index if not exists adisyo_orders_channel_idx     on public.adisyo_orders (channel, inserted_at desc);
create index if not exists adisyo_orders_app_order_idx   on public.adisyo_orders (app_order_id) where app_order_id is not null;
create index if not exists adisyo_orders_open_idx        on public.adisyo_orders (inserted_at)
  where closed_at is null and is_cancelled = false;
create index if not exists adisyo_orders_external_ref_idx on public.adisyo_orders (channel, external_ref)
  where external_ref is not null;

-- ── 2) RLS: okuma yalnız admin_allowlist, yazma yalnız service_role ────────
alter table public.adisyo_orders enable row level security;
drop policy if exists adisyo_orders_admin_select on public.adisyo_orders;
create policy adisyo_orders_admin_select on public.adisyo_orders
  for select to authenticated
  using (public.is_admin());   -- canlıda var (20260926111527): security definer, admin_allowlist

revoke all on public.adisyo_orders from public, anon, authenticated;
grant select on public.adisyo_orders to authenticated;   -- RLS süzer
grant all    on public.adisyo_orders to service_role;

-- ── 3) Webhook olay tablosu: adisyo_orders yeniden deneme kuyruğu ──────────
-- Kuyruk = signature_valid olay + adisyo_order_id dolu + ao_synced_at boş.
-- Eski 2.576 uygulama dışı olay da (ao_synced_at boş) buraya düşer →
-- adisyo-reconcile gece gece geriye dönük doldurur.
alter table public.adisyo_webhook_events
  add column if not exists ao_synced_at     timestamptz,
  add column if not exists ao_attempts      integer not null default 0,
  add column if not exists ao_next_retry_at timestamptz,
  add column if not exists ao_error         text;

comment on column public.adisyo_webhook_events.ao_synced_at is
  'D-S1: siparişin adisyo_orders''a yazıldığı an. Boşsa yeniden deneme kuyruğunda.';

create index if not exists adisyo_webhook_events_ao_queue_idx
  on public.adisyo_webhook_events (ao_next_retry_at nulls first, received_at)
  where ao_synced_at is null and signature_valid is true and adisyo_order_id is not null;
create index if not exists adisyo_webhook_events_received_idx
  on public.adisyo_webhook_events (received_at desc);

-- ── 4) restaurantKey → şube ────────────────────────────────────────────────
-- branches.adisyo_config içine {"restaurantKey":"…"} ya da
-- {"restaurantKeys":["…","…"]} yazılır (CANLIYA UYGULANACAK, D-S1-LOG).
-- Eşleşme yoksa app_settings.adisyo_orders.default_branch_fallback = true ise
-- varsayılan şube; değilse NULL (sonradan adisyo_orders_relink() ile düzelir).
create or replace function public.adisyo_resolve_branch(p_restaurant_key text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select b.id from public.branches b
      where p_restaurant_key is not null
        and b.adisyo_config is not null
        and (
          b.adisyo_config->>'restaurantKey' = p_restaurant_key
          or (jsonb_typeof(b.adisyo_config->'restaurantKeys') = 'array'
              and b.adisyo_config->'restaurantKeys' ? p_restaurant_key)
        )
      order by b.is_default desc, b.created_at
      limit 1),
    (select b.id from public.branches b
      where coalesce((select (s.value->>'default_branch_fallback')::boolean
                        from public.app_settings s where s.key = 'adisyo_orders'), false)
        and b.is_default
      order by b.created_at
      limit 1)
  );
$$;

-- ── 5) Upsert (beyaz liste + idempotent) ───────────────────────────────────
-- Girdi: _shared/adisyo-orders.ts → toAdisyoOrderRow() çıktısı. Yalnız bilinen
-- anahtarlar okunur; items öğeleri de yeniden kurulur (fazla alan atılır).
-- Dönüş: 'inserted' | 'updated' | 'unchanged'
create or replace function public.adisyo_order_upsert(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       bigint := nullif(p->>'adisyo_order_id', '')::bigint;
  v_channel  text   := coalesce(p->>'channel', 'diger');
  v_app_id   bigint;
  v_app_br   uuid;
  v_branch   uuid;
  v_items    jsonb;
  v_hash     text   := coalesce(nullif(p->>'raw_hash', ''), md5(p::text));
  v_inserted boolean;
begin
  if v_id is null then
    raise exception 'adisyo_order_upsert: adisyo_order_id gerekli' using errcode = '22023';
  end if;
  if v_channel not in ('app','yemeksepeti','trendyol_go','getir','migros','salon','telefon','diger') then
    v_channel := 'diger';
  end if;

  select o.id, o.branch_id into v_app_id, v_app_br
    from public.orders o where o.adisyo_order_id = v_id
    order by o.id limit 1;
  if v_app_id is not null then v_channel := 'app'; end if;

  v_branch := coalesce(public.adisyo_resolve_branch(nullif(p->>'restaurant_key', '')), v_app_br);

  select coalesce(jsonb_agg(jsonb_build_object(
           'name',       left(e->>'name', 120),
           'quantity',   coalesce(nullif(e->>'quantity','')::numeric, 1),
           'unit_price', nullif(e->>'unit_price','')::numeric,
           'product_id', nullif(e->>'product_id','')::bigint)), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(case when jsonb_typeof(p->'items') = 'array' then p->'items' else '[]'::jsonb end) e
   where coalesce(e->>'name', '') <> '';

  insert into public.adisyo_orders as t (
    adisyo_order_id, order_number, restaurant_key, branch_id, channel, channel_raw,
    status_id, order_type, total, discount, tax, payment_method,
    inserted_at, closed_at, prepared_at, is_cancelled, cancel_reason, external_ref,
    items, app_order_id, raw_hash, updated_at
  ) values (
    v_id,
    left(p->>'order_number', 40),
    left(p->>'restaurant_key', 80),
    v_branch,
    v_channel,
    left(p->>'channel_raw', 120),
    nullif(p->>'status_id', '')::integer,
    left(p->>'order_type', 40),
    nullif(p->>'total', '')::numeric,
    nullif(p->>'discount', '')::numeric,
    nullif(p->>'tax', '')::numeric,
    left(p->>'payment_method', 120),
    nullif(p->>'inserted_at', '')::timestamptz,
    nullif(p->>'closed_at', '')::timestamptz,
    nullif(p->>'prepared_at', '')::timestamptz,
    coalesce((p->>'is_cancelled')::boolean, false),
    left(p->>'cancel_reason', 200),
    left(p->>'external_ref', 80),
    v_items,
    v_app_id,
    v_hash,
    now()
  )
  on conflict (adisyo_order_id) do update set
    order_number   = excluded.order_number,
    restaurant_key = excluded.restaurant_key,
    branch_id      = excluded.branch_id,
    channel        = excluded.channel,
    channel_raw    = excluded.channel_raw,
    status_id      = excluded.status_id,
    order_type     = excluded.order_type,
    total          = excluded.total,
    discount       = excluded.discount,
    tax            = excluded.tax,
    payment_method = excluded.payment_method,
    inserted_at    = coalesce(excluded.inserted_at, t.inserted_at),
    closed_at      = coalesce(excluded.closed_at, t.closed_at),
    prepared_at    = coalesce(excluded.prepared_at, t.prepared_at),
    is_cancelled   = excluded.is_cancelled,
    cancel_reason  = excluded.cancel_reason,
    external_ref   = coalesce(excluded.external_ref, t.external_ref),
    items          = excluded.items,
    app_order_id   = coalesce(excluded.app_order_id, t.app_order_id),
    raw_hash       = excluded.raw_hash,
    updated_at     = now()
  where t.raw_hash     is distinct from excluded.raw_hash
     or t.app_order_id is distinct from coalesce(excluded.app_order_id, t.app_order_id)
     or t.branch_id    is distinct from excluded.branch_id
  returning (xmax = 0) into v_inserted;

  if v_inserted is null then return 'unchanged'; end if;
  return case when v_inserted then 'inserted' else 'updated' end;
end;
$$;

-- ── 6) Sonradan eşleme: şube anahtarı / uygulama siparişi bağlantısı ───────
-- SaveOrder yanıtı webhook'tan SONRA gelirse ilk yazımda app_order_id boş
-- kalabilir; adisyo-reconcile her gece bunu çağırır. Dönüş: güncellenen satır.
create or replace function public.adisyo_orders_relink()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  with hedef as (
    select a.adisyo_order_id,
           o.id as app_id,
           coalesce(public.adisyo_resolve_branch(a.restaurant_key), o.branch_id, a.branch_id) as br
      from public.adisyo_orders a
      left join lateral (
        select o.id, o.branch_id from public.orders o
         where o.adisyo_order_id = a.adisyo_order_id order by o.id limit 1
      ) o on true
  )
  update public.adisyo_orders a
     set app_order_id = coalesce(h.app_id, a.app_order_id),
         channel      = case when h.app_id is not null then 'app' else a.channel end,
         branch_id    = h.br,
         updated_at   = now()
    from hedef h
   where h.adisyo_order_id = a.adisyo_order_id
     and (a.app_order_id is distinct from coalesce(h.app_id, a.app_order_id)
          or a.branch_id is distinct from h.br
          or (h.app_id is not null and a.channel <> 'app'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.adisyo_resolve_branch(text) from public, anon, authenticated;
revoke all on function public.adisyo_order_upsert(jsonb)  from public, anon, authenticated;
revoke all on function public.adisyo_orders_relink()       from public, anon, authenticated;
grant execute on function public.adisyo_resolve_branch(text) to service_role;
grant execute on function public.adisyo_order_upsert(jsonb)  to service_role;
grant execute on function public.adisyo_orders_relink()       to service_role;

insert into public.app_settings (key, value, description) values
  ('adisyo_orders', '{"default_branch_fallback": false}'::jsonb,
   'D-S1: restaurantKey hiçbir şubeyle eşleşmezse varsayılan şubeye yaz (true) ya da boş bırak (false).')
on conflict (key) do nothing;

commit;
