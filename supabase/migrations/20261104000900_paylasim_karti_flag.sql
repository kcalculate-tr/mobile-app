-- G5-S4 — Paylaşım kartı bayrağının (feature flag) sunucu kaydı.
-- version: 20261104000900  name: paylasim_karti_flag
--
-- DURUM: Bu dosya YALNIZCA yazıldı; canlıya/staging'e UYGULANMADI (gece kuralı).
-- Staging'de test EDİLMEDİ. Geri alma: 20261104000900_paylasim_karti_flag_rollback.sql
--
-- Bağımlılık: 20261103000500_feature_flags.sql (public.feature_flags tablosu).
-- O migration da henüz uygulanmadığı için bu ikisi birlikte uygulanmalıdır.
--
-- İstemci tarafı karşılığı: src/core/flags/registry.ts → FLAG_DEFAULTS.paylasim_karti
-- (yerel varsayılan false). Bayrağı açmak yalnız service_role/admin işidir;
-- aşağıdaki satır bayrağı KAPALI (enabled=false, rollout_percent=0) kaydeder,
-- yani davranış değişmez — dalga planı İlter'in kararına bırakılır.

begin;

insert into public.feature_flags (key, description)
values ('paylasim_karti', 'Öğün/Tabak Röntgeni paylaşım kartı — cihazda görsel üretimi + sistem paylaşımı (G5-S4)')
on conflict (key) do nothing;

commit;
