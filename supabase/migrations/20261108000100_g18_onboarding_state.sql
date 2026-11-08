-- G18-S1 — İlk 60 saniye: kullanıcı başına kalıcı onboarding durumu + karşılama varyant bayrakları.
-- version: 20261108000100  name: g18_onboarding_state
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı, ORTAK #8).
-- "CANLIYA UYGULANACAK" — docs/night/G18-S1-LOG.md. Geri alma: supabase/rollbacks/20261108000100_g18_onboarding_state_rollback.sql
--
-- 1) profiles.onboarding_state (jsonb, varsayılan '{}'): cihazlar arası taşınan bayraklar
--    { "profileCard": "dismissed" | "done", "orient": { "1": true, ... , "skipped": true } }
--    Yazan: src/modules/onboarding/first/store.ts (yalnız kendi satırı; mevcut
--    "profiles_update_own" politikası yeterli, yeni politika yok). Kolon yokken istemci
--    yalnız AsyncStorage kullanır, hata vermez (geriye uyumlu).
--    Not: "açılış görüldü" BİLEREK burada yok — FinMoOpen: "Uygulama silinip yeniden
--    kurulursa tekrar oynar" → yalnız cihazda (AsyncStorage).
-- 2) Karşılama başlığı varyantı (SON_HAL Tur 26: `onb_welcome_variant`): bayrak sistemi
--    yalnız boolean taşıdığı için iki satır: _b açık → B, _c açık → C, ikisi kapalı → A
--    (varsayılan "Takip et. Üret. Paylaş."). İkisi KAPALI kaydedilir.

begin;

alter table public.profiles
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

comment on column public.profiles.onboarding_state is
  'G18-S1: kullanıcı başına onboarding bayrakları (profil kartı kapatıldı/tamamlandı, oryantasyon adımları). İstemci: modules/onboarding/first/store.ts';

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values
  ('onb_welcome_variant_b', false, 0, '1.1.0', 'Karşılama başlığı B ("Öğünlerin hikâyene dönüşsün"). Kapalı → A.'),
  ('onb_welcome_variant_c', false, 0, '1.1.0', 'Karşılama başlığı C ("Tabağından topluluğuna"). Kapalı → A. B ve C birlikte açıksa B kazanır.')
on conflict (key) do nothing;

commit;
