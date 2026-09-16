-- ============================================================================
-- BREAKING FAST — 15 ürün (3 ekmek × 5 protein) + paylaşımlı gruplar (GUARD'LI)
-- ============================================================================
-- TEKRAR çalıştırılabilir: WHERE NOT EXISTS / ON CONFLICT. DEPLOY EDİLMEDİ.
-- Kategoriler (Focaccia/Ciabatta/Ekşi Maya Ekmeği, parent=Breaking Fast 19)
-- ZATEN tera_products.sql ile açıldı. Omlette Box AYRI dosya (sonraki adım).
--
-- BF GRUP REGISTRY (c0... prefix, bowl/wrap'tan AYRI):
--   Ekmek Focaccia      c0000000-...-0001   (paylaşımlı, ekmek başına)
--   Ekmek Ciabatta      c0000000-...-0002
--   Ekmek Ekşi Maya     c0000000-...-0003
--   Peynir              c0000000-...-0010
--   Ekstra Peynir       c0000000-...-0011
--   Yeşillik            c0000000-...-0012
--   Ekstra Yeşillik     c0000000-...-0013
--   Garnitür & Turşu    c0000000-...-0014
--   Sos & Ezme          c0000000-...-0015
--   Ekstra Sos & Ezme   c0000000-...-0016
--   Protein (ürüne özel, ekmekler arası PAYLAŞIMLI):
--   Hindi Füme          c0000000-...-0020
--   Dana Jambon         c0000000-...-0021
--   Füme Kaburga        c0000000-...-0022
--   Karabiberli Salam   c0000000-...-0023
--
-- ⚠️ EKMEK GRUBU: İlter'in 9-grup spec'inde yoktu. is_bundle=true canlı makroyu
--    SADECE seçili option'lardan toplar; ekmek option olmadığı için makrosu (~300
--    kcal) toplama girmezdi → kartla uçurum. Çözüm: tek-item zorunlu "Ekmek"
--    grubu (sort 0). Böylece 10 grup/ürün (Veggie 9). İLTER ONAYLA.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) GRUPLAR
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO option_groups (id, name, description, min_selection, max_selection, is_required) VALUES
  ('c0000000-0000-4000-8000-000000000001','Ekmek',            NULL, 1, 1, true),   -- Focaccia (tek item)
  ('c0000000-0000-4000-8000-000000000002','Ekmek',            NULL, 1, 1, true),   -- Ciabatta
  ('c0000000-0000-4000-8000-000000000003','Ekmek',            NULL, 1, 1, true),   -- Ekşi Maya
  ('c0000000-0000-4000-8000-000000000010','Peynir',           NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000011','Ekstra Peynir',    NULL, 0, 4, false),
  ('c0000000-0000-4000-8000-000000000012','Yeşillik',         NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000013','Ekstra Yeşillik',  NULL, 0, 4, false),
  ('c0000000-0000-4000-8000-000000000014','Garnitür & Turşu', NULL, 0, 3, false),
  ('c0000000-0000-4000-8000-000000000015','Sos & Ezme',       NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000016','Ekstra Sos & Ezme',NULL, 0, 6, false),
  ('c0000000-0000-4000-8000-000000000020','Hindi Füme Seçimi',           NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000021','Dana Jambon Seçimi',          NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000022','Füme Kaburga Seçimi',         NULL, 1, 1, true),
  ('c0000000-0000-4000-8000-000000000023','Karabiberli İtalyan Salam Seçimi', NULL, 1, 1, true)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 2) ITEM'LAR (GUARD: VALUES + WHERE NOT EXISTS on group_id+name)
--    Makro: breaking-fast-nutrition.md porsiyon değerleri. Fiyat: İlter.
-- ════════════════════════════════════════════════════════════════════════════

-- EKMEK item'ları (tek item, +0, ekmek makrosu — canlı toplama girsin)
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000001'::uuid,'Focaccia Ekmeği', 0::numeric, 299::numeric, 10.8::numeric, 43.2::numeric, 9.6::numeric, 0),
  ('c0000000-0000-4000-8000-000000000002'::uuid,'Ciabatta Ekmeği', 0::numeric, 325::numeric, 10.8::numeric, 62.4::numeric, 3.6::numeric, 0),
  ('c0000000-0000-4000-8000-000000000003'::uuid,'Ekşi Maya Ekmeği',0::numeric, 294::numeric, 10.2::numeric, 56.4::numeric, 1.8::numeric, 0)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- PEYNIR (dahil): Labne/Cheddar/Mozarella 0, Eski Kaşar +75
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000010'::uuid,'Labne Peyniri',  0::numeric,  80::numeric, 2::numeric,   2.2::numeric, 7.2::numeric, 0),
  ('c0000000-0000-4000-8000-000000000010'::uuid,'Cheddar Peyniri',0::numeric, 162::numeric, 9.9::numeric, 0.5::numeric, 13.6::numeric, 1),
  ('c0000000-0000-4000-8000-000000000010'::uuid,'Mozarella',      0::numeric, 120::numeric, 7.6::numeric, 0.9::numeric, 8.9::numeric, 2),
  ('c0000000-0000-4000-8000-000000000010'::uuid,'Eski Kaşar',    75::numeric, 162::numeric, 11.2::numeric,0.6::numeric, 14::numeric, 3)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- EKSTRA PEYNIR: Labne/Cheddar/Mozarella +75, Eski Kaşar +100
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000011'::uuid,'Labne Peyniri',  75::numeric,  80::numeric, 2::numeric,   2.2::numeric, 7.2::numeric, 0),
  ('c0000000-0000-4000-8000-000000000011'::uuid,'Cheddar Peyniri',75::numeric, 162::numeric, 9.9::numeric, 0.5::numeric, 13.6::numeric, 1),
  ('c0000000-0000-4000-8000-000000000011'::uuid,'Mozarella',      75::numeric, 120::numeric, 7.6::numeric, 0.9::numeric, 8.9::numeric, 2),
  ('c0000000-0000-4000-8000-000000000011'::uuid,'Eski Kaşar',    100::numeric, 162::numeric, 11.2::numeric,0.6::numeric, 14::numeric, 3)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- YEŞILLIK (dahil): hepsi 0
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000012'::uuid,'Lolorosso',0::numeric, 3::numeric, 0.2::numeric, 0.3::numeric, 0::numeric, 0),
  ('c0000000-0000-4000-8000-000000000012'::uuid,'Roka',     0::numeric, 5::numeric, 0.5::numeric, 0.7::numeric, 0.1::numeric, 1),
  ('c0000000-0000-4000-8000-000000000012'::uuid,'Maskolin', 0::numeric, 4::numeric, 0.4::numeric, 0.8::numeric, 0::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- EKSTRA YEŞILLIK: hepsi +50
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000013'::uuid,'Lolorosso',50::numeric, 3::numeric, 0.2::numeric, 0.3::numeric, 0::numeric, 0),
  ('c0000000-0000-4000-8000-000000000013'::uuid,'Roka',     50::numeric, 5::numeric, 0.5::numeric, 0.7::numeric, 0.1::numeric, 1),
  ('c0000000-0000-4000-8000-000000000013'::uuid,'Maskolin', 50::numeric, 4::numeric, 0.4::numeric, 0.8::numeric, 0::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- GARNITÜR & TURŞU (min0 max3): hepsi 0. ⚠️ Salatalık makrosu BF nutrition.md'de yok → tahmini.
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000014'::uuid,'Domates',           0::numeric, 4::numeric, 0.2::numeric, 0.8::numeric, 0::numeric, 0),
  ('c0000000-0000-4000-8000-000000000014'::uuid,'Salatalık',         0::numeric, 2::numeric, 0.1::numeric, 0.4::numeric, 0::numeric, 1),  -- ⚠️ makro tahmini
  ('c0000000-0000-4000-8000-000000000014'::uuid,'Beyaz Turp Turşusu',0::numeric, 3::numeric, 0.2::numeric, 0.6::numeric, 0::numeric, 2),
  ('c0000000-0000-4000-8000-000000000014'::uuid,'Kapari',            0::numeric, 5::numeric, 0.5::numeric, 1::numeric,   0.2::numeric, 3),
  ('c0000000-0000-4000-8000-000000000014'::uuid,'Jalapeno',          0::numeric, 6::numeric, 0.2::numeric, 1::numeric,   0.1::numeric, 4)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- SOS & EZME (dahil): Guacamole +50, diğerleri 0
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Pesto Sos',       0::numeric, 114::numeric, 8.7::numeric, 1.4::numeric, 12.2::numeric, 0),
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Ballı Hardal Sos',0::numeric,  67::numeric, 2.3::numeric, 2.8::numeric, 5.3::numeric, 1),
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Vişne Reçeli',    0::numeric,  69::numeric, 0.1::numeric, 16.8::numeric,0::numeric, 2),
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Sweet Chili Sos', 0::numeric,  37::numeric, 0.1::numeric, 9::numeric,   0::numeric, 3),
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Ranch Sos',       0::numeric,  40::numeric, 0.8::numeric, 2.9::numeric, 2.8::numeric, 4),
  ('c0000000-0000-4000-8000-000000000015'::uuid,'Guacamole Sos',  50::numeric,  40::numeric, 0.5::numeric, 2.3::numeric, 3.8::numeric, 5)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- EKSTRA SOS & EZME (min0): hepsi +50, Guacamole +100
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Pesto Sos',        50::numeric, 114::numeric, 8.7::numeric, 1.4::numeric, 12.2::numeric, 0),
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Ballı Hardal Sos', 50::numeric,  67::numeric, 2.3::numeric, 2.8::numeric, 5.3::numeric, 1),
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Vişne Reçeli',     50::numeric,  69::numeric, 0.1::numeric, 16.8::numeric,0::numeric, 2),
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Sweet Chili Sos',  50::numeric,  37::numeric, 0.1::numeric, 9::numeric,   0::numeric, 3),
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Ranch Sos',        50::numeric,  40::numeric, 0.8::numeric, 2.9::numeric, 2.8::numeric, 4),
  ('c0000000-0000-4000-8000-000000000016'::uuid,'Guacamole Sos',   100::numeric,  40::numeric, 0.5::numeric, 2.3::numeric, 3.8::numeric, 5)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);

-- PROTEIN gramajları (nutrition.md 80g baz → ölçekli). Hindi 50/80/100=0/+125/+200;
-- Dana/Kaburga/Salam 50/80/100=0/+175/+250.
INSERT INTO option_items (group_id, name, price_adjustment, calories, protein, carbs, fats, sort_order)
SELECT v.* FROM (VALUES
  -- Hindi Füme (80g:80/14.8/1.2/1.4)
  ('c0000000-0000-4000-8000-000000000020'::uuid,'Hindi Füme 50g',   0::numeric,  50::numeric, 9.3::numeric,  0.8::numeric, 0.9::numeric, 0),
  ('c0000000-0000-4000-8000-000000000020'::uuid,'Hindi Füme 80g', 125::numeric,  80::numeric, 14.8::numeric, 1.2::numeric, 1.4::numeric, 1),
  ('c0000000-0000-4000-8000-000000000020'::uuid,'Hindi Füme 100g',200::numeric, 100::numeric, 18.5::numeric, 1.5::numeric, 1.8::numeric, 2),
  -- Dana Jambon (80g:76/13.6/1.2/2)
  ('c0000000-0000-4000-8000-000000000021'::uuid,'Dana Jambon 50g',   0::numeric,  48::numeric, 8.5::numeric, 0.8::numeric, 1.3::numeric, 0),
  ('c0000000-0000-4000-8000-000000000021'::uuid,'Dana Jambon 80g', 175::numeric,  76::numeric, 13.6::numeric,1.2::numeric, 2::numeric, 1),
  ('c0000000-0000-4000-8000-000000000021'::uuid,'Dana Jambon 100g',250::numeric,  95::numeric, 17::numeric,  1.5::numeric, 2.5::numeric, 2),
  -- Füme Kaburga (80g:120/20/0.8/4)
  ('c0000000-0000-4000-8000-000000000022'::uuid,'Füme Kaburga 50g',   0::numeric,  75::numeric, 12.5::numeric,0.5::numeric, 2.5::numeric, 0),
  ('c0000000-0000-4000-8000-000000000022'::uuid,'Füme Kaburga 80g', 175::numeric, 120::numeric, 20::numeric,  0.8::numeric, 4::numeric, 1),
  ('c0000000-0000-4000-8000-000000000022'::uuid,'Füme Kaburga 100g',250::numeric, 150::numeric, 25::numeric,  1::numeric,   5::numeric, 2),
  -- Karabiberli İtalyan Salam (80g:269/16/1.6/22.4)
  ('c0000000-0000-4000-8000-000000000023'::uuid,'Karabiberli İtalyan Salam 50g',   0::numeric, 168::numeric, 10::numeric, 1::numeric,   14::numeric, 0),
  ('c0000000-0000-4000-8000-000000000023'::uuid,'Karabiberli İtalyan Salam 80g', 175::numeric, 269::numeric, 16::numeric, 1.6::numeric, 22.4::numeric, 1),
  ('c0000000-0000-4000-8000-000000000023'::uuid,'Karabiberli İtalyan Salam 100g',250::numeric, 336::numeric, 20::numeric, 2::numeric,   28::numeric, 2)
) AS v(group_id,name,price_adjustment,calories,protein,carbs,fats,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM option_items oi WHERE oi.group_id=v.group_id AND oi.name=v.name);


-- ════════════════════════════════════════════════════════════════════════════
-- 3) 15 ÜRÜN + JUNCTION
--    NON-VEGGIE sıra (10 grup): Ekmek→Peynir→EkstraP→Yeşillik→EkstraY→
--      Garnitür&Turşu→Protein→Sos&Ezme→EkstraS&E→Detoks
--    VEGGIE sıra (9 grup): protein YOK.
--    is_bundle=true, price=515 (geçici), gramaj_options=[], adisyo NULL.
-- ════════════════════════════════════════════════════════════════════════════

-- Junction VALUES'ları kısaltmak için ortak paylaşımlı kuyruk (Peynir..Detoks)
-- her üründe tekrarlanır; sadece ekmek(0) ve protein(6) değişir.

-- ░░░░░ FOCACCIA (kategori 'Focaccia Ekmeği', ekmek c0..0001) ░░░░░
-- Hindi Füme Focaccia
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Hindi Füme Focaccia','Hindi füme · kendi sandviçini kur','Focaccia Ekmeği',515,584,584,36.3,53.5,26.2,'meal',true,true,90,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Hindi Füme Focaccia');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Hindi Füme Focaccia') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000001',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000020',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Dana Jambon Focaccia
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Dana Jambon Focaccia','Dana jambon · kendi sandviçini kur','Focaccia Ekmeği',515,580,580,35.1,53.5,26.7,'meal',true,true,91,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Dana Jambon Focaccia');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Dana Jambon Focaccia') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000001',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000021',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Füme Kaburga Focaccia
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Füme Kaburga Focaccia','Füme kaburga · kendi sandviçini kur','Focaccia Ekmeği',515,624,624,41.5,53.1,28.7,'meal',true,true,92,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Füme Kaburga Focaccia');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Füme Kaburga Focaccia') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000001',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000022',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Karabiberli İtalyan Salam Focaccia
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Karabiberli İtalyan Salam Focaccia','Karabiberli italyan salam · kendi sandviçini kur','Focaccia Ekmeği',515,772,772,37.5,53.9,47.1,'meal',true,true,93,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Karabiberli İtalyan Salam Focaccia');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Karabiberli İtalyan Salam Focaccia') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000001',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000023',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Veggie Focaccia (PROTEIN YOK → 9 grup)
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Veggie Focaccia','Guacamole & labne bazlı · kendi sandviçini kur','Focaccia Ekmeği',515,504,504,21.5,52.3,24.7,'meal',true,true,94,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Veggie Focaccia');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Veggie Focaccia') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000001',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000015',6),('c0000000-0000-4000-8000-000000000016',7),
  ('ed6770f8-e736-4128-98ae-6d42fca61b6b',8)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- ░░░░░ CIABATTA (kategori 'Ciabatta Ekmeği', ekmek c0..0002) ░░░░░
