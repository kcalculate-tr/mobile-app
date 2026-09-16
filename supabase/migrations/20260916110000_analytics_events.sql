-- Görev 1.2 (Sprint 1): tek analitik olay tablosu + order_financials view +
-- order_delivered'ın sunucu tarafından (trigger) yazılması.

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  anon_id text,
  session_id text,
  event_name text not null,
  props jsonb not null default '{}',
  platform text,          -- ios | android | web
  app_version text,
  created_at timestamptz not null default now()
);

create index on public.analytics_events (event_name, created_at);
create index on public.analytics_events (user_id, created_at);

alter table public.analytics_events enable row level security;

-- Yalnızca insert; kullanıcı kendi user_id'si ile veya anonim (user_id null)
-- yazabilir. Select politikası YOK — anon/authenticated'in tablo-seviyesi
-- varsayılan yetkisi (bu şemada tüm yeni tablolara otomatik veriliyor) RLS'in
-- SELECT için tanımlı politikası olmadığı için fiilen 0 satır döndürür.
create policy "insert own events" on public.analytics_events
  for insert with check (user_id is null or user_id = auth.uid());

comment on table public.analytics_events is
  'Tek olay tablosu (S1: app_open, home_view, product_view, add_to_cart, remove_from_cart, cart_view, begin_checkout, payment_attempt/success/failed, purchase, order_delivered). Finansal veri (marj/maliyet) buraya YAZILMAZ — bkz. order_financials.';

-- ─── order_financials ────────────────────────────────────────────────────
-- Katkı marjı hiçbir event'e yazılmıyor; bu view tek finansal kaynak.
-- cogs şimdilik null (sonra girilecek) — contribution_margin de NULL kalır
-- (null propagation), COGS girilince otomatik hesaplanır.
--
-- security_invoker: orders tablosunun RLS'ine tabi olsun (view'i oluşturan
-- postgres rolünün ayrıcalıklarıyla tüm siparişleri sızdırmasın).
-- Ayrıca anon/authenticated'e VARSAYILAN verilen erişim açıkça geri alınıp
-- yalnızca service_role'e (boss panel / dashboard) izin veriliyor — bu,
-- ciro/marj verisinin mobil istemciye hiç ulaşmaması için ek güvenlik katmanı.
create view public.order_financials
with (security_invoker = true) as
select
  o.id as order_id,
  o.subtotal_amount as gross_revenue,
  coalesce(o.discount_amount, 0) + coalesce(o.macro_discount_amount, 0) as discount,
  o.total_amount as net_revenue,
  null::numeric as cogs,
  o.delivery_fee as delivery_cost,
  o.total_amount - o.delivery_fee - null::numeric as contribution_margin
from public.orders o;

revoke all on public.order_financials from public, anon, authenticated;
grant select on public.order_financials to service_role;

-- ─── order_delivered (sunucu tarafı) ────────────────────────────────────
-- orders.status 'delivered'a GERÇEKTEN geçtiğinde (önceki durumdan farklıysa)
-- analytics_events'e otomatik satır düşer. security definer: branch panel
-- teslimatı authenticated bir personel rolüyle işaretlerse bile (o kişinin
-- auth.uid()'si siparişin user_id'si değildir) insert RLS'e takılmasın diye
-- — record_campaign_use() ile aynı, bu repoda zaten kullanılan pattern.
create or replace function public.record_order_delivered_event()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status = 'delivered'
     and (TG_OP = 'INSERT' or OLD.status is distinct from NEW.status)
  then
    insert into public.analytics_events (user_id, event_name, props)
    values (
      NEW.user_id,
      'order_delivered',
      jsonb_build_object(
        'order_id', NEW.id,
        'branch_id', NEW.branch_id,
        'source', 'order_status_trigger'
      )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists orders_record_delivered_event on public.orders;

create trigger orders_record_delivered_event
  after insert or update of status on public.orders
  for each row
  execute function public.record_order_delivered_event();
