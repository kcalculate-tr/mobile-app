-- Rollback: 20261109220300_g20_s3_marketing_optin.sql
-- Not: varsayılanı true'ya döndürür (B-11 açığı geri gelir). Mevcut satırlara dokunmaz.
begin;
drop trigger if exists notification_preferences_marketing_optin on public.notification_preferences;
drop function if exists public.notification_preferences_marketing_optin();
alter table public.notification_preferences
  alter column marketing_enabled set default true;
commit;
