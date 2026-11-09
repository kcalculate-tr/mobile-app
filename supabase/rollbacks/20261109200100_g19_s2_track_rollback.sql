-- G19-S2: 20261109200100_g19_s2_track.sql geri alma.
-- Yalnız bu migration'ın eklediklerini kaldırır; mevcut veri silinmez.
begin;

delete from public.feature_flags where key = 'ogun_hatirlatma';

alter table public.activity_logs drop constraint if exists activity_logs_minutes_max_chk;
alter table public.activity_logs drop constraint if exists activity_logs_distance_max_chk;

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names
     where name in ('log_add', 'log_edit', 'log_delete', 'water_add', 'activity_add', 'streak_day', 'ring_complete');
  end if;
end $$;

commit;
