-- ════════════════════════════════════════════════════════════════════════════
-- Boss paneli huni (funnel) analitigi
-- Kaynak: analytics_events. Birim: session_id (oturum).
-- 'purchase' olayi sunucu tarafinda trigger ile yazildigi icin session_id'si
-- yoktur; bu yuzden oturum -> satin alma eslesmesi user_id + zaman penceresi
-- ile yapilir.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, created_at);
create index if not exists analytics_events_user_event_idx
  on public.analytics_events (user_id, event_name, created_at desc);

-- ── Oturum bazli ham tablo (tum RPC'lerin temeli) ──────────────────────────
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
      (array_agg(e.platform) filter (where e.platform is not null))[1]    as platform,
      (array_agg(e.app_version) filter (where e.app_version is not null))[1] as app_version,
      bool_or(e.event_name = 'product_view')     as gordu_urun,
      bool_or(e.event_name = 'add_to_cart')      as sepete_ekledi,
      bool_or(e.event_name = 'cart_view')        as sepeti_gordu,
      bool_or(e.event_name = 'begin_checkout')   as odemeye_gecti,
      bool_or(e.event_name = 'payment_attempt')  as odeme_denedi,
      bool_or(e.event_name = 'payment_failed')   as odeme_basarisiz,
      -- en son gorulen sepet degeri: begin_checkout > payment_attempt > add_to_cart
      coalesce(
        max((e.props->>'price')::numeric) filter (where e.event_name = 'begin_checkout'),
        max((e.props->>'price')::numeric) filter (where e.event_name = 'payment_attempt')
      ) as sepet_tutari,
      coalesce(
        max((e.props->>'num_items')::int) filter (where e.event_name = 'begin_checkout'),
        max((e.props->>'item_count')::int) filter (where e.event_name = 'cart_view')
      ) as sepet_adet
    from public.analytics_events e
    where e.session_id is not null
      and e.created_at >= p_from
      and e.created_at <  p_to
    group by e.session_id
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
    (o.user_id is not null and exists (
        select 1 from public.analytics_events pe
        where pe.event_name = 'purchase'
          and pe.user_id = o.user_id
          and pe.created_at >= o.basladi_at
          and pe.created_at <= o.bitti_at + interval '3 hours'
    )) as satin_aldi,
    o.sepet_tutari,
    o.sepet_adet
  from oturum o;
$$;

revoke all on function public.boss_funnel_sessions(timestamptz, timestamptz) from public, anon, authenticated;

-- ── 1) Huni ozeti ──────────────────────────────────────────────────────────
create or replace function public.boss_funnel(
  p_from timestamptz default (now() - interval '30 days'),
  p_to   timestamptz default now()
)
returns table (
  sira              int,
  asama             text,
  etiket            text,
  oturum            bigint,
  kisi              bigint,
  onceki_adimdan_yuzde numeric,
  en_ustten_yuzde   numeric,
  dusen_oturum      bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_tepe bigint;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  create temp table _f on commit drop as
  select * from public.boss_funnel_sessions(p_from, p_to);

  -- Huniyi monoton yap: alt asamaya ulasan, ustteki asamalari da gormus kabul edilir
  create temp table _m on commit drop as
  select
    s.session_id,
    s.user_id,
    true                                                                    as a1_oturum,
    (s.gordu_urun or s.sepete_ekledi or s.sepeti_gordu or s.odemeye_gecti
       or s.odeme_denedi or s.satin_aldi)                                   as a2_urun,
    (s.sepete_ekledi or s.odemeye_gecti or s.odeme_denedi or s.satin_aldi)  as a3_sepete,
    (s.sepeti_gordu or s.odemeye_gecti or s.odeme_denedi or s.satin_aldi)   as a4_sepet,
    (s.odemeye_gecti or s.odeme_denedi or s.satin_aldi)                     as a5_odeme,
    (s.odeme_denedi or s.satin_aldi)                                        as a6_deneme,
    s.satin_aldi                                                            as a7_satin
  from _f s;

  select count(*) into v_tepe from _m;

  return query
  with adim as (
    select 1 as sira, 'oturum'         as asama, 'Uygulamayi acti'        as etiket,
           count(*) filter (where a1_oturum) as oturum,
           count(distinct user_id) filter (where a1_oturum) as kisi from _m
    union all
    select 2, 'urun_goruntuleme', 'Urun goruntuledi',
           count(*) filter (where a2_urun), count(distinct user_id) filter (where a2_urun) from _m
    union all
    select 3, 'sepete_ekleme', 'Sepete urun ekledi',
           count(*) filter (where a3_sepete), count(distinct user_id) filter (where a3_sepete) from _m
    union all
    select 4, 'sepet_goruntuleme', 'Sepeti goruntuledi',
           count(*) filter (where a4_sepet), count(distinct user_id) filter (where a4_sepet) from _m
    union all
    select 5, 'odemeye_gecis', 'Odeme sayfasina geldi',
           count(*) filter (where a5_odeme), count(distinct user_id) filter (where a5_odeme) from _m
    union all
    select 6, 'odeme_denemesi', 'Odeme butonuna basti',
           count(*) filter (where a6_deneme), count(distinct user_id) filter (where a6_deneme) from _m
    union all
    select 7, 'satin_alma', 'Siparisi tamamladi',
           count(*) filter (where a7_satin), count(distinct user_id) filter (where a7_satin) from _m
  )
  select
    a.sira,
    a.asama,
    a.etiket,
    a.oturum,
    a.kisi,
    case when lag(a.oturum) over (order by a.sira) > 0
         then round(100.0 * a.oturum / lag(a.oturum) over (order by a.sira), 1) end,
    case when v_tepe > 0 then round(100.0 * a.oturum / v_tepe, 1) end,
    coalesce(lag(a.oturum) over (order by a.sira) - a.oturum, 0)
  from adim a
  order by a.sira;
end;
$$;

-- ── 2) Nerede dusen musteriler (isim/mail ile) ─────────────────────────────
create or replace function public.boss_funnel_dropoffs(
  p_asama text,
  p_from  timestamptz default (now() - interval '30 days'),
  p_to    timestamptz default now(),
  p_limit int default 200
)
returns table (
  user_id      uuid,
  ad_soyad     text,
  email        text,
  telefon      text,
  oturum_sayisi bigint,
  son_gorulme  timestamptz,
  sepet_tutari numeric,
  sepet_adet   integer,
  toplam_siparis bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  return query
  with s as (
    select * from public.boss_funnel_sessions(p_from, p_to)
  ),
  dusen as (
    select *
    from s
    where s.user_id is not null
      and not s.satin_aldi
      and case p_asama
        -- sepete ekledi ama sepeti hic gormedi / odemeye gecmedi
        when 'sepete_ekleme'      then s.sepete_ekledi and not s.odemeye_gecti
        -- sepeti gordu ama odeme sayfasina gelmedi  ("sepetten cikti")
        when 'sepet_goruntuleme'  then s.sepeti_gordu  and not s.odemeye_gecti
        -- odeme sayfasina geldi ama odeme butonuna hic basmadi
        when 'odemeye_gecis'      then s.odemeye_gecti and not s.odeme_denedi
        -- odeme butonuna basti ama siparis olusmadi
        when 'odeme_denemesi'     then s.odeme_denedi
        -- urun gezdi, sepete hic eklemedi
        when 'urun_goruntuleme'   then s.gordu_urun    and not s.sepete_ekledi
        else false
      end
  )
  select
    d.user_id,
    coalesce(nullif(trim(p.full_name), ''),
             nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
             '—')                                   as ad_soyad,
    p.email,
    p.phone,
    count(*)                                        as oturum_sayisi,
    max(d.bitti_at)                                 as son_gorulme,
    max(d.sepet_tutari)                             as sepet_tutari,
    max(d.sepet_adet)                               as sepet_adet,
    (select count(*) from public.orders o
      where o.user_id = d.user_id and o.status <> 'cancelled') as toplam_siparis
  from dusen d
  left join public.profiles p on p.id = d.user_id
  group by d.user_id, p.full_name, p.first_name, p.last_name, p.email, p.phone
  order by max(d.bitti_at) desc
  limit greatest(1, least(p_limit, 1000));
end;
$$;

-- ── 3) Gunluk kirilim (trend grafigi) ──────────────────────────────────────
create or replace function public.boss_funnel_daily(
  p_from timestamptz default (now() - interval '30 days'),
  p_to   timestamptz default now()
)
returns table (
  gun          date,
  oturum       bigint,
  sepete_ekledi bigint,
  odemeye_gecti bigint,
  odeme_denedi  bigint,
  satin_aldi    bigint,
  donusum_yuzde numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;

  return query
  select
    (s.basladi_at at time zone 'Europe/Istanbul')::date as gun,
    count(*)                                            as oturum,
    count(*) filter (where s.sepete_ekledi or s.odemeye_gecti or s.satin_aldi) as sepete_ekledi,
    count(*) filter (where s.odemeye_gecti or s.odeme_denedi or s.satin_aldi)  as odemeye_gecti,
    count(*) filter (where s.odeme_denedi or s.satin_aldi)                     as odeme_denedi,
    count(*) filter (where s.satin_aldi)                                       as satin_aldi,
    case when count(*) > 0
         then round(100.0 * count(*) filter (where s.satin_aldi) / count(*), 1) end
  from public.boss_funnel_sessions(p_from, p_to) s
  group by 1
  order by 1;
end;
$$;

grant execute on function public.boss_funnel(timestamptz, timestamptz) to authenticated;
grant execute on function public.boss_funnel_dropoffs(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.boss_funnel_daily(timestamptz, timestamptz) to authenticated;;