-- Hindi Füme Ciabatta
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Hindi Füme Ciabatta','Hindi füme · kendi sandviçini kur','Ciabatta Ekmeği',515,610,610,36.3,72.7,20.2,'meal',true,true,95,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Hindi Füme Ciabatta');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Hindi Füme Ciabatta') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000002',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000020',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Dana Jambon Ciabatta
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Dana Jambon Ciabatta','Dana jambon · kendi sandviçini kur','Ciabatta Ekmeği',515,606,606,35.1,72.7,20.7,'meal',true,true,96,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Dana Jambon Ciabatta');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Dana Jambon Ciabatta') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000002',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000021',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Füme Kaburga Ciabatta
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Füme Kaburga Ciabatta','Füme kaburga · kendi sandviçini kur','Ciabatta Ekmeği',515,650,650,41.5,72.3,22.7,'meal',true,true,97,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Füme Kaburga Ciabatta');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Füme Kaburga Ciabatta') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000002',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000022',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Karabiberli İtalyan Salam Ciabatta
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Karabiberli İtalyan Salam Ciabatta','Karabiberli italyan salam · kendi sandviçini kur','Ciabatta Ekmeği',515,799,799,37.5,73.1,41.1,'meal',true,true,98,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Karabiberli İtalyan Salam Ciabatta');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Karabiberli İtalyan Salam Ciabatta') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000002',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000023',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Veggie Ciabatta (9 grup)
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Veggie Ciabatta','Guacamole & labne bazlı · kendi sandviçini kur','Ciabatta Ekmeği',515,530,530,21.5,71.5,18.7,'meal',true,true,99,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Veggie Ciabatta');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Veggie Ciabatta') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000002',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000015',6),('c0000000-0000-4000-8000-000000000016',7),
  ('ed6770f8-e736-4128-98ae-6d42fca61b6b',8)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- ░░░░░ EKŞİ MAYA (kategori 'Ekşi Maya Ekmeği', ekmek c0..0003) ░░░░░
