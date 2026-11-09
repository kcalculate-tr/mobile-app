-- Geri alma: 20261109110000_g19_s3_event_names.sql
-- Yalnız G19-S3'ün eklediği 14 adı siler (D-S1'in adlarına dokunmaz).
do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    return;
  end if;
  delete from public.analytics_event_names
   where name in ('scan_open', 'scan_capture', 'scan_fail', 'scan_limit', 'scan_offline', 'scan_log',
                  'log_add', 'log_edit', 'log_delete', 'water_add', 'activity_add',
                  'streak_day', 'ring_complete', 'login');
end $$;
