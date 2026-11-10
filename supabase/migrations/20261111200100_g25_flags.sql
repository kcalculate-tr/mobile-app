-- G25-S1 md.3 + md.7 — 1.1.0 inceleme öncesi iki yeni uzak bayrak (ikisi de KAPALI → gizli).
--
-- 1) yakinda_satirlari (A4, kılavuz 2.1/2.3 tamlık): Profil › kcalAI "Yakında" satırları
--    (Egzersiz rehberi, Öğün aboneliği, Vital) ve FinPrMacro "Öğün aboneliği" sekmesi.
--    Kapalıyken hiçbiri çizilmez; özellik gerçekten gelince İlter açar.
-- 2) paylasim_baglanti (A10): Keşfet gönderi/profil "Bağlantıyı kopyala / Paylaş" düğmeleri.
--    l.eatkcal.com (DNS + AASA/assetlinks + /p /u önizleme sayfaları) yayında olana kadar KAPALI;
--    Universal Link kodu uygulamada kalır. Alan adı hazır olunca açılır (OTA gerekmez).
--
-- Yalnız satır ekler; şema değişikliği yok. Tekrar çalıştırılabilir (on conflict do nothing).
-- Geri alma: supabase/rollbacks/20261111200100_g25_flags_rollback.sql
begin;

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'yakinda_satirlari', false, 0, '1.1.0',
  'G25-S1 (A4): Profil "Yakında" satırları (Egzersiz rehberi, Öğün aboneliği, Vital) + FinPrMacro "Öğün aboneliği" sekmesi. Kapalı → gizli (mağaza incelemesi 2.1/2.3).'
)
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, rollout_percent, min_app_version, description)
values (
  'paylasim_baglanti', false, 0, '1.1.0',
  'G25-S1 (A10): Keşfet gönderi/profil "Bağlantıyı kopyala / Paylaş" düğmeleri. l.eatkcal.com (DNS + AASA + önizleme) yayında olunca açılır; kapalı → gizli.'
)
on conflict (key) do nothing;

commit;
