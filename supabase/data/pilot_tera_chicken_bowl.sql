-- ============================================================================
-- PİLOT: TERA CHICKEN BOWL — tek ürün, tam kurulum (is_bundle=true / canlı makro)
-- ============================================================================
-- AMAÇ: Kalıbı doğrulamak. Doğruysa kalan 27 ürün aynı şablonla seri üretilir.
--   - Paylaşımlı yan gruplar SABİT UUID ile bir kez kurulur (aşağıda "ORTAK
--     GRUP REGISTRY"). Sonraki bowl'lar bu UUID'lere SADECE junction ekler.
--   - Protein grubu bowl'a ÖZEL (Chicken). Her bowl kendi protein UUID'sini alır.
--   - Makrolar inline (option_items.calories/protein/carbs/fats) — nutrition.md.
--   - is_bundle=true => ProductDetail makroyu seçilen item'lardan CANLI toplar.
--
-- DEPLOY EDİLMEDİ. Supabase SQL Editor'da elle çalıştırılacak. Yeniden
-- çalıştırmaya karşı korumalı (ON CONFLICT DO NOTHING + product guard).
--
-- ⚠️ İLTER ONAYI BEKLEYEN NOKTALAR dosya sonundaki CHECKLIST'te.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- ORTAK GRUP REGISTRY (sabit UUID'ler — tüm Tera Bowl'lar paylaşır)
-- Bu UUID'ler kalan 27 üründe de AYNEN kullanılacak. Değiştirme.
-- ────────────────────────────────────────────────────────────────────────────
--  Baz Seçimi          a0000000-0000-4000-8000-000000000001
--  Garnitür            a0000000-0000-4000-8000-000000000002
--  Ekstra Garnitür     a0000000-0000-4000-8000-000000000003
--  Sebze               a0000000-0000-4000-8000-000000000004
--  Ekstra Sebze        a0000000-0000-4000-8000-000000000005
--  Meze                a0000000-0000-4000-8000-000000000006
--  Ekstra Meze         a0000000-0000-4000-8000-000000000007
--  Turşu               a0000000-0000-4000-8000-000000000008
--  Ekstra Turşu        a0000000-0000-4000-8000-000000000009
--  Sos                 a0000000-0000-4000-8000-00000000000a
--  Ekstra Sos          a0000000-0000-4000-8000-00000000000b
--  Çıtır               a0000000-0000-4000-8000-00000000000c
--  Protein (CHICKEN)   b0000000-0000-4000-8000-000000000001  (bowl'a ÖZEL)


-- ════════════════════════════════════════════════════════════════════════════
-- 1) KATEGORİ: "Tera Bowl"  (parent_id=17 = "Tüm Ürünler" kök)
--    categories.id INTEGER/serial (canlı). parent_id INTEGER. id'yi serial ver.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Tera Bowl', '🥙', 60, 17, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Tera Bowl');
--  emoji: 🥙 geçici öneri. image_url: görsel yüklenince set edilecek.


-- ════════════════════════════════════════════════════════════════════════════
-- 2) ORTAK GRUPLAR + ITEM'LAR  (sabit UUID, ON CONFLICT DO NOTHING => idempotent)
--    min/max: İlter kararı (Baz zorunlu; yan gruplar isteğe bağlı).
--    Makro: nutrition.md (porsiyon başına).  Fiyat: İlter verdikleri + gerisi Getir.
-- ════════════════════════════════════════════════════════════════════════════

