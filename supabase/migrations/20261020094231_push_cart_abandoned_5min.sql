-- ════════════════════════════════════════════════════════════════════════════
-- Sepeti terk eden musteriye 5 dakika icinde tek seferlik push.
--
-- Sepet istemci tarafinda (AsyncStorage) tutuldugu icin sunucu sepetin
-- icerigini bilmez; bu yuzden "sepette urun var" sinyali analytics_events
-- uzerinden cikarilir:
--   dolu  <- add_to_cart  |  cart_view (item_count > 0)
--   bos   <- cart_view (item_count = 0)
-- Son dolu sinyalden sonra bosaltma veya satin alma yoksa sepet hala dolu
-- kabul edilir.
--
-- 'cart_abandoned' sablonu zaten vardi ama hicbir sey tetiklemiyordu
-- (son gonderim: 24 Nisan, tek adet test).
-- ════════════════════════════════════════════════════════════════════════════

-- Bildirim sepete gitsin, ana sayfaya degil
update public.notification_templates
   set deep_link = 'Cart', updated_at = now()
 where key = 'cart_abandoned';

create or replace function public.fn_push_cart_abandoned()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user       record;
  v_sayac      integer := 0;
  v_acik       boolean;
  v_ist_saat   time;
  v_ist_gun    int;
begin
  -- ── Magaza kapaliyken sepet hatirlatmasi gonderme ──
  select s.is_shop_open,
         (now() at time zone 'Europe/Istanbul')::time,
         extract(isodow from (now() at time zone 'Europe/Istanbul'))::int
    into v_acik, v_ist_saat, v_ist_gun
    from public.settings s
   where s.id = 1;

  if coalesce(v_acik, false) = false then
    return 0;
  end if;

  if not exists (
    select 1 from public.settings s
     where s.id = 1
       and v_ist_gun = any (coalesce(s.working_days, array[1,2,3,4,5,6]))
       and v_ist_saat >= coalesce(s.open_time, time '09:00')
       -- kapanisa 45 dakikadan az kaldiysa siparis yetismez, gonderme
       and v_ist_saat <= coalesce(s.close_time, time '23:59') - interval '45 minutes'
  ) then
    return 0;
  end if;

  for v_user in
    with dolu as (
      select e.user_id, max(e.created_at) as dolu_at
        from public.analytics_events e
       where e.user_id is not null
         and e.created_at > now() - interval '6 hours'
         and (e.event_name = 'add_to_cart'
              or (e.event_name = 'cart_view'
                  and coalesce((e.props->>'item_count')::int, 0) > 0))
       group by e.user_id
    ),
    bos as (
      select e.user_id, max(e.created_at) as bos_at
        from public.analytics_events e
       where e.user_id is not null
         and e.created_at > now() - interval '6 hours'
         and e.event_name = 'cart_view'
         and coalesce((e.props->>'item_count')::int, 0) = 0
       group by e.user_id
    ),
    satin as (
      select e.user_id, max(e.created_at) as satin_at
        from public.analytics_events e
       where e.user_id is not null
         and e.created_at > now() - interval '6 hours'
         and e.event_name = 'purchase'
       group by e.user_id
    )
    select d.user_id
      from dolu d
      left join bos   b  on b.user_id  = d.user_id
      left join satin sa on sa.user_id = d.user_id
     where d.dolu_at <= now() - interval '5 minutes'
       -- ust sinir: is gecikirse 1 saat onceki sepete push atmamak icin
       and d.dolu_at >  now() - interval '35 minutes'
       and (b.bos_at   is null or b.bos_at   < d.dolu_at)
       and (sa.satin_at is null or sa.satin_at < d.dolu_at)
       -- ayni kisiye 24 saatte en fazla bir kez
       and not exists (
         select 1 from public.notification_sends ns
          where ns.user_id      = d.user_id
            and ns.template_key = 'cart_abandoned'
            and ns.created_at   > now() - interval '24 hours'
       )
       -- aktif push tokeni olmayana ugrasma
       and exists (
         select 1 from public.push_tokens pt
          where pt.user_id = d.user_id and pt.is_active
       )
  loop
    perform public.trigger_behavioral_push(v_user.user_id, 'cart_abandoned');
    v_sayac := v_sayac + 1;
  end loop;

  return v_sayac;
exception when others then
  raise warning 'fn_push_cart_abandoned failed: % (%)', sqlerrm, sqlstate;
  return -1;
end;
$$;

revoke all on function public.fn_push_cart_abandoned() from public, anon, authenticated;

select cron.schedule(
  'push-cart-abandoned',
  '*/2 * * * *',
  $cron$ select public.fn_push_cart_abandoned(); $cron$
);;
