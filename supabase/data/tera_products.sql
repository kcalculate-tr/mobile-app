-- ============================================================================
-- TERA BOWL & WRAP — 8 ürün + kategoriler + pilot taşıma (GUARD'LI / idempotent)
-- ============================================================================
-- Bu dosya TEKRAR çalıştırılabilir: tüm insert'ler WHERE NOT EXISTS / ON CONFLICT.
-- DEPLOY EDİLMEDİ — İlter Supabase SQL Editor'da çalıştıracak.
--
-- ÖNCE pilot (supabase/pilot_tera_chicken_bowl.sql) + temizlik çalıştırılmış olmalı:
--   paylaşımlı gruplar a0000000-...-0001..000c CANLIDA (Baz/Garnitür/Sebze/Meze/
--   Turşu/Sos/Çıtır + Ekstra'lar). Bu dosya onları YENİDEN KURMAZ, junction'lar.
--
-- KAPSAM: bu dosya SADECE Tera (Bowl's + Wrap's). Breaking Fast AYRI dosyada.
-- Kategoriler bölümü TÜM markaları açar (BF leaf'leri dahil) — ürünler sonra.
--
-- ⚠️ AÇIK NOKTALAR dosya sonundaki NOTLAR'da (fiyat çelişkileri, türetilen makro).
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 0) YENİ PAYLAŞIMLI GRUP UUID'LERİ (registry'ye ek)
--    Lavaş (wrap'lere özel, paylaşımlı)  a0000000-0000-4000-8000-000000000010
--    Protein grupları (bowl↔wrap paylaşır, proteine göre):
--      Tavuk Seçimi   b0000000-...-0001  (pilot'tan VAR — Chicken Bowl + Chicken Wrap)
--      Köfte Seçimi   b0000000-...-0002  (Meatball Bowl)
--      Falafel Seçimi b0000000-...-0003  (Veggie Bowl + Veggie Wrap)
--      Ton Seçimi     b0000000-...-0004  (Tuna Bowl + Tuna Wrap)
--      Dana Fajita    b0000000-...-0005  (Fajitas Wrap)
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1) KATEGORİLER (3 seviye: Tüm Ürünler 17 → marka → leaf). GUARD: WHERE NOT EXISTS
--    Apostrof ASCII: 'Bowl''s' / 'Wrap''s'. products.category bu string'lerle eşleşir.
--    (xlsx curly ’ kullanıyor; biz ASCII tutuyoruz — UI text-match tutarlı olsun.)
-- ════════════════════════════════════════════════════════════════════════════

-- 'Tera Bowl' markası pilot'ta zaten açıldı (parent 17, order 60) — guard atlar.
INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Tera Bowl','🥙',60,17,NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Tera Bowl');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Breaking Fast','🥪',70,17,NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Breaking Fast');

-- Leaf'ler (parent = marka id, subquery ile)
INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Bowl''s', NULL, 61, (SELECT id FROM categories WHERE name='Tera Bowl' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Bowl''s');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Wrap''s', NULL, 62, (SELECT id FROM categories WHERE name='Tera Bowl' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Wrap''s');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Focaccia Ekmeği', NULL, 71, (SELECT id FROM categories WHERE name='Breaking Fast' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Focaccia Ekmeği');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Ciabatta Ekmeği', NULL, 72, (SELECT id FROM categories WHERE name='Breaking Fast' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Ciabatta Ekmeği');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Ekşi Maya Ekmeği', NULL, 73, (SELECT id FROM categories WHERE name='Breaking Fast' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Ekşi Maya Ekmeği');

INSERT INTO categories (name, emoji, "order", parent_id, image_url)
SELECT 'Omlette Box', NULL, 74, (SELECT id FROM categories WHERE name='Breaking Fast' LIMIT 1), NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Omlette Box');