-- KARAR: Baz + Protein ZORUNLU (bowl'un olmazsa olmazı). Garnitür/Sebze/Meze/
-- Turşu/Sos İSTEĞE BAĞLI (min0, is_required=false). Çıtır tek grup.
-- Ekstra Baz + Ekstra Protein KALDIRILDI (İlter kararı).
INSERT INTO option_groups (id, name, description, min_selection, max_selection, is_required) VALUES
  ('a0000000-0000-4000-8000-000000000001','Baz Seçimi',      NULL, 1, 1, true),   -- ZORUNLU
  ('a0000000-0000-4000-8000-000000000002','Garnitür',        NULL, 0, 2, false),  -- isteğe bağlı (İlter)
  ('a0000000-0000-4000-8000-000000000003','Ekstra Garnitür', NULL, 0, 4, false),
  ('a0000000-0000-4000-8000-000000000004','Sebze',           NULL, 0, 2, false),  -- isteğe bağlı (İlter)
  ('a0000000-0000-4000-8000-000000000005','Ekstra Sebze',    NULL, 0, 4, false),
  ('a0000000-0000-4000-8000-000000000006','Meze',            NULL, 0, 2, false),  -- isteğe bağlı (İlter)
  ('a0000000-0000-4000-8000-000000000007','Ekstra Meze',     NULL, 0, 8, false),
  ('a0000000-0000-4000-8000-000000000008','Turşu',           NULL, 0, 1, false),  -- isteğe bağlı (İlter)
  ('a0000000-0000-4000-8000-000000000009','Ekstra Turşu',    NULL, 0, 5, false),
  ('a0000000-0000-4000-8000-00000000000a','Sos',             NULL, 0, 1, false),  -- isteğe bağlı (İlter)
  ('a0000000-0000-4000-8000-00000000000b','Ekstra Sos',      NULL, 0, 6, false),
  ('a0000000-0000-4000-8000-00000000000c','Çıtır',           NULL, 0, 1, false)   -- tek grup
ON CONFLICT (id) DO NOTHING;

-- ── ITEM'LAR ───────────────────────────────────────────────────────────────
-- option_items: (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
-- linked_product_id YOK (inline makro). is_available default true.

-- Baz Seçimi (zorunlu, +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000001','Basmati',                    0, 198, 4.5, 46.5, 0.6, 0),
  ('a0000000-0000-4000-8000-000000000001','Akdeniz Lolorosso',          0,  24, 1.4,  2.6, 0.3, 1),
  ('a0000000-0000-4000-8000-000000000001','Basmati & Lolorosso Karışık',0, 111, 2.9, 24.5, 0.5, 2)
ON CONFLICT DO NOTHING;

-- Garnitür (isteğe bağlı, max2, +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000002','Garnitür (Karışık)', 0, 36, 1.6,  6.9, 0.3, 0),
  ('a0000000-0000-4000-8000-000000000002','Meksika Fasulye',    0, 47, 3.7,  8.9, 0.6, 1),
  ('a0000000-0000-4000-8000-000000000002','Maş Fasulye',        0, 63, 4.2, 11.4, 0.2, 2),
  ('a0000000-0000-4000-8000-000000000002','Beluga',             0, 72, 5.1, 12.0, 0.3, 3)
ON CONFLICT DO NOTHING;

-- Ekstra Garnitür (İlter: +50 her item)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000003','Garnitür (Karışık)', 50, 36, 1.6,  6.9, 0.3, 0),
  ('a0000000-0000-4000-8000-000000000003','Meksika Fasulye',    50, 47, 3.7,  8.9, 0.6, 1),
  ('a0000000-0000-4000-8000-000000000003','Maş Fasulye',        50, 63, 4.2, 11.4, 0.2, 2),
  ('a0000000-0000-4000-8000-000000000003','Beluga',             50, 72, 5.1, 12.0, 0.3, 3)
ON CONFLICT DO NOTHING;

-- Sebze (isteğe bağlı, max2, +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000004','Domates',       0,  9, 0.4, 1.9, 0.1, 0),
  ('a0000000-0000-4000-8000-000000000004','Salatalık',     0,  6, 0.3, 0.9, 0.1, 1),
  ('a0000000-0000-4000-8000-000000000004','Brokoli',       0, 18, 1.6, 0.9, 0.1, 2),
  ('a0000000-0000-4000-8000-000000000004','Tatlı Patates', 0, 43, 0.8,10.1, 0.0, 3)
ON CONFLICT DO NOTHING;

-- Ekstra Sebze (İlter: Domates/Salatalık +40, Brokoli/Tatlı Patates +60)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000005','Domates',       40,  9, 0.4, 1.9, 0.1, 0),
  ('a0000000-0000-4000-8000-000000000005','Salatalık',     40,  6, 0.3, 0.9, 0.1, 1),
  ('a0000000-0000-4000-8000-000000000005','Brokoli',       60, 18, 1.6, 0.9, 0.1, 2),
  ('a0000000-0000-4000-8000-000000000005','Tatlı Patates', 60, 43, 0.8,10.1, 0.0, 3)
ON CONFLICT DO NOTHING;

-- Meze (isteğe bağlı, max2; İlter: Guacamole +50 premium, diğerleri +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000006','Cheddarlı Patates Püresi', 0, 92, 2.2, 5.6, 6.8, 0),
  ('a0000000-0000-4000-8000-000000000006','Havuç Tarator',            0, 60, 1.3, 2.8, 5.0, 1),
  ('a0000000-0000-4000-8000-000000000006','Köz Biberli Humus',        0, 94, 2.3, 5.2, 6.8, 2),
  ('a0000000-0000-4000-8000-000000000006','Közlenmiş Biber',          0, 36, 0.5, 2.0, 2.8, 3),
  ('a0000000-0000-4000-8000-000000000006','Közlenmiş Patlıcan',       0, 14, 1.0, 2.0, 0.1, 4),
  ('a0000000-0000-4000-8000-000000000006','Yoğurt',                   0, 50, 3.2, 1.3, 3.5, 5),
  ('a0000000-0000-4000-8000-000000000006','Dilimli Zeytin',           0, 58, 0.5, 1.5, 6.1, 6),
  ('a0000000-0000-4000-8000-000000000006','Guacamole',               50, 64, 0.8, 3.6, 6.0, 7)
ON CONFLICT DO NOTHING;

-- Ekstra Meze (İlter gerçek fiyat: hepsi 50, Guacamole 60)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000007','Cheddarlı Patates Püresi', 50, 92, 2.2, 5.6, 6.8, 0),
  ('a0000000-0000-4000-8000-000000000007','Havuç Tarator',            50, 60, 1.3, 2.8, 5.0, 1),
  ('a0000000-0000-4000-8000-000000000007','Köz Biberli Humus',        50, 94, 2.3, 5.2, 6.8, 2),
  ('a0000000-0000-4000-8000-000000000007','Közlenmiş Biber',          50, 36, 0.5, 2.0, 2.8, 3),
  ('a0000000-0000-4000-8000-000000000007','Közlenmiş Patlıcan',       50, 14, 1.0, 2.0, 0.1, 4),
  ('a0000000-0000-4000-8000-000000000007','Yoğurt',                   50, 50, 3.2, 1.3, 3.5, 5),
  ('a0000000-0000-4000-8000-000000000007','Dilimli Zeytin',           50, 58, 0.5, 1.5, 6.1, 6),
  ('a0000000-0000-4000-8000-000000000007','Guacamole',                60, 64, 0.8, 3.6, 6.0, 7)
ON CONFLICT DO NOTHING;

-- Turşu (isteğe bağlı, max1, +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000008','Salatalık Turşu',    0, 2, 0.1, 0.3, 0.0, 0),
  ('a0000000-0000-4000-8000-000000000008','Pancar Turşu',       0,10, 0.2, 2.0, 0.2, 1),
  ('a0000000-0000-4000-8000-000000000008','Jalapeno',           0, 9, 0.3, 1.5, 0.1, 2),
  ('a0000000-0000-4000-8000-000000000008','Beyaz Turp Turşusu', 0, 5, 0.2, 0.9, 0.0, 3),
  ('a0000000-0000-4000-8000-000000000008','Kapari',             0, 7, 0.7, 1.5, 0.3, 4)
ON CONFLICT DO NOTHING;

-- Ekstra Turşu (İlter gerçek fiyat: hepsi 40)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000009','Salatalık Turşu',    40, 2, 0.1, 0.3, 0.0, 0),
  ('a0000000-0000-4000-8000-000000000009','Pancar Turşu',       40,10, 0.2, 2.0, 0.2, 1),
  ('a0000000-0000-4000-8000-000000000009','Jalapeno',           40, 9, 0.3, 1.5, 0.1, 2),
  ('a0000000-0000-4000-8000-000000000009','Beyaz Turp Turşusu', 40, 5, 0.2, 0.9, 0.0, 3),
  ('a0000000-0000-4000-8000-000000000009','Kapari',             40, 7, 0.7, 1.5, 0.3, 4)
ON CONFLICT DO NOTHING;

-- Sos (isteğe bağlı, max1; İlter: Sezar +40 premium, diğerleri +0)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-00000000000a','Sweet Chili Sos', 0, 44, 0.2,10.8, 0.0, 0),
  ('a0000000-0000-4000-8000-00000000000a','Ballı Hardal Sos',0, 81, 2.8, 3.3, 6.3, 1),
  ('a0000000-0000-4000-8000-00000000000a','Chipotle Sos',    0, 63, 0.4, 2.0, 6.1, 2),
  ('a0000000-0000-4000-8000-00000000000a','Pesto Sos',       0,137,10.4, 1.6,14.6, 3),
  ('a0000000-0000-4000-8000-00000000000a','Ranch Sos',       0, 47, 0.9, 3.5, 3.3, 4),
  ('a0000000-0000-4000-8000-00000000000a','Sezar Sos',      40,163, 0.7, 1.0,17.4, 5)
ON CONFLICT DO NOTHING;

-- Ekstra Sos (İlter gerçek fiyat: hepsi 35, Sezar 50. Chipotle/Ranch da 35 varsayıldı)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-00000000000b','Sweet Chili Sos', 35, 44, 0.2,10.8, 0.0, 0),
  ('a0000000-0000-4000-8000-00000000000b','Ballı Hardal Sos',35, 81, 2.8, 3.3, 6.3, 1),
  ('a0000000-0000-4000-8000-00000000000b','Chipotle Sos',    35, 63, 0.4, 2.0, 6.1, 2),
  ('a0000000-0000-4000-8000-00000000000b','Pesto Sos',       35,137,10.4, 1.6,14.6, 3),
  ('a0000000-0000-4000-8000-00000000000b','Ranch Sos',       35, 47, 0.9, 3.5, 3.3, 4),
  ('a0000000-0000-4000-8000-00000000000b','Sezar Sos',       50,163, 0.7, 1.0,17.4, 5)
ON CONFLICT DO NOTHING;

-- Çıtır (tek grup, opsiyonel min0 max1; İlter: Kruton +50, Taco +75)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  ('a0000000-0000-4000-8000-00000000000c','Kruton',     50, 81, 2.4,14.7, 1.3, 0),
  ('a0000000-0000-4000-8000-00000000000c','Taco Chips', 75, 99, 1.4,11.6, 5.2, 1)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 3) CHICKEN'A ÖZEL PROTEIN GRUBU  (paylaşılmaz, bowl'a özel UUID)
--    İlter: 6 item, gramaj price_adjustment ile. 150g dahil, 250g +150, 350g +250.
--    ⚠️ MAKRO: nutrition.md'de sadece 180g "Tavuk Fileto" ve "Teriyaki Tavuk
--    Sote" var. İsimler (Izgara Tavuk Bonfile / Soya Soslu) ve 150/250/350g
--    değerleri farklı → aşağıdaki makrolar 180g'den ORANSAL TÜRETİLDİ. İLTER ONAYLA.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO option_groups (id, name, description, min_selection, max_selection, is_required) VALUES
  ('b0000000-0000-4000-8000-000000000001','Tavuk Seçimi', NULL, 1, 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order) VALUES
  -- Izgara Tavuk Bonfile (≈ nutrition.md "Tavuk Fileto" 180g:207/48.2/0/1.3 → ölçekli)
  ('b0000000-0000-4000-8000-000000000001','Izgara Tavuk Bonfile 150g',   0, 173, 40.2, 0.0, 1.1, 0),  -- ⚠️ makro türetildi
  ('b0000000-0000-4000-8000-000000000001','Izgara Tavuk Bonfile 250g', 150, 288, 67.0, 0.0, 1.8, 1),  -- ⚠️
  ('b0000000-0000-4000-8000-000000000001','Izgara Tavuk Bonfile 350g', 250, 402, 93.7, 0.0, 2.5, 2),  -- ⚠️
  -- Soya Soslu Tavuk Sote (≈ nutrition.md "Teriyaki Tavuk Sote" 180g:342/30.6/16.2/16.2 → ölçekli)
  ('b0000000-0000-4000-8000-000000000001','Soya Soslu Tavuk Sote 150g',  0, 285, 25.5,13.5,13.5, 3),  -- ⚠️
  ('b0000000-0000-4000-8000-000000000001','Soya Soslu Tavuk Sote 250g',150, 475, 42.5,22.5,22.5, 4),  -- ⚠️
  ('b0000000-0000-4000-8000-000000000001','Soya Soslu Tavuk Sote 350g',250, 665, 59.5,31.5,31.5, 5)   -- ⚠️
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 4) ÜRÜN: Tera Chicken Bowl  +  5) JUNCTION (grupları sıraya bağla)
--    id serial (RETURNING ile yakalanır). adisyo_* başta NULL (Adisyo sonra).
--    product.calories=745 => KART başlığı (ortalama). Detayda canlı toplanır.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_pid bigint;
BEGIN
  -- Zaten varsa tekrar ekleme
  SELECT id INTO v_pid FROM products WHERE name = 'Tera Chicken Bowl' LIMIT 1;
  IF v_pid IS NULL THEN
    INSERT INTO products (
      name, "desc", category, price,
      calories, cal, protein, carbs, fats,
      type, is_available, in_stock, "order",
      is_bundle, is_crosssell, allow_immediate, allow_scheduled,
      gramaj_options, adisyo_product_code, adisyo_product_unit_id
    ) VALUES (
      'Tera Chicken Bowl', 'Tavuk · kendi bowl''unu kur', 'Tera Bowl', 515,
      745, 745, 57, 70.1, 27.4,
      'meal', true, true, 10,
      true, false, true, true,
      '[]'::jsonb, NULL, NULL
    )
    RETURNING id INTO v_pid;
  END IF;

  -- Junction (13 grup): Baz → Protein → Garnitür → Ekstra Garnitür → Sebze →
  -- Ekstra Sebze → Meze → Ekstra Meze → Turşu → Ekstra Turşu → Sos → Ekstra Sos
  -- → Çıtır
  INSERT INTO product_option_groups (product_id, group_id, sort_order) VALUES
    (v_pid,'a0000000-0000-4000-8000-000000000001', 0),  -- Baz
    (v_pid,'b0000000-0000-4000-8000-000000000001', 1),  -- Tavuk Seçimi (chicken)
    (v_pid,'a0000000-0000-4000-8000-000000000002', 2),  -- Garnitür
    (v_pid,'a0000000-0000-4000-8000-000000000003', 3),  -- Ekstra Garnitür
    (v_pid,'a0000000-0000-4000-8000-000000000004', 4),  -- Sebze
    (v_pid,'a0000000-0000-4000-8000-000000000005', 5),  -- Ekstra Sebze
    (v_pid,'a0000000-0000-4000-8000-000000000006', 6),  -- Meze
    (v_pid,'a0000000-0000-4000-8000-000000000007', 7),  -- Ekstra Meze
    (v_pid,'a0000000-0000-4000-8000-000000000008', 8),  -- Turşu
    (v_pid,'a0000000-0000-4000-8000-000000000009', 9),  -- Ekstra Turşu
    (v_pid,'a0000000-0000-4000-8000-00000000000a',10),  -- Sos
    (v_pid,'a0000000-0000-4000-8000-00000000000b',11),  -- Ekstra Sos
    (v_pid,'a0000000-0000-4000-8000-00000000000c',12)   -- Çıtır (13 grup)
  ON CONFLICT (product_id, group_id) DO NOTHING;

  RAISE NOTICE 'Tera Chicken Bowl product_id = %', v_pid;
END $$;

-- PostgREST şema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- DURUM (rev 2 — İlter'in 3 kararı uygulandı)
-- ============================================================================
-- [✓] min/max: Baz + Protein ZORUNLU; Garnitür/Sebze/Meze/Turşu/Sos isteğe bağlı.
-- [✓] Ekstra fiyatlar: HEPSİ İlter gerçek fiyatı. Ekstra Garnitür 50, Ekstra Sebze
--     40/60, Çıtır 50/75, Ekstra Meze 50/Guac 60, Ekstra Turşu 40, Ekstra Sos 35/
--     Sezar 50. (CANLI düzeltme: supabase/fix_extra_prices.sql)
-- [✓] Çıtır TEK grup (min0 max1). Ekstra Çıtır + Ekstra Baz + Ekstra Protein
--     kaldırıldı. Toplam 13 grup.
--
-- HÂLÂ AÇIK (test öncesi/sonrası netleşecek, ENGEL DEĞİL):
-- [A] PROTEIN MAKROLARI: 150/250/350g 180g nutrition.md'den ORANSAL türetildi;
--     isimler (Izgara Tavuk Bonfile/Soya Soslu) nutrition.md ile birebir değil.
--     Gerçek tartım değerleri gelince güncellenecek.
-- [B] Ekstra fiyatlar Getir (komisyon brüt) — İlter sonra netleştirecek.
-- [C] Kategori emoji 🥙 + image_url=NULL — görsel yüklenince set.
-- [D] is_bundle=true sepet "slot" UI — mobilde test edilecek.
-- ============================================================================
