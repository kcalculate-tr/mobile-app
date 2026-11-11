# G33-S1 — Tarif tohumu TASLAK (İlter / diyetisyen onayı için)

Durum: **TASLAK** — `recipes.status = 'draft'`; onaylanan tarifler `published` yapılınca uygulamada görünür.
Kaynak: `scripts/plan-seed/source.json` → `node scripts/plan-seed/gen.mjs` (bu dosya, seed.ts ve SQL aynı kaynaktan üretilir).

- Malzeme değerleri: **USDA FoodData Central, SR Legacy (2018-04)**, 100 g başına; her malzemede FDC ID (aşağıda).
- Tarif makroları **hesaplanır**: Σ (gram / 100 × 100 g değeri). Uydurma/tahmini değer yok. Tuz, su, baharat dışı izler dahil değil.
- Pişmiş ağırlık kullanılan malzemeler adında "(pişmiş)/(haşlanmış)" yazar (USDA "cooked" kaydı).
- Alerjen ve diyet etiketleri malzemelerden türetilir: yüksek protein = protein kalorisi ≥ %30, düşük karbonhidrat = karbonhidrat kalorisi ≤ %26.
- Onay için: her satırda ✅ / ✏️ (gramaj değişikliği) / ❌ işaretleyin.

## Tarifler (40)

