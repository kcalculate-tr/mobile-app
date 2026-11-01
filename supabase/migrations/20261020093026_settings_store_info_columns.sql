-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261020093026  name: settings_store_info_columns
alter table public.settings
  add column if not exists store_name          text,
  add column if not exists store_phone         text,
  add column if not exists store_email         text,
  add column if not exists currency            text default '₺',
  add column if not exists notification_email  text;

comment on column public.settings.notification_email is
  'Destek talebi / sipariş uyarı e-postalarının gideceği adres (boss paneli Genel Ayarlar)';

update public.settings
   set store_name  = coalesce(store_name, 'kcalculate'),
       store_email = coalesce(store_email, 'info@eatkcal.com'),
       currency    = coalesce(currency, '₺')
 where id = 1;
