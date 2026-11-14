-- G54-S1 — 20261115100100_g54_orient_v110_events GERİ ALMA.
-- Yalnız sözlük satırlarını siler; analytics_events'teki geçmiş olaylara dokunmaz.
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names where name in ('orient_v110_view', 'orient_v110_complete', 'orient_v110_skip');
  end if;
end $$;

commit;