| # | Öğün | Tarif | Malzemeler (g) | kcal | P | K | Y | Alerjen | Diyet | Onay |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kahvaltı | Menemen | Yumurta 100 · Domates 150 · Yeşil biber 50 · Zeytinyağı 5 · Tam buğday ekmeği 30 | 300 | 18 | 21,7 | 15,9 | yumurta, gluten | vejetaryen, pesketaryen | ☐ |
| 2 | Kahvaltı | Yulaflı kahvaltı kasesi | Yulaf 50 · Süt (%1 yağlı) 200 · Muz 60 · Ceviz 10 · Tarçın 1 | 395 | 15,5 | 59,7 | 11,9 | süt, gluten, kuruyemiş | vejetaryen, pesketaryen | ☐ |
| 3 | Kahvaltı | Beyaz peynirli ıspanaklı omlet | Yumurta 100 · Yumurta akı 66 · Beyaz peynir 30 · Ispanak 30 · Zeytinyağı 5 · Tam buğday ekmeği 30 | 384 | 28,6 | 16,3 | 22,2 | süt, yumurta, gluten | vejetaryen, pesketaryen, düşük karbonhidrat | ☐ |
| 4 | Kahvaltı | Lorlu tam buğday tost | Tam buğday ekmeği 60 · Lor (ricotta) 60 · Domates 50 · Salatalık 50 · Siyah zeytin 15 | 268 | 15,2 | 33,4 | 8,6 | süt, gluten | vejetaryen, pesketaryen | ☐ |
| 5 | Kahvaltı | Avokadolu yumurtalı tost | Tam buğday ekmeği 40 · Avokado 50 · Yumurta 50 · Domates 40 | 260 | 12,6 | 23,3 | 13,6 | yumurta, gluten | vejetaryen, pesketaryen | ☐ |
| 6 | Kahvaltı | Fit kahvaltı tabağı | Yumurta 100 · Beyaz peynir 30 · Salatalık 80 · Domates 80 · Siyah zeytin 15 · Tam buğday ekmeği 30 · Ceviz 10 | 407 | 23,4 | 23 | 25,4 | süt, yumurta, gluten, kuruyemiş | vejetaryen, pesketaryen, düşük karbonhidrat | ☐ |
| 7 | Kahvaltı | Yoğurtlu ıspanaklı yumurta | Ispanak 150 · Yumurta 100 · Yoğurt 60 · Sarımsak 3 · Zeytinyağı 5 · Toz kırmızı biber 1 | 266 | 19,3 | 10,5 | 17,2 | süt, yumurta | vejetaryen, pesketaryen, düşük karbonhidrat | ☐ |
| 8 | Kahvaltı | Yaban mersinli chia puding | Süt (%1 yağlı) 200 · Chia tohumu 20 · Yaban mersini 60 · Bal 7 · Badem 10 | 295 | 12,6 | 35 | 13,3 | süt, kuruyemiş | vejetaryen, pesketaryen | ☐ |
| 9 | Kahvaltı | Sebzeli tofu kavurma | Tofu 150 · Domates 60 · Yeşil biber 40 · Soğan 30 · Zeytinyağı 5 · Kimyon 1 · Tam buğday ekmeği 30 | 370 | 31 | 24,4 | 19,6 | gluten, soya | vejetaryen, vegan, pesketaryen, yüksek protein | ☐ |
| 10 | Kahvaltı | Fıstık ezmeli muzlu tost | Tam buğday ekmeği 60 · Fıstık ezmesi (tuzsuz) 16 · Muz 60 | 300 | 11,7 | 42,9 | 10,5 | fıstık, gluten | vejetaryen, vegan, pesketaryen | ☐ |
| 11 | Öğle | Tavuklu kinoa kasesi | Tavuk göğsü (pişmiş) 120 · Kinoa (pişmiş) 120 · Salatalık 50 · Domates 50 · Maydanoz 10 · Zeytinyağı 7 · Limon suyu 10 | 426 | 43,6 | 30,6 | 13,8 | — | yüksek protein | ☐ |
| 12 | Öğle | Somon kinoa kase | Somon fileto (pişmiş) 120 · Kinoa (pişmiş) 100 · Avokado 40 · Salatalık 50 · Roka 20 · Limon suyu 10 | 446 | 32,6 | 27,9 | 22,8 | deniz ürünü | pesketaryen, düşük karbonhidrat | ☐ |
| 13 | Öğle | Kırmızı mercimek çorbası | Kırmızı mercimek 60 · Soğan 40 · Havuç 40 · Zeytinyağı 7 · Domates salçası 10 · Kimyon 1 · Limon suyu 10 · Tam buğday ekmeği 30 | 399 | 19,5 | 61,3 | 9,8 | gluten | vejetaryen, vegan, pesketaryen | ☐ |
| 14 | Öğle | Nohutlu kısır | Bulgur (pişmiş) 150 · Nohut (haşlanmış) 60 · Domates 50 · Salatalık 50 · Maydanoz 15 · Nane 3 · Zeytinyağı 10 · Limon suyu 15 · Domates salçası 10 | 346 | 11,7 | 52,2 | 12,3 | gluten | vejetaryen, vegan, pesketaryen | ☐ |
| 15 | Öğle | Ton balıklı salata | Ton balığı (suda) 120 · Marul 80 · Domates 60 · Salatalık 60 · Mısır 40 · Barbunya (haşlanmış) 60 · Zeytinyağı 7 · Limon suyu 10 | 311 | 31,8 | 29 | 9,4 | deniz ürünü | pesketaryen, yüksek protein | ☐ |
| 16 | Öğle | Hindili tam buğday dürüm | Tam buğday lavaş 60 · Hindi göğsü (pişmiş) 80 · Marul 30 · Domates 40 · Süzme yoğurt (yağsız) 30 · Salatalık 30 | 338 | 33,9 | 32,2 | 7,8 | süt, gluten | yüksek protein | ☐ |
| 17 | Öğle | Zeytinyağlı kuru fasulye, bulgur pilavı | Kuru fasulye (haşlanmış) 200 · Soğan 40 · Domates salçası 15 · Zeytinyağı 10 · Yeşil biber 30 · Bulgur (pişmiş) 100 | 484 | 23,9 | 76,7 | 11,1 | gluten | vejetaryen, vegan, pesketaryen | ☐ |
| 18 | Öğle | Izgara tavuk salatası | Tavuk göğsü (pişmiş) 130 · Marul 100 · Domates 80 · Salatalık 60 · Beyaz peynir 20 · Zeytinyağı 10 · Limon suyu 10 · Tam buğday ekmeği 30 | 474 | 49,3 | 22,9 | 20,5 | süt, gluten | yüksek protein, düşük karbonhidrat | ☐ |
| 19 | Öğle | Yoğurtlu nohutlu ıspanak | Ispanak 200 · Nohut (haşlanmış) 120 · Soğan 40 · Domates salçası 10 · Zeytinyağı 10 · Yoğurt 80 | 404 | 20 | 49,5 | 16,6 | süt | vejetaryen, pesketaryen | ☐ |
| 20 | Öğle | Mercimek köftesi | Kırmızı mercimek 50 · Bulgur 30 · Soğan 30 · Domates salçası 15 · Zeytinyağı 10 · Maydanoz 15 · Marul 50 · Limon suyu 10 | 410 | 17,7 | 63,2 | 11,9 | gluten | vejetaryen, vegan, pesketaryen | ☐ |
| 21 | Akşam | Izgara somon, tatlı patates | Somon fileto (pişmiş) 150 · Brokoli 120 · Tatlı patates (fırın) 120 · Zeytinyağı 5 · Limon suyu 10 | 504 | 39 | 33,5 | 24,2 | deniz ürünü | pesketaryen, yüksek protein | ☐ |
| 22 | Akşam | Tavuk sote, bulgur pilavı | Tavuk göğsü (pişmiş) 150 · Yeşil biber 50 · Domates 80 · Soğan 40 · Mantar 60 · Zeytinyağı 10 · Bulgur (pişmiş) 120 | 489 | 53,7 | 33,4 | 16,1 | gluten | yüksek protein | ☐ |
| 23 | Akşam | Fırın levrek, roka salatası | Levrek (pişmiş) 180 · Roka 40 · Domates 80 · Soğan 20 · Zeytinyağı 10 · Limon suyu 15 · Patates (haşlanmış) 120 | 451 | 46,6 | 31,5 | 15,2 | deniz ürünü | pesketaryen, yüksek protein | ☐ |
| 24 | Akşam | Izgara köfte, piyaz | Yağsız kıyma (pişmiş) 130 · Soğan 40 · Maydanoz 15 · Kuru fasulye (haşlanmış) 100 · Domates 50 · Zeytinyağı 7 · Limon suyu 10 | 532 | 48,1 | 32,4 | 23,3 | — | yüksek protein, düşük karbonhidrat | ☐ |
| 25 | Akşam | Fırında kıymalı patlıcan | Patlıcan 250 · Yağsız kıyma (pişmiş) 90 · Soğan 40 · Domates 100 · Yeşil biber 30 · Zeytinyağı 7 · Süzme yoğurt (yağsız) 60 | 407 | 35,7 | 25,9 | 18,8 | süt | yüksek protein, düşük karbonhidrat | ☐ |
| 26 | Akşam | Zeytinyağlı taze fasulye, yoğurt | Taze fasulye 250 · Soğan 50 · Domates 100 · Zeytinyağı 15 · Yoğurt 100 · Tam buğday ekmeği 30 | 385 | 13,2 | 43,5 | 20,1 | süt, gluten | vejetaryen, pesketaryen | ☐ |
| 27 | Akşam | Karides güveç | Karides (pişmiş) 150 · Domates 120 · Yeşil biber 50 · Soğan 40 · Sarımsak 5 · Mantar 50 · Zeytinyağı 10 · Az yağlı kaşar (mozzarella) 20 · Tam buğday ekmeği 30 | 429 | 48,3 | 27,7 | 15,2 | süt, gluten, deniz ürünü | pesketaryen, yüksek protein, düşük karbonhidrat | ☐ |
| 28 | Akşam | Tavuklu brokolili tam buğday makarna | Tam buğday makarna (pişmiş) 160 · Tavuk göğsü (pişmiş) 100 · Brokoli 80 · Sarımsak 3 · Zeytinyağı 7 · Süzme yoğurt (yağsız) 40 | 521 | 47,1 | 55,9 | 13,8 | süt, gluten | yüksek protein | ☐ |
| 29 | Akşam | Sebzeli fırın hindi | Hindi göğsü (pişmiş) 140 · Kabak 120 · Havuç 80 · Patates (haşlanmış) 120 · Zeytinyağı 10 · Toz kırmızı biber 1 | 453 | 46,6 | 35,9 | 13,7 | — | yüksek protein | ☐ |
| 30 | Akşam | Tofulu sebze sote, esmer pirinç | Tofu 180 · Brokoli 80 · Kırmızı biber 60 · Havuç 50 · Soya sosu 15 · Susam 5 · Zeytinyağı 7 · Esmer pirinç (pişmiş) 120 | 570 | 40,2 | 51,4 | 27 | susam, soya | vejetaryen, vegan, pesketaryen | ☐ |
| 31 | Ara öğün | Elma ve badem | Elma 150 · Badem 15 | 165 | 3,6 | 23,9 | 7,7 | kuruyemiş | vejetaryen, vegan, pesketaryen | ☐ |
| 32 | Ara öğün | Süzme yoğurt kasesi | Süzme yoğurt (yağsız) 150 · Çilek 60 · Bal 7 · Chia tohumu 5 | 153 | 16,5 | 17,9 | 2,3 | süt | vejetaryen, pesketaryen, yüksek protein | ☐ |
| 33 | Ara öğün | Humus ve havuç | Nohut (haşlanmış) 60 · Tahin 10 · Limon suyu 5 · Zeytinyağı 3 · Havuç 100 | 227 | 8 | 28,5 | 10,2 | susam | vejetaryen, vegan, pesketaryen | ☐ |
| 34 | Ara öğün | Dereotlu lor, salatalık | Lor peyniri (az yağlı) 150 · Salatalık 100 · Dereotu 3 | 124 | 19,3 | 7,9 | 1,7 | süt | vejetaryen, pesketaryen, yüksek protein, düşük karbonhidrat | ☐ |
| 35 | Ara öğün | Muz ve fıstık ezmesi | Muz 100 · Fıstık ezmesi (tuzsuz) 16 | 185 | 4,6 | 26,4 | 8,5 | fıstık | vejetaryen, vegan, pesketaryen | ☐ |
| 36 | Ara öğün | Haşlanmış yumurta, domates | Yumurta 100 · Domates 100 · Salatalık 50 | 169 | 13,8 | 6,4 | 9,8 | yumurta | vejetaryen, pesketaryen, yüksek protein, düşük karbonhidrat | ☐ |
| 37 | Ara öğün | Kuru kayısı, ceviz, fındık | Kuru kayısı 30 · Ceviz 15 · Fındık 10 | 233 | 4,8 | 22,5 | 16 | kuruyemiş | vejetaryen, vegan, pesketaryen | ☐ |
| 38 | Ara öğün | Hurmalı yulaf topları | Hurma 40 · Yulaf 15 · Badem 10 · Tarçın 1 | 228 | 4,9 | 43,1 | 6 | gluten, kuruyemiş | vejetaryen, vegan, pesketaryen | ☐ |
| 39 | Ara öğün | Muzlu yulaflı süt | Süt (%1 yağlı) 250 · Muz 80 · Yulaf 15 · Tarçın 1 | 236 | 11,3 | 41,7 | 3,7 | süt, gluten | vejetaryen, pesketaryen | ☐ |
| 40 | Ara öğün | Baharatlı kavrulmuş nohut | Nohut (haşlanmış) 80 · Zeytinyağı 3 · Toz kırmızı biber 1 · Kimyon 1 | 164 | 7,4 | 22,9 | 5,4 | — | vejetaryen, vegan, pesketaryen | ☐ |