-- ════════════════════════════════════════════════════════════════════════════
-- 2) PİLOT TAŞIMA: Chicken Bowl (id=52) "Tera Bowl" → "Bowl's"
--    Junction'lar product_id'ye bağlı → category değişimi onları ETKİLEMEZ.
--    + Detoks grubunu (ed6770f8) Chicken Bowl'a EKLE (sort_order 13).
-- ════════════════════════════════════════════════════════════════════════════
UPDATE products SET category='Bowl''s' WHERE id=52 AND name='Tera Chicken Bowl';

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT 52, 'ed6770f8-e736-4128-98ae-6d42fca61b6b', 13
WHERE EXISTS (SELECT 1 FROM products WHERE id=52)
ON CONFLICT (product_id, group_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- 3) YENİ GRUPLAR: Lavaş (wrap paylaşımlı) + 4 protein grubu
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO option_groups (id, name, description, min_selection, max_selection, is_required) VALUES
  ('a0000000-0000-4000-8000-000000000010','Lavaş Seçimi',   NULL, 1, 1, true),   -- wrap ZORUNLU baz yerine
  ('b0000000-0000-4000-8000-000000000002','Köfte Seçimi',   NULL, 1, 1, true),
  ('b0000000-0000-4000-8000-000000000003','Falafel Seçimi', NULL, 1, 1, true),
  ('b0000000-0000-4000-8000-000000000004','Ton Balığı Seçimi', NULL, 1, 1, true),
  ('b0000000-0000-4000-8000-000000000005','Dana Fajita Seçimi', NULL, 1, 1, true)
ON CONFLICT (id) DO NOTHING;

