-- G46-S1 — 20261114100100_g46_paywall_dismiss_confirm GERİ ALMA.
-- Yalnız sözlük satırını siler; analytics_events'teki geçmiş olaylara dokunmaz.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('paywall_dismiss_confirm');
  end if;
end $$;

commit;
