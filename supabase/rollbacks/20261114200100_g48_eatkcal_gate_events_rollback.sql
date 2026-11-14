-- G48-S1 — 20261114200100_g48_eatkcal_gate_events GERİ ALMA.
-- Yalnız sözlük satırlarını siler; analytics_events'teki geçmiş olaylara dokunmaz.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('eatkcal_gate_view', 'eatkcal_gate_select', 'eatkcal_waitlist_submit');
  end if;
end $$;

commit;