-- Hindi Füme Ekşi Maya
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Hindi Füme Ekşi Maya','Hindi füme · kendi sandviçini kur','Ekşi Maya Ekmeği',515,579,579,35.7,66.7,18.4,'meal',true,true,100,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Hindi Füme Ekşi Maya');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Hindi Füme Ekşi Maya') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000003',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000020',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Dana Jambon Ekşi Maya
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Dana Jambon Ekşi Maya','Dana jambon · kendi sandviçini kur','Ekşi Maya Ekmeği',515,575,575,34.5,66.7,18.9,'meal',true,true,101,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Dana Jambon Ekşi Maya');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Dana Jambon Ekşi Maya') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000003',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000021',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Füme Kaburga Ekşi Maya
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Füme Kaburga Ekşi Maya','Füme kaburga · kendi sandviçini kur','Ekşi Maya Ekmeği',515,619,619,40.9,66.3,20.9,'meal',true,true,102,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Füme Kaburga Ekşi Maya');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Füme Kaburga Ekşi Maya') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000003',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000022',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Karabiberli İtalyan Salam Ekşi Maya
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Karabiberli İtalyan Salam Ekşi Maya','Karabiberli italyan salam · kendi sandviçini kur','Ekşi Maya Ekmeği',515,768,768,36.9,67.1,39.3,'meal',true,true,103,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Karabiberli İtalyan Salam Ekşi Maya');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Karabiberli İtalyan Salam Ekşi Maya') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000003',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000023',6),('c0000000-0000-4000-8000-000000000015',7),
  ('c0000000-0000-4000-8000-000000000016',8),('ed6770f8-e736-4128-98ae-6d42fca61b6b',9)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