## Malzemeler (73) — USDA FDC SR Legacy, 100 g başına

| Malzeme | FDC ID | USDA kaydı | kcal | P | K | Y | Alerjen |
|---|---|---|---|---|---|---|---|
| Yumurta | 171287 | Egg, whole, raw, fresh | 143 | 12,56 | 0,72 | 9,51 | yumurta |
| Yumurta akı | 172183 | Egg, white, raw, fresh | 52 | 10,9 | 0,73 | 0,17 | yumurta |
| Domates | 170457 | Tomatoes, red, ripe, raw, year round average | 18 | 0,88 | 3,89 | 0,2 | — |
| Yeşil biber | 170427 | Peppers, sweet, green, raw | 20 | 0,86 | 4,64 | 0,17 | — |
| Kırmızı biber | 170108 | Peppers, sweet, red, raw | 26 | 0,99 | 6,03 | 0,3 | — |
| Soğan | 170000 | Onions, raw | 40 | 1,1 | 9,34 | 0,1 | — |
| Sarımsak | 169230 | Garlic, raw | 149 | 6,36 | 33,06 | 0,5 | — |
| Zeytinyağı | 171413 | Oil, olive, salad or cooking | 884 | 0 | 0 | 100 | — |
| Beyaz peynir | 173420 | Cheese, feta | 265 | 14,21 | 3,88 | 21,49 | süt |
| Az yağlı kaşar (mozzarella) | 170847 | Cheese, mozzarella, part skim milk | 254 | 24,26 | 2,77 | 15,92 | süt |
| Lor peyniri (az yağlı) | 173417 | Cheese, cottage, lowfat, 1% milkfat | 72 | 12,39 | 2,72 | 1,02 | süt |
| Lor (ricotta) | 171248 | Cheese, ricotta, part skim milk | 138 | 11,39 | 5,14 | 7,91 | süt |
| Yoğurt | 171284 | Yogurt, plain, whole milk | 61 | 3,47 | 4,66 | 3,25 | süt |
| Süzme yoğurt (yağsız) | 170894 | Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program) | 59 | 10,19 | 3,6 | 0,39 | süt |
| Süt (%1 yağlı) | 170872 | Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D | 42 | 3,37 | 4,99 | 0,97 | süt |
| Yulaf | 173904 | Cereals, oats, regular and quick, not fortified, dry | 379 | 13,15 | 67,7 | 6,52 | gluten |
| Muz | 173944 | Bananas, raw | 89 | 1,09 | 22,84 | 0,33 | — |
| Elma | 171688 | Apples, raw, with skin (Includes foods for USDA's Food Distribution Program) | 52 | 0,26 | 13,81 | 0,17 | — |
| Çilek | 167762 | Strawberries, raw | 32 | 0,67 | 7,68 | 0,3 | — |
| Yaban mersini | 171711 | Blueberries, raw | 57 | 0,74 | 14,49 | 0,33 | — |
| Ceviz | 170187 | Nuts, walnuts, english | 654 | 15,23 | 13,71 | 65,21 | kuruyemiş |
| Badem | 170567 | Nuts, almonds | 579 | 21,15 | 21,55 | 49,93 | kuruyemiş |
| Fındık | 170581 | Nuts, hazelnuts or filberts | 628 | 14,95 | 16,7 | 60,75 | kuruyemiş |
| Fıstık ezmesi (tuzsuz) | 172470 | Peanut butter, smooth style, without salt | 598 | 22,21 | 22,31 | 51,36 | fıstık |
| Bal | 169640 | Honey | 304 | 0,3 | 82,4 | 0 | — |
| Nohut (haşlanmış) | 173757 | Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt | 164 | 8,86 | 27,42 | 2,59 | — |
| Kırmızı mercimek | 174284 | Lentils, pink or red, raw | 358 | 23,91 | 63,1 | 2,17 | — |
| Bulgur (pişmiş) | 170287 | Bulgur, cooked | 83 | 3,08 | 18,58 | 0,24 | gluten |
| Bulgur | 170688 | Bulgur, dry | 342 | 12,29 | 75,87 | 1,33 | gluten |
| Esmer pirinç (pişmiş) | 169704 | Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program) | 123 | 2,74 | 25,58 | 0,97 | — |
| Kinoa (pişmiş) | 168917 | Quinoa, cooked | 120 | 4,4 | 21,3 | 1,92 | — |
| Tam buğday ekmeği | 172688 | Bread, whole-wheat, commercially prepared | 252 | 12,45 | 42,71 | 3,5 | gluten |
| Tam buğday makarna (pişmiş) | 168910 | Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program) | 149 | 5,99 | 30,07 | 1,71 | gluten |
| Tam buğday lavaş | 174081 | Tortillas, ready-to-bake or -fry, whole wheat | 310 | 9,76 | 45,89 | 9,76 | gluten |
| Tavuk göğsü (pişmiş) | 171477 | Chicken, broilers or fryers, breast, meat only, cooked, roasted | 165 | 31,02 | 0 | 3,57 | — |
| Hindi göğsü (pişmiş) | 171496 | Turkey, whole, breast, meat only, cooked, roasted | 147 | 30,13 | 0 | 2,08 | — |
| Yağsız kıyma (pişmiş) | 171794 | Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned | 230 | 28,45 | 0 | 12,04 | — |
| Somon fileto (pişmiş) | 175168 | Fish, salmon, Atlantic, farmed, cooked, dry heat | 206 | 22,1 | 0 | 12,35 | deniz ürünü |
| Ton balığı (suda) | 173709 | Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program) | 86 | 19,44 | 0 | 0,96 | deniz ürünü |
| Levrek (pişmiş) | 173694 | Fish, sea bass, mixed species, cooked, dry heat | 124 | 23,63 | 0 | 2,56 | deniz ürünü |
| Karides (pişmiş) | 175180 | Crustaceans, shrimp, cooked | 99 | 23,98 | 0,2 | 0,28 | deniz ürünü |
| Salatalık | 168409 | Cucumber, with peel, raw | 15 | 0,65 | 3,63 | 0,11 | — |
| Marul | 169247 | Lettuce, cos or romaine, raw | 17 | 1,23 | 3,29 | 0,3 | — |
| Ispanak | 168462 | Spinach, raw | 23 | 2,86 | 3,63 | 0,39 | — |
| Kabak | 169291 | Squash, summer, zucchini, includes skin, raw | 17 | 1,21 | 3,11 | 0,32 | — |
| Patlıcan | 169228 | Eggplant, raw | 25 | 0,98 | 5,88 | 0,18 | — |
| Havuç | 170393 | Carrots, raw | 41 | 0,93 | 9,58 | 0,24 | — |
| Patates (haşlanmış) | 170440 | Potatoes, boiled, cooked without skin, flesh, without salt | 86 | 1,71 | 20,01 | 0,1 | — |
| Tatlı patates (fırın) | 168483 | Sweet potato, cooked, baked in skin, flesh, without salt | 90 | 2,01 | 20,71 | 0,15 | — |
| Brokoli | 170379 | Broccoli, raw | 34 | 2,82 | 6,64 | 0,37 | — |
| Mantar | 169251 | Mushrooms, white, raw | 22 | 3,09 | 3,26 | 0,34 | — |
| Avokado | 171705 | Avocados, raw, all commercial varieties | 160 | 2 | 8,53 | 14,66 | — |
| Limon suyu | 167747 | Lemon juice, raw | 22 | 0,35 | 6,9 | 0,24 | — |
| Maydanoz | 170416 | Parsley, fresh | 36 | 2,97 | 6,33 | 0,79 | — |
| Dereotu | 172233 | Dill weed, fresh | 43 | 3,46 | 7,02 | 1,12 | — |
| Nane | 173475 | Spearmint, fresh | 44 | 3,29 | 8,41 | 0,73 | — |
| Roka | 169387 | Arugula, raw | 25 | 2,58 | 3,65 | 0,66 | — |
| Siyah zeytin | 169094 | Olives, ripe, canned (small-extra large) | 116 | 0,84 | 6,04 | 10,9 | — |
| Tahin | 170189 | Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type) | 595 | 17 | 21,19 | 53,76 | susam |
| Domates salçası | 170459 | Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program) | 82 | 4,32 | 18,91 | 0,47 | — |
| Susam | 170150 | Seeds, sesame seeds, whole, dried | 573 | 17,73 | 23,45 | 49,67 | susam |
| Tofu | 172475 | Tofu, raw, firm, prepared with calcium sulfate | 144 | 17,27 | 2,78 | 8,72 | soya |
| Chia tohumu | 170554 | Seeds, chia seeds, dried | 486 | 16,54 | 42,12 | 30,74 | — |
| Barbunya (haşlanmış) | 175194 | Beans, kidney, red, mature seeds, cooked, boiled, without salt | 127 | 8,67 | 22,8 | 0,5 | — |
| Kuru fasulye (haşlanmış) | 175203 | Beans, white, mature seeds, cooked, boiled, without salt | 139 | 9,73 | 25,09 | 0,35 | — |
| Taze fasulye | 169961 | Beans, snap, green, raw | 31 | 1,83 | 6,97 | 0,22 | — |
| Mısır | 169998 | Corn, sweet, yellow, raw | 86 | 3,27 | 18,7 | 1,35 | — |
| Tarçın | 171320 | Spices, cinnamon, ground | 247 | 3,99 | 80,59 | 1,24 | — |
| Kimyon | 170923 | Spices, cumin seed | 375 | 17,81 | 44,24 | 22,27 | — |
| Toz kırmızı biber | 171329 | Spices, paprika | 282 | 14,14 | 53,99 | 12,89 | — |
| Soya sosu | 174278 | Soy sauce made from soy (tamari) | 60 | 10,51 | 5,57 | 0,1 | soya |
| Hurma | 168191 | Dates, medjool | 277 | 1,81 | 74,97 | 0,15 | — |
| Kuru kayısı | 173941 | Apricots, dried, sulfured, uncooked | 241 | 3,39 | 62,64 | 0,51 | — |
