-- G12-S6 — Final tasarım (Dalga 1) bayraklarının sunucu kayıtları.
-- version: 20261105000400  name: g12_flags
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- Staging'de test EDİLMEDİ. Geri alma: supabase/rollbacks/20261105000400_g12_flags_rollback.sql
--
-- Bağımlılık: 20261103000500_feature_flags.sql (public.feature_flags tablosu) —
-- G6-APPLY #0. EN SON uygulanır (20261105000300_g11_fixes.sql / #16'dan SONRA).
--
-- İstemci karşılığı: src/core/flags/registry.ts → FLAG_DEFAULTS.yeni_onboarding /
-- yeni_siparis (yerel varsayılan false). Her iki satır da KAPALI
-- (enabled=false, rollout_percent=0) + min_app_version='1.1.0' ile kaydedilir;
-- yani davranış 1.0.7 ile AYNI kalır. get_my_features min_app_version'ı zaten
-- uygular (_ff_version_gte(p_app_version, min_app_version); FlagsProvider.tsx
-- p_app_version=Constants.expoConfig.version gönderir → 1.0.x cihazlar bu
-- bayrakları hiç almaz). Dalga planı (açma) İlter'in kararına bırakılır; açmak
-- yalnız service_role/admin işidir (admin_set_flag RPC'si, G11).
--
-- on conflict (key) do nothing: canlıda bir satır zaten varsa DOKUNMA (admin'in
-- ayarladığı değeri ezmeyiz).

begin;

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values
  (
    'yeni_onboarding', false, 0, '1.1.0',
    'Final onboarding + Takibe başla + mevcut müşteriye tanıtım (G12-S1). Kapalıyken uygulama 1.0.7 ile aynı; 1.1.0+ gerekir.'
  ),
  (
    'yeni_siparis', false, 0, '1.1.0',
    'eatkcal yeni arayüzü: ana sayfa, mağaza, ürün, sepet, sipariş özeti, adres, siparişler (G12-S5). Kapalıyken uygulama 1.0.7 ile aynı; 1.1.0+ gerekir.'
  )
on conflict (key) do nothing;

commit;