-- Veggie Ekşi Maya (9 grup)
INSERT INTO products (name,"desc",category,price,calories,cal,protein,carbs,fats,type,is_available,in_stock,"order",is_bundle,is_crosssell,allow_immediate,allow_scheduled,gramaj_options,adisyo_product_code,adisyo_product_unit_id)
SELECT 'Veggie Ekşi Maya','Guacamole & labne bazlı · kendi sandviçini kur','Ekşi Maya Ekmeği',515,499,499,20.9,65.5,16.9,'meal',true,true,104,true,false,true,true,'[]'::jsonb,NULL,NULL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Veggie Ekşi Maya');
INSERT INTO product_option_groups (product_id, group_id, sort_order)
SELECT p.id, g.gid::uuid, g.so FROM (SELECT id FROM products WHERE name='Veggie Ekşi Maya') p
CROSS JOIN (VALUES
  ('c0000000-0000-4000-8000-000000000003',0),('c0000000-0000-4000-8000-000000000010',1),
  ('c0000000-0000-4000-8000-000000000011',2),('c0000000-0000-4000-8000-000000000012',3),
  ('c0000000-0000-4000-8000-000000000013',4),('c0000000-0000-4000-8000-000000000014',5),
  ('c0000000-0000-4000-8000-000000000015',6),('c0000000-0000-4000-8000-000000000016',7),
  ('ed6770f8-e736-4128-98ae-6d42fca61b6b',8)
) AS g(gid,so) ON CONFLICT (product_id, group_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT name, category, price FROM products
--   WHERE category IN ('Focaccia Ekmeği','Ciabatta Ekmeği','Ekşi Maya Ekmeği') ORDER BY "order";  -- 15
-- SELECT p.name, count(*) FROM products p JOIN product_option_groups j ON j.product_id=p.id
--   WHERE p.category LIKE '%Ekmeği' GROUP BY p.name;  -- non-veggie 10, veggie 9
-- SELECT g.name, count(i.id) FROM option_groups g JOIN option_items i ON i.group_id=g.id
--   WHERE g.id::text LIKE 'c0000000%' GROUP BY g.name;  -- Ekmek 1'er, Peynir 4, protein 3'er vb.

-- ============================================================================
-- ⚠️ AÇIK NOTLAR (İlter netleştirecek)
-- ============================================================================
-- [1] EKMEK GRUBU eklendi (İlter spec'inde yoktu) — is_bundle=true canlı makroya
--     ekmek (~300 kcal) girsin diye. Tek-item zorunlu. Olmasaydı detay makrosu
--     karttan ~300 düşük olurdu. Onaylanırsa kalır.
-- [2] price=515 hepsi GEÇİCİ (İlter "sonra düzenler" dedi). Getir fiyatları çok
--     dağınıktı (Veggie 185 - Kaburga 1012), kullanılmadı.
-- [3] Salatalık makrosu BF nutrition.md'de yok → tahmini (2/0.1/0.4/0).
-- [4] VEGGIE ürünlerinde protein grubu YOK (et yok, guacamole+labne bazlı).
--     "Protein" Labne(peynir) + Guacamole(sos) seçimiyle gelir. 9 grup.
-- [5] Protein gramaj makroları nutrition.md 80g'den ölçeklendi (50g/100g türetildi).
-- [6] Yeşillik = Lolorosso/Roka/Maskolin (Domates → Garnitür&Turşu'ya alındı,
--     İlter spec'i böyle). Getir'de Domates Yeşillik'teydi.
-- [7] Detoks grubu (ed6770f8) her ürüne eklendi — linked drink, +160, ayrı satır.
-- ============================================================================
