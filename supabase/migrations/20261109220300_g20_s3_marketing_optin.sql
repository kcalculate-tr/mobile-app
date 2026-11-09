-- G20-S3 md.6 (B-11 / 6563 ETK md.6) — Pazarlama bildirimi varsayılan KAPALI.
-- UYGULANMADI (yalnız dosya). Rollback: supabase/rollbacks/20261109220300_g20_s3_marketing_optin_rollback.sql
--
-- • MEVCUT satırlar DEĞİŞMEZ (kullanıcıların kayıtlı tercihleri korunur).
-- • Yeni satır pazarlama KAPALI başlar: kolon varsayılanı false + INSERT tetikleyicisi
--   (yeni kullanıcı satırını açan create_notification_preferences_for_user() gövdesi
--   repoda yok; değeri açıkça true yazsa bile yeni satır kapalı başlar).
-- • Açık onay yalnız GÜNCELLEME ile verilir: istemci ilk bildirim izni sheet'indeki
--   ayrı kutu (src/lib/notify/marketing.ts setMarketingOptIn) ve Bildirim ayarları.
-- • send-notification: tercih satırı yoksa pazarlama kapalı (DEPLOY GEREKİR).

begin;

alter table public.notification_preferences
  alter column marketing_enabled set default false;

create or replace function public.notification_preferences_marketing_optin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Yeni satır pazarlamaya kapalı başlar; açık onay sonradan UPDATE ile.
  new.marketing_enabled := false;
  return new;
end;
$$;

revoke all on function public.notification_preferences_marketing_optin() from public, anon, authenticated;

drop trigger if exists notification_preferences_marketing_optin on public.notification_preferences;
create trigger notification_preferences_marketing_optin
  before insert on public.notification_preferences
  for each row execute function public.notification_preferences_marketing_optin();

commit;
