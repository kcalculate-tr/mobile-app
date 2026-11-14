-- G49-S1 — 20261114220100_g49_home_plan_card_events GERİ ALMA.
-- Yalnız sözlük satırlarını siler; analytics_events'teki geçmiş olaylara dokunmaz.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('home_plan_card_view', 'home_plan_card_tap');
  end if;
end $$;

commit;
