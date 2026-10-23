-- STABLE fonksiyon icinde temp tablo kurulamaz; CTE'ye cevrildi.
create or replace function public.boss_funnel(
  p_from timestamptz default (now() - interval '30 days'),
  p_to   timestamptz default now()
)
returns table (
  sira                 int,
  asama                text,
  etiket               text,
  oturum               bigint,
  kisi                 bigint,
  onceki_adimdan_yuzde numeric,
  en_ustten_yuzde      numeric,
  dusen_oturum         bigint
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
  -- Huniyi monoton yap: alt asamaya ulasan, ustteki asamalari da gormus sayilir
  m as (
    select
      s.session_id,
      s.user_id,
      true as a1,
      (s.gordu_urun or s.sepete_ekledi or s.sepeti_gordu or s.odemeye_gecti
         or s.odeme_denedi or s.satin_aldi)                                  as a2,
      (s.sepete_ekledi or s.odemeye_gecti or s.odeme_denedi or s.satin_aldi) as a3,
      (s.sepeti_gordu  or s.odemeye_gecti or s.odeme_denedi or s.satin_aldi) as a4,
      (s.odemeye_gecti or s.odeme_denedi  or s.satin_aldi)                   as a5,
      (s.odeme_denedi  or s.satin_aldi)                                      as a6,
      s.satin_aldi                                                           as a7
    from s
  ),
  tepe as (select count(*)::bigint as n from m),
  adim as (
    select 1 as sira, 'oturum' as asama, 'Uygulamayı açtı' as etiket,
           count(*) filter (where a1) as oturum,
           count(distinct user_id) filter (where a1) as kisi from m
    union all
    select 2, 'urun_goruntuleme', 'Ürün görüntüledi',
           count(*) filter (where a2), count(distinct user_id) filter (where a2) from m
    union all
    select 3, 'sepete_ekleme', 'Sepete ürün ekledi',
           count(*) filter (where a3), count(distinct user_id) filter (where a3) from m
    union all
    select 4, 'sepet_goruntuleme', 'Sepeti görüntüledi',
           count(*) filter (where a4), count(distinct user_id) filter (where a4) from m
    union all
    select 5, 'odemeye_gecis', 'Ödeme sayfasına geldi',
           count(*) filter (where a5), count(distinct user_id) filter (where a5) from m
    union all
    select 6, 'odeme_denemesi', 'Ödeme butonuna bastı',
           count(*) filter (where a6), count(distinct user_id) filter (where a6) from m
    union all
    select 7, 'satin_alma', 'Siparişi tamamladı',
           count(*) filter (where a7), count(distinct user_id) filter (where a7) from m
  )
  select
    a.sira,
    a.asama,
    a.etiket,
    a.oturum,
    a.kisi,
    case when lag(a.oturum) over (order by a.sira) > 0
         then round(100.0 * a.oturum / lag(a.oturum) over (order by a.sira), 1) end,
    case when (select n from tepe) > 0
         then round(100.0 * a.oturum / (select n from tepe), 1) end,
    coalesce(lag(a.oturum) over (order by a.sira) - a.oturum, 0)
  from adim a
  order by a.sira;
end;
$$;

grant execute on function public.boss_funnel(timestamptz, timestamptz) to authenticated;;
