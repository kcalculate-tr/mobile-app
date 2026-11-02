-- =====================================================================
-- G3-S2 — Vault service-key rotasyonu GERİ DÖNÜŞ (MANUEL)
--
-- Yeni secret key bir yeri bozarsa (örn. bir cron 401 almaya başlarsa) ve
-- eski (legacy) JWT anahtarları HENÜZ Dashboard'dan DEVRE DIŞI BIRAKILMADIYSA:
-- Vault secret'larını eski legacy service_role JWT'sine geri yaz.
--
-- NOT: Eski JWT değerini bu dosyaya YAZMA. Rotasyon anında güvenli bir yerden
--      (parola yöneticisi / eski ortam değişkeni) elle yapıştır.
-- UYARI: Legacy anahtarlar Dashboard'da zaten devre dışı bırakıldıysa bu geri
--        dönüş İŞE YARAMAZ — ileri yol yeni secret key'i düzeltmektir.
-- =====================================================================

BEGIN;

UPDATE vault.secrets
SET secret = 'PASTE_LEGACY_SERVICE_ROLE_JWT_HERE'   -- eyJ... (eski JWT, güvenli yerden)
WHERE name = 'service_role_key';

UPDATE vault.secrets
SET secret = 'PASTE_LEGACY_SERVICE_ROLE_JWT_HERE'   -- eyJ... (eski JWT)
WHERE name = 'adisyo_service_role_key';

COMMIT;

-- Doğrulama:
-- SELECT name, length(decrypted_secret) AS len, updated_at
-- FROM vault.decrypted_secrets
-- WHERE name IN ('service_role_key', 'adisyo_service_role_key');
