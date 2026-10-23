-- Her 'purchase' olayi TEK bir oturuma atanir (last-touch): satin alma anindan
-- once baslamis ve penceresi bu ani kapsayan oturumlardan en SON baslayani.
-- Onceki surum pencereye giren her oturumu "satin aldi" sayiyor, bu yuzden
-- donusumu sisiriyordu (72 satin alma -> 85 oturum).
create or replace function public.boss_funnel_sessions(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  session_id      text,
  user_id         uuid,
  basladi_at      timestamptz,
  bitti_at        timestamptz,
  platform        text,
  app_version     text,
  gordu_urun      boolean,
  sepete_ekledi   boolean,
  sepeti_gordu    boolean,
  odemeye_gecti   boolean,
  odeme_denedi    boolean,
  odeme_basarisiz boolean,
  satin_aldi      boolean,
  sepet_tutari    numeric,
  sepet_adet      integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with oturum as (
    select
      e.session_id,
      (array_agg(e.user_id) filter (where e.user_id is not null))[1] as user_id,
      min(e.created_at) as basladi_at,
      max(e.created_at) as bitti_at,
      (array_agg(e.platform) filter (where e.platform is not null))[1]        as platform,
      (array_agg(e.app_version) filter (where e.app_version is not null))[1]  as app_version,
      bool_or(e.event_name = 'product_view')    as gordu_urun,
      bool_or(e.event_name = 'add_to_cart')     as sepete_ekledi,
      bool_or(e.event_name = 'cart_view')       as sepeti_gordu,
      bool_or(e.event_name = 'begin_checkout')  as odemeye_gecti,
      bool_or(e.event_name = 'payment_attempt') as odeme_denedi,
      bool_or(e.event_name = 'payment_failed')  as odeme_basarisiz,
      coalesce(
        max((e.props->>'price')::numeric) filter (where e.event_name = 'begin_checkout'),
        max((e.props->>'price')::numeric) filter (where e.event_name = 'payment_attempt')
      ) as sepet_tutari,
      coalesce(
        max((e.props->>'num_items')::int)  filter (where e.event_name = 'begin_checkout'),
        max((e.props->>'item_count')::int) filter (where e.event_name = 'cart_view')
      ) as sepet_adet
    from public.analytics_events e
    where e.session_id is not null
      and e.created_at >= p_from
      and e.created_at <  p_to
    group by e.session_id
  ),
  satislar as (
    select pe.id, pe.user_id, pe.created_at
    from public.analytics_events pe
    where pe.event_name = 'purchase'
      and pe.user_id is not null
      and pe.created_at >= p_from
      and pe.created_at <  p_to + interval '3 hours'
  ),
  atama as (
    select distinct on (sa.id) sa.id as satis_id, o.session_id
    from satislar sa
    join oturum o
      on o.user_id = sa.user_id
     and sa.created_at >= o.basladi_at
     and sa.created_at <= o.bitti_at + interval '3 hours'
    order by sa.id, o.basladi_at desc
  )
  select
    o.session_id,
    o.user_id,
    o.basladi_at,
    o.bitti_at,
    o.platform,
    o.app_version,
    o.gordu_urun,
    o.sepete_ekledi,
    o.sepeti_gordu,
    o.odemeye_gecti,
    o.odeme_denedi,
    o.odeme_basarisiz,
    (a.session_id is not null) as satin_aldi,
    o.sepet_tutari,
    o.sepet_adet
  from oturum o
  left join (select distinct session_id from atama) a on a.session_id = o.session_id;
$$;;