-- ── ITEM'LAR (GUARD: VALUES + WHERE NOT EXISTS on group_id+name) ──────────────
-- Lavaş (İlter: Klasik dahil, Tam Buğday/Ekşi Hamur +25). ⚠️ MAKRO nutrition.md'de
-- YOK → tahmini (~90g lavaş). İLTER ONAYLA.
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.group_id, v.name, v.price_adjustment, v.calories, v.protein, v.carbs, v.fats, v.sort_order
FROM (VALUES
  ('a0000000-0000-4000-8000-000000000010'::uuid,'Klasik Lavaş',     0::numeric, 250::numeric, 8::numeric, 49::numeric, 2::numeric, 0),  -- ⚠️ makro tahmini
  ('a0000000-0000-4000-8000-000000000010'::uuid,'Tam Buğday Lavaş',25::numeric, 240::numeric, 9::numeric, 45::numeric, 2.5::numeric, 1),-- ⚠️
  ('a0000000-0000-4000-8000-000000000010'::uuid,'Ekşi Hamur Lavaş',25::numeric, 245::numeric, 8::numeric, 48::numeric, 2::numeric, 2)   -- ⚠️
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- Köfte Seçimi (nutrition.md Izgara Köfte 180g:301/25.6/7.7/18.2 → ölçekli)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('b0000000-0000-4000-8000-000000000002'::uuid,'Izgara Köfte 120g',  0::numeric, 201::numeric, 17.1::numeric, 5.1::numeric, 12.1::numeric, 0),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'Izgara Köfte 180g',150::numeric, 301::numeric, 25.6::numeric, 7.7::numeric, 18.2::numeric, 1),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'Izgara Köfte 240g',250::numeric, 401::numeric, 34.1::numeric,10.3::numeric, 24.3::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- Falafel Seçimi (nutrition.md Falafel 180g:531/23.9/20.5/47.3 → ölçekli)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('b0000000-0000-4000-8000-000000000003'::uuid,'Falafel 200g',  0::numeric, 590::numeric, 26.6::numeric, 22.8::numeric, 52.6::numeric, 0),
  ('b0000000-0000-4000-8000-000000000003'::uuid,'Falafel 250g',100::numeric, 738::numeric, 33.2::numeric, 28.5::numeric, 65.7::numeric, 1),
  ('b0000000-0000-4000-8000-000000000003'::uuid,'Falafel 300g',150::numeric, 885::numeric, 39.8::numeric, 34.2::numeric, 78.8::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- Ton Balığı Seçimi (nutrition.md Ton 180g:171/38.5/0/0.4 → ölçekli)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('b0000000-0000-4000-8000-000000000004'::uuid,'Ton Balığı 160g',  0::numeric, 152::numeric, 34.2::numeric, 0::numeric, 0.4::numeric, 0),
  ('b0000000-0000-4000-8000-000000000004'::uuid,'Ton Balığı 240g',150::numeric, 228::numeric, 51.3::numeric, 0::numeric, 0.5::numeric, 1),
  ('b0000000-0000-4000-8000-000000000004'::uuid,'Ton Balığı 320g',250::numeric, 304::numeric, 68.4::numeric, 0::numeric, 0.7::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- Dana Fajita Seçimi (nutrition.md Dana Fajita 180g:270/28.8/7.2/14.4 → ölçekli) ⚠️ gramaj türetildi
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('b0000000-0000-4000-8000-000000000005'::uuid,'Dana Fajita 150g',  0::numeric, 225::numeric, 24::numeric, 6::numeric, 12::numeric, 0),
  ('b0000000-0000-4000-8000-000000000005'::uuid,'Dana Fajita 250g',150::numeric, 375::numeric, 40::numeric,10::numeric, 20::numeric, 1),
  ('b0000000-0000-4000-8000-000000000005'::uuid,'Dana Fajita 350g',250::numeric, 525::numeric, 56::numeric,14::numeric, 28::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);


-- ════════════════════════════════════════════════════════════════════════════
-- 4) ÜRÜNLER + JUNCTION (GUARD: product WHERE NOT EXISTS, junction ON CONFLICT)
--    is_bundle=true, gramaj_options=[], adisyo_* NULL.
--    BOWL grup sırası: Baz→Protein→Garnitür→EkstraGar→Sebze→EkstraSeb→Meze→
--      EkstraMeze→Turşu→EkstraTur→Sos→EkstraSos→Çıtır→Detox  (14 grup)
--    WRAP grup sırası: Lavaş→Protein→...(aynı)...→Çıtır→Detox  (14 grup, Baz yok)
-- ════════════════════════════════════════════════════════════════════════════

-- ── helper kısaltma: paylaşımlı a0 grupları junction VALUES'ta tekrarlanır ──

-- ---- TERA MEATBALL BOWL (price 499, makro 771/43.1/69.7/36.9) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Meatball Bowl','Izgara köfte · kendi bowl''unu kur','Bowl''s',515,771,771,43.1,69.7,36.9,'meal',true,true,20,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Meatball Bowl');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Meatball Bowl') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000001',0),('b0000000-0000-4000-8000-000000000002',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA VEGGIE BOWL (price 379, makro 1001/41.5/82.5/66) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Veggie Bowl','Falafel · kendi bowl''unu kur','Bowl''s',515,1001,1001,41.5,82.5,66,'meal',true,true,30,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Veggie Bowl');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Veggie Bowl') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000001',0),('b0000000-0000-4000-8000-000000000003',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA TUNA BOWL (price 399, makro 641/56.1/62/19.1) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Tuna Bowl','Ton balığı · kendi bowl''unu kur','Bowl''s',515,641,641,56.1,62,19.1,'meal',true,true,40,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Tuna Bowl');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Tuna Bowl') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000001',0),('b0000000-0000-4000-8000-000000000004',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA CHICKEN WRAP (price ⚠️359, makro 744/55.8/65.8/28.4) — Lavaş + Tavuk(b..0001) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Chicken Wrap','Tavuk · kendi wrap''ını kur','Wrap''s',515,744,744,55.8,65.8,28.4,'meal',true,true,50,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Chicken Wrap');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Chicken Wrap') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000010',0),('b0000000-0000-4000-8000-000000000001',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA FAJITAS WRAP (price ⚠️499, makro 739/45.2/64.9/34.1) — Lavaş + Dana Fajita(b..0005) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Fajitas Wrap','Dana fajita · kendi wrap''ını kur','Wrap''s',515,739,739,45.2,64.9,34.1,'meal',true,true,60,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Fajitas Wrap');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Fajitas Wrap') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000010',0),('b0000000-0000-4000-8000-000000000005',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA TUNA WRAP (price ⚠️379, makro 640/54.9/57.7/20) — Lavaş + Ton(b..0004) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Tuna Wrap','Ton balığı · kendi wrap''ını kur','Wrap''s',515,640,640,54.9,57.7,20,'meal',true,true,70,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Tuna Wrap');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Tuna Wrap') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000010',0),('b0000000-0000-4000-8000-000000000004',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

-- ---- TERA VEGGIE WRAP (price ⚠️349, makro 1000/40.3/78.2/67) — Lavaş + Falafel(b..0003) ----
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Tera Veggie Wrap','Falafel · kendi wrap''ını kur','Wrap''s',515,1000,1000,40.3,78.2,67,'meal',true,true,80,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Tera Veggie Wrap');

INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Tera Veggie Wrap') p
CROSS JOIN (VALUES
  ('a0000000-0000-4000-8000-000000000010',0),('b0000000-0000-4000-8000-000000000003',1),
  ('a0000000-0000-4000-8000-000000000002',2),('a0000000-0000-4000-8000-000000000003',3),
  ('a0000000-0000-4000-8000-000000000004',4),('a0000000-0000-4000-8000-000000000005',5),
  ('a0000000-0000-4000-8000-000000000006',6),('a0000000-0000-4000-8000-000000000007',7),
  ('a0000000-0000-4000-8000-000000000008',8),('a0000000-0000-4000-8000-000000000009',9),
  ('a0000000-0000-4000-8000-00000000000a',10),('a0000000-0000-4000-8000-00000000000b',11),
  ('a0000000-0000-4000-8000-00000000000c',12),('ed6770f8-e736-4128-98ae-6d42fca61b6b',13)
) AS g(gid,so)
ON CONFLICT (product_id, group_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA (çalıştırdıktan sonra)
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT name, category, price, is_bundle FROM products WHERE category IN ('Bowl''s','Wrap''s') ORDER BY "order";
--   -> 4 Bowl's (Chicken/Meatball/Veggie/Tuna) + 4 Wrap's = 8 satır
-- SELECT p.name, count(*) FROM products p JOIN product_option_groups j ON j.product_id=p.id
--   WHERE p.category IN ('Bowl''s','Wrap''s') GROUP BY p.name;  -> her biri 14 grup
-- SELECT g.name, count(*) FROM option_items i JOIN option_groups g ON g.id=i.group_id
--   WHERE g.id::text LIKE 'b0000000%' OR g.id='a0000000-0000-4000-8000-000000000010'
--   GROUP BY g.name;  -> Lavaş 3, Köfte 3, Falafel 3, Ton 3, Dana Fajita 3 (Tavuk pilot'tan 6)

-- ============================================================================
-- ⚠️ AÇIK NOTLAR (İlter netleştirecek)
-- ============================================================================
-- [1] FİYAT: İlter kararı = TÜM Tera ürünleri 515₺ (Chicken pilot'ta zaten 515).
--     Menü xlsx (Meatball 499/Veggie 379/Tuna 399) GEÇERSİZ — 515 standardı.
-- [2] (kapandı — wrap fiyatları da 515.)
-- [3] LAVAŞ MAKRO: nutrition.md'de yok → tahmini (~250 kcal). Gerçek değer gelince.
-- [4] DANA FAJITA gramaj (150/250/350) türetildi; menü "150g sabit" diyor — ekstra
--     gramajlar opsiyonel eklendi. Onayla.
-- [5] PROTEIN PAYLAŞIMI: Chicken/Tuna/Veggie Wrap, bowl'un protein grubunu PAYLAŞIR
--     (aynı gramaj). Veggie Wrap böylece 200g falafel sunar (menü wrap 150g diyor) —
--     kabul edilebilir sapma. İstenirse wrap'e özel grup açılır.
-- [6] WRAP Garnitür: paylaşımlı grup max2 (bowl ile ortak). Menü wrap "1 garnitür"
--     diyor ama isteğe bağlı (min0) olduğu için sorun değil.
-- [7] Menü ekstra fiyatları (Beluga +15, Humus +15, ekstra sos +30 vb.) CANLI
--     paylaşımlı gruplardakinden FARKLI. Bu dosya canlı grup fiyatlarına dokunmadı
--     (pilot kararı: ekstra fiyatlar sonra netleşecek).
-- ============================================================================
