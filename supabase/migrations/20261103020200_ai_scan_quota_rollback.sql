-- ROLLBACK — 20261103020200_ai_scan_quota
-- Kota tablolarını ve seed'lenen ayarları geri alır. UYGULANMADI (yalnız dosya).
begin;
drop table if exists public.ai_scan_reservations;
drop table if exists public.ai_scan_usage;
delete from public.app_settings where key in ('ai_scan_user_daily_limit', 'ai_scan_daily_cap');
-- app_settings tablosu bu migration'da kuruldu; başka seed kalmadıysa düşür.
drop table if exists public.app_settings;
commit;
