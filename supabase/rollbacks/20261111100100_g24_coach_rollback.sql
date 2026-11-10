-- Geri alma: 20261111100100_g24_coach.sql (kcalAI Koç).
-- 1) RPC'ler + yardımcı silinir.
-- 2) coach_messages / coach_usage / coach_trial_usage / coach_reservations silinir — DİKKAT:
--    bütün Koç sohbetleri ve sayaçlar kaybolur. Önce: select count(*) from public.coach_messages;
-- 3) app_settings coach_* anahtarları + 'koc' bayrağı + coach_* olay adları silinir.
-- 4) user_consents CHECK'leri G20-S3 hâline döner. kind 'ai_coach' / source 'coach' satırları
--    CHECK'e uymayacağı için ÖNCE silinir (koç izni kayıtları kaybolur).
-- Önce istemcide bayrak 'koc' kapalı olmalı (girişler gizlenir; fonksiyon 404 → giriş gizli).
begin;

drop function if exists public.reserve_coach_message();
drop function if exists public.release_coach_message(uuid);
drop function if exists public.consume_coach_message(uuid);
drop function if exists public.my_coach_status();
drop function if exists public.delete_coach_history();
drop function if exists public._coach_int_setting(text, integer);

drop table if exists public.coach_reservations;
drop table if exists public.coach_trial_usage;
drop table if exists public.coach_usage;
drop table if exists public.coach_messages;

delete from public.app_settings
 where key in ('coach_daily_balance', 'coach_trial_free', 'coach_per_minute', 'coach_retention_days', 'coach_enabled');
delete from public.feature_flags where key = 'koc';

do $$
begin
  if to_regclass('public.analytics_event_names') is not null then
    delete from public.analytics_event_names
     where name in ('coach_open', 'coach_send', 'coach_limit', 'coach_upsell', 'coach_feedback');
  end if;
  if to_regclass('public.user_consents') is not null then
    delete from public.user_consents where kind = 'ai_coach' or source = 'coach';
    alter table public.user_consents drop constraint if exists user_consents_kind_check;
    alter table public.user_consents
      add constraint user_consents_kind_check
      check (kind in ('policy', 'ad_measurement', 'first_party', 'att', 'ai_photo'));
    alter table public.user_consents drop constraint if exists user_consents_source_check;
    alter table public.user_consents
      add constraint user_consents_source_check
      check (source in ('signup_email', 'signup_social', 'notice', 'reconsent', 'settings', 'att', 'scan'));
  end if;
end $$;

commit;
