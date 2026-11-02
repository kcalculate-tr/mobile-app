-- =====================================================================
-- G3-S2 — Vault service-key rotasyonu (MANUEL, db push ile ÇALIŞMAZ)
--
-- Bu dosya KASITLI olarak supabase/migrations/ ALTINDA DEĞİL:
--   supabase/migrations-manual/ içinde durur, böylece `supabase db push`
--   onu otomatik UYGULAMAZ. İçinde placeholder vardır; olduğu gibi çalışmaz.
--
-- NE YAPAR: DB içindeki iki Vault secret'ının DEĞERİNİ yeni "secret key"
--   ile değiştirir. DB'deki tüm cron'lar ve trigger'lar service_role anahtarını
--   zaten bu iki Vault secret'ından okur (gövdelerinde gömülü anahtar YOKTUR):
--     - 'service_role_key'          → macro-expiry-daily, paynkolay-review-sweep,
--                                      card-verification-sweep, trendyolgo-poll,
--                                      push-cart-abandoned, push-order-feedback,
--                                      fn_trendyolgo_push_status, behavioral-push
--     - 'adisyo_service_role_key'   → fn_notify_adisyo_save_order (orders trigger)
--
-- NASIL KULLANILIR (rotasyon anında, İlter):
--   1) Dashboard → Project Settings → API Keys → yeni "secret" key oluştur
--      (sb_secret_...). Değeri KOPYALA, hiçbir dosyaya yapıştırma.
--   2) Supabase Dashboard → SQL Editor → bu bloğu yapıştır, PASTE_*_HERE
--      yerlerine gerçek secret key'i yaz, çalıştır. (Tek transaction.)
--   3) Doğrulama sorgularını (altta) çalıştır: length > 0 ve güncel updated_at.
--
-- GERİ DÖNÜŞ: _rollback.sql — eski (legacy) JWT değerini geri yazar.
-- Bu gece HİÇBİR ŞEY UYGULANMADI; staging'de test EDİLMEDİ.
-- =====================================================================

BEGIN;

-- vault.update_secret, secret'ın UUID'sini ister; ada göre bul ve güncelle.
-- (Yeni değeri create/delete yerine update ile yazıyoruz; UUID ve referanslar sabit kalır.)

UPDATE vault.secrets
SET secret = 'PASTE_SECRET_KEY_HERE'          -- sb_secret_...  (service_role eşdeğeri)
WHERE name = 'service_role_key';

UPDATE vault.secrets
SET secret = 'PASTE_SECRET_KEY_HERE'          -- sb_secret_...  (adisyo trigger için — aynı secret key)
WHERE name = 'adisyo_service_role_key';

COMMIT;

-- --------------------------------------------------------------------
-- Doğrulama (değeri AÇMADAN): her iki secret da var ve dolu mu?
-- --------------------------------------------------------------------
-- SELECT name, length(decrypted_secret) AS len, updated_at
-- FROM vault.decrypted_secrets
-- WHERE name IN ('service_role_key', 'adisyo_service_role_key');
-- Beklenen: iki satır, len > 0, updated_at = az önce.
