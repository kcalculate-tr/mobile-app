# G33-S1 LOG — Tur 26n (Profil · Paywall · Koç) + Tur 26m (Öğün planı · Alışveriş listesi) — 12 Kas

Dal `night33/plan` (taban `release/1.1.0` @ G32-S1-DONE) → `release/1.1.0`'a `git merge --no-ff`. Yalnız JS/TS (native YOK → OTA). Yeni paket YOK. Deploy / OTA / canlı DB yazma YOK.

## ÖZET (10 satır)
1. md.1 Profil "Kcalculate AI" tek grup: Hedefim kartı (halka + kcal/gün + hedef özeti "Kilo ver" + Hedefi düzenle) · Abonelik (özel yeşil cam ikon + mevcut plan) · AI Koç (Balance hapı) · İlerleme · Koleksiyon · Alışveriş listesi + Öğün planı (`ogun_plani`). Ayrı kcalAI bölümü ve "Yakında · Egzersiz" YOK.
2. md.2 Paywall: hareketli bulanık yeşil zemin, "kcalAI" küçük etiket + büyük "Fresh"/"Balance", süzülen cam ikon (yeşil daire yok), karusel + duraklat, Yıllık (%58 tasarruf · 7 gün ücretsiz · ayda 83 TL) / Aylık, Balance'a yükselt ↔ Fresh'e dön, CTA "7 gün ücretsiz başla", yasal, geri yükle, Koşullar · Gizlilik. Fiyat yalnız RevenueCat.
3. md.3 Koç tanıtımı: tutamaç + küçük kapat, 26/15 pt tipografi, Ne yapar / Ne yapmaz kartları, erişim satırı, "Başla" altta + "Koç tıbbi tavsiye vermez." (egzersiz satırı yok).
4. Takibe başla: hız seçenekleri 0,25 / 0,5 / 0,75 (1 kg kalktı), 0,75 yalnız kilo × %1 ≥ 0,75 ise; BMI < 18,5'te "Kilo ver" kapalı (açıklamalı); taban kadın 1200, erkek + belirtmeyen 1500.
5. md.4 Migration (dosya + rollback): ingredient_nutrition, recipes, recipe_ingredients, meal_plans, meal_plan_items, shopping_list_items; RLS (kendi satırı; tarifler herkese, yalnız `published`); `ogun_plani` bayrağı KAPALI (min 1.1.0); user_consents source `meal_plan`.
6. md.5 40 Türk fit tarifi TASLAK (her öğünde 10), 73 malzeme USDA FDC SR Legacy 100 g + FDC ID; makro/alerjen/diyet malzemeden HESAPLANIR (üretici `scripts/plan-seed/gen.mjs` → seed.ts + SQL + `docs/night/G33-TARIF-TASLAK.md`).
7. md.6 Haftalık plan: gün çipleri (doluluk + kcal), gün kartı Kalori/Protein (Loglandı + Planlandı), yuvalar, Logla → mevcut çevrimdışı kuyruk (submitLogOp), Logla izi + "Öğle'ye loglandı · Geri al", Boş plan, Ekle (Tarif / eatkcal / Kendi öğünüm, İzmir dışı hâli), kayan 4 hafta.
8. md.7 Oluşturma: Ücretsiz önizleme (1. gün açık, kalan bulanık + Fresh paywall), Fresh deterministik şablon (±%5, filtreler, eatkcal, koru; Yenile sınırsız), Balance 3 aday → `meal-plan-generate` yalnız sıralama + açıklama (1 koç kotası, makro LLM'den ALINMAZ); alerjen açık rıza kartı.
9. md.8 Alışveriş listesi (Fresh+): kategorili birleşik liste, Alındı/Temizle, Düzenle (sil), Elle ekle, Paylaş, Plan yok, eatkcal kartı → sepet sayfası → Sepete ekle → "Sepete git". md.9 PLAN_MOTION token'ları (tablo birebir) + Azaltılmış hareket.
10. md.10 hygiene + tsc ✅ · unit 1183/1183 ✅ · jest 95 suite / 538 test ✅ · deno check meal-plan-generate ✅ · expo export iOS ✅ Android ✅ (night33/plan; release/1.1.0 üzerinde yeniden koşuldu — aşağıda).

## Commit tablosu (night33/plan)
| Commit | Konu |
|---|---|
| e13521f | md.4–5 + hız sınırı: veri katmanı migration + rollback, tarif tohumu (USDA), saf plan mantığı, Takibe başla 0,75 / %1 / BMI / 1500 |
| 25f369d | md.6–9: plan ekranları, oluşturma, alışveriş listesi, PLAN_MOTION, meal-plan-generate, rotalar (`ogun_plani`) |
| d96cbe1 | md.1–3: Profil grubu, Paywall, Koç tanıtımı + testler yeni düzene |
| 9009ee1 | md.10: plan bileşen testleri + ölçüm zaman aşımı / oturum bağlama düzeltmesi |
| 349e5fa | lint temizliği |
| f1f8aa3 | HIG denetimi düzeltmeleri |
| (merge) | `release/1.1.0` ← `night33/plan` (--no-ff) |
| (son) | docs/night/G33-S1-DONE |

## KARAR
- **demoPrices "yedek"**: "Fiyatlar RevenueCat'ten gelir (demoPrices yalnız yedek)" → üretimde yedek fiyat GÖSTERİLMEZ (App Review: mağaza fiyatı dışı fiyat riski; G25 kuralı ve g27Prices bekçi testi korunur). demoPrices test/vitrin yedeği olarak kalır. Fiyat gelmezse aynı ekranda hata kartı.
- **Paywall varsayılan kademe**: Ücretsiz kullanıcı → Fresh; Fresh kullanıcı → Balance; koçtan → Balance Yıllık; hak sheet'inden `plan` parametresi neyse o.
- **Paywall'da koç**: Balance şeridinde "kcalAI Koç" sayfası ve yükselt kartında "kcalAI Koç" yalnız `koc` bayrağı + uç nokta açıkken (kapalıyken koç anılmaz; İnceleme 2.3). Koçlu varyant (`coach: true`) korunur.
- **"Fresh'e dön"**: modalda geri oku kuralı (navRule) gereği ikon yerine "‹" glifi (VoiceOver'dan gizli); gezinme değil yerinde kademe geçişi.
- **Hedefim kartı düğmesi**: tasarımdaki "Hedefi düzenle" etiketi korundu (kararlardaki "Düzenle" ile aynı eylem; kişisel plan 26o gelince aynı kart).
- **Ücretsiz "Planı benim için oluştur"**: iki karar birleştirildi → form + şablon önizleme serbest (maliyetsiz, cihazda); sonuçta 1. gün açık, kalanı bulanık + "Fresh ile planı aç" (paywall); "Planı uygula" ve "Yeniden oluştur" → Fresh paywall.
- **Taslak tarifler**: istemci yalnız `status = 'published'` okur; üretimde yayımlanmış tarif yoksa Tarif sekmesi/oluşturma boş (taslak GÖSTERİLMEZ). Uygulama içi tohum yedeği yalnız `__DEV__`.
- **Makro**: tablodaki `recipes.kcal…` önbellek; istemci DAİMA malzemeden yeniden hesaplar.
- **eatkcal + alerjen/diyet**: ürünlerin alerjen verisi yok → alerjen ya da (vejetaryen/vegan/pesketaryen) diyet seçiliyse algoritma eatkcal önermez (güvenli taraf). Yüksek protein / düşük karbonhidrat makrodan denetlenir.
- **eatkcal günleri**: seçili günlerin 1., 3., 5.'si öğle (≤ 3/hafta); İzmir = seçili adres ya da kayıtlı adreslerden biri İzmir (coach-chat ile aynı kural).
- **Logla**: yalnız bugün ve geçmiş günler (gelecek günde düğme yok). meal_consumptions CHECK'inde plan kaynağı yok → `source 'manual'`, `source_ref 'plan:<satır>'` (çift kayıt 23505 = başarı).
- **Yuva**: gün başına öğün yuvası başına 1 satır (`unique(plan_id,date,slot)`; Profil "N / 28 öğün").
- **Porsiyon**: günün serbest yuvalarına ortak çarpan (0,5–2, 0,05 adım); eatkcal/kendi öğünüm ölçeklenmez.
- **Alerjen rızası**: G27 altyapısı (kind `health_data`, yan kuyruk) ile AYRI satır, source `meal_plan`, ayrı cihaz anahtarı (`@kcal_allergen_consent`); Takibe başla sağlık rızası alerjeni kapsamaz. Rıza yoksa çipler soluk; dokununca kart, "Alerjen seçmeden devam et" ile akış sürer.
- **Paywall döngüleri**: süzülme ve zemin kayması karar gereği sürekli döngü (G18 "boşta döngü yok" kuralına bilinçli istisna); token'lar `PAYWALL_MOTION` (motion.tsx), azaltılmışta durur.
- **Abonelik cam ikonu**: depoda yeşil cam yıldız varlığı yok → `GlassSparkle` (SVG: lime degrade + parlama + koyu-lime kenar). İlter'in ChatGPT görseli gelince aynı yere PNG.
- **Kendi öğünüm**: kcal 1–5000 doğrulama; makrolar isteğe bağlı.

## HIG denetimi (apple-design-skill, kod denetimi kipi — accessibility.md · motion · contrast)
- DÜZELTİLDİ (Medium): gün çipi kcal 10 pt → 11 pt (`accessibility.md › Text display`: iOS en küçük 11 pt). `src/modules/plan/ui/parts.tsx`.
- DÜZELTİLDİ (Medium): plan satırı yalnız uzun basmayla kaldırılıyordu → VoiceOver `delete` eylemi ("Kaldır").
- DÜZELTİLDİ (Medium): kilitli günlerdeki bulanıklık Saydamlığı Azalt açıkken opak yüzey.
- Uygun: dokunma hedefleri ≥ 44 pt (Logla 44, + 44, stepper 44, kapat 44, onay kutusu 44, Switch sistem); kontrast tema rolleri (ikincil #6B6B70/beyaz 5,3:1, #A1A1A6/#1C1C1E 6,8:1); Azaltılmış hareket: Logla noktası yok + 220 opaklık, koç halkası/süzülme/zemin durur, satırlar 220 opaklık; VoiceOver: gün çipi `tab` + etiket, kartlar `radio`, alerjen `checkbox`, ilerleme canlı bölge, cam görseller gizli.
- Paywall yasal metni 12 pt korundu (tasarımda daha küçük görünse de alt sınırın üstünde kalsın).
- AÇIK (Low): gün çipleri `maxFontSizeMultiplier` 1,2–1,3 (7 çip tek satır; en büyük metinde sayı kırpılmasın diye).

## CANLIYA UYGULANACAK (sıra — İlter onayıyla)
1. `supabase/migrations/20261112100100_g33_meal_plan.sql` (rollback: `supabase/rollbacks/20261112100100_g33_meal_plan_rollback.sql`)
2. `supabase/migrations/20261112100200_g33_recipe_seed.sql` (rollback: `supabase/rollbacks/20261112100200_g33_recipe_seed_rollback.sql`) — tarifler `draft` girer.
3. İlter/diyetisyen onayı (`docs/night/G33-TARIF-TASLAK.md`) → `update public.recipes set status = 'published' where key in (…);`
4. Edge deploy (aşağıda) → 5. bayrak `ogun_plani` (İlter).

## DEPLOY GEREKİR
- `supabase functions deploy meal-plan-generate` (secret `ANTHROPIC_API_KEY` coach-chat ile aynı, zaten var; isteğe bağlı `COACH_MODEL`). Önkoşul: G24 koç migration'ı (reserve/release/consume_coach_message) canlıda.
- Uygulama: yalnız JS → 1.1.0 yayınlandıktan sonra OTA (bu oturumda YAPILMADI).

## SORULAR
1. Fiyat yedeği: üretimde demoPrices ile fiyat gösterilsin mi? (Şu an HAYIR — hata kartı.) Mağaza incelemesi için önerim hayır.
2. Abonelik satırının yeşil cam yıldızı için PNG gelecek mi? (Şimdilik SVG `GlassSparkle`.)
3. Taslak tarif tablosundaki gramajlar diyetisyen onayından geçmeli; özellikle porsiyon tabanları (kahvaltı ~260–400, öğle ~330–560, akşam ~410–560, ara öğün ~140–260 kcal).
4. Logla geçmiş günler için de açık; tüketim zamanı şu an "şimdi" yazılıyor — geçmiş gün loglarında o günün saati mi kullanılsın?
5. eatkcal sepetine eklemede gramaj seçimli ürünler atlanıyor ("Bazı öğünler sepete eklenemedi") — ürün sayfasına yönlendirme istenir mi?
6. "Yeniden oluştur" Balance'ta her seferinde 1 koç mesajı düşüyor (karar gereği); kota bitince şablona düşüp uyarı veriyor — uygun mu?
