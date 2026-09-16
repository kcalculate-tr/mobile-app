-- ============================================================================
-- DÜZELTME: Tera paylaşımlı ekstra grup fiyatları (CANLI option_items UPDATE)
-- ============================================================================
-- Pilot ilk kurulumda Ekstra Meze/Turşu/Sos'a GETİR ondalıkları girilmişti (yanlış).
-- İlter gerçek fiyatları verdi. Sadece price_adjustment güncellenir; makro/diğer
-- alanlara DOKUNULMAZ. UPDATE doğası gereği idempotent (tekrar çalıştırılabilir).
--
-- DEPLOY EDİLMEDİ — İlter Supabase SQL Editor'da çalıştıracak.
-- Etkilenen 3 grup: Ekstra Meze (..0007), Ekstra Turşu (..0009), Ekstra Sos (..000b).
-- Diğer ekstra gruplar (Garnitür/Sebze/Çıtır/Meze/Sos-Sezar) ZATEN doğruydu.
-- ============================================================================

-- ── ÖN-KONTROL: çalıştırmadan ÖNCE mevcut (yanlış) değerleri gör ─────────────
SELECT g.name AS grup, i.name AS item, i.price_adjustment AS mevcut_fiyat
FROM option_items i JOIN option_groups g ON g.id = i.group_id
WHERE i.group_id IN ('a0000000-0000-4000-8000-000000000007',
                     'a0000000-0000-4000-8000-000000000009',
                     'a0000000-0000-4000-8000-00000000000b')
ORDER BY g.name, i.sort_order;
--  Beklenen ÖNCE: Ekstra Meze 26-60, Ekstra Turşu 5-22, Ekstra Sos hepsi 75.

-- ── DÜZELTME ────────────────────────────────────────────────────────────────
BEGIN;

-- Ekstra Meze: hepsi 50, Guacamole 60
UPDATE option_items SET price_adjustment = 50
  WHERE group_id = 'a0000000-0000-4000-8000-000000000007';
UPDATE option_items SET price_adjustment = 60
  WHERE group_id = 'a0000000-0000-4000-8000-000000000007' AND name = 'Guacamole';

-- Ekstra Turşu: hepsi 40
UPDATE option_items SET price_adjustment = 40
  WHERE group_id = 'a0000000-0000-4000-8000-000000000009';

-- Ekstra Sos: hepsi 35, Sezar 50  (Chipotle/Ranch da 35 — "diğerleri" varsayımı)
UPDATE option_items SET price_adjustment = 35
  WHERE group_id = 'a0000000-0000-4000-8000-00000000000b';
UPDATE option_items SET price_adjustment = 50
  WHERE group_id = 'a0000000-0000-4000-8000-00000000000b' AND name = 'Sezar Sos';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ── DOĞRULAMA: çalıştırdıktan SONRA ─────────────────────────────────────────
SELECT g.name AS grup, i.name AS item, i.price_adjustment AS yeni_fiyat
FROM option_items i JOIN option_groups g ON g.id = i.group_id
WHERE i.group_id IN ('a0000000-0000-4000-8000-000000000007',
                     'a0000000-0000-4000-8000-000000000009',
                     'a0000000-0000-4000-8000-00000000000b')
ORDER BY g.name, i.sort_order;
--  Beklenen SONRA:
--    Ekstra Meze   -> hepsi 50, Guacamole 60
--    Ekstra Sos    -> hepsi 35, Sezar Sos 50
--    Ekstra Turşu  -> hepsi 40

-- ============================================================================
-- ÇALIŞTIRMA SIRASI (tüm Tera kurulumu)
-- ============================================================================
--  1. pilot_tera_chicken_bowl.sql   (Chicken Bowl 52 + paylaşımlı gruplar)  — YAPILDI
--  2. (duplike temizlik SQL'i)        — YAPILDI
--  3. fix_extra_prices.sql            ← BU DOSYA (ekstra fiyat düzeltme)
--  4. tera_products.sql               (7 yeni ürün + kategoriler + pilot taşıma)
--  Not: 3 ile 4 sırası önemli değil; ikisi de pilot'tan SONRA olmalı.
-- ============================================================================
