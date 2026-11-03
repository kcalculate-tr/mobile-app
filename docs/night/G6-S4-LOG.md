# G6-S4 — eatkcal kapısı, AI tarama kotası, paylaşım kartı 9:16

## Özet (10 satır)
1. Dal `night6/eat-scan-ui` (taban `night5/feed-client`, worktree `.claude/worktrees/g6-s4`). İLK İŞ: `night5/share-links` merge edildi — tek çakışma `src/core/flags/registry.ts` (`paylasim_karti` iki tarafta da vardı, tek satıra indirildi); `AppNavigator`/`types.ts` otomatik birleşti. Merge commit `5641f67`.
2. Madde 1-2 (eatkcal T20Eat + şehir kapısı): `src/modules/eatkcal/` — `cityGate.ts` (saf katalog, yalnız İzmir aktif), `cityGateStorage.ts` (AsyncStorage: "bir kez sor" + yerel "Haber ver"), `ui/CityGateSheet.tsx`, `screens/EatHomeScreen.tsx`. `restoran_yakinda` bayrağı arkasında; `branches` tablosundan GERÇEK şube listesi (`lib/branches.ts` zaten vardı), sahte restoran listesi YOK — tek "Yakında burada" kartı.
3. Madde 3 (AI tarama kotası): `src/modules/ai/scan/` — `quotaStore.ts` (bellek-içi, kalıcı DEĞİL: "bilinmiyorsa gizle" ilkesi), `ui/ScanQuotaChip.tsx`, `ui/ScanLimitSheet.tsx` (T20ScanLimit), `screens/ScanScreen.tsx`. `ai_tarama` bayrağı arkasında, giriş noktası TrackerScreen'deki yeni "AI ile tara" butonu (bayrak kapalıyken buton hiç render olmaz).
4. Madde 4 (paylaşım kartı): `src/components/share/PlateXRayShareCard.tsx` (1080×1920, "Tabak Röntgeni") + `plateXRayLayout.ts` (saf yerleşim) + `PlateXRayShareModal.tsx`. Mevcut `MealShareCard` (4:5) **silinmedi/değişmedi** — ayrı, fotoğraf tabanlı yeni bir kart; AI tarama sonuç ekranından açılır (`paylasim_karti` bayrağı arkasında).
5. Canlı kamera önizlemesi YOK: `expo-camera` kurulu değil, yeni paket kurmak RULES'e göre yasak → mevcut `expo-image-picker` (zaten kurulu, ProfileScreen'de kullanılıyor) ile sistem kamerası açılıyor. Statik koyu vitrin zemini + T20Scan'deki çerçeve/çip/deklanşör.
6. Bayrak kapalıyken davranış DEĞİŞMEDİ: `HomeScreen.tsx`, `UnifiedLoginScreen`, Checkout/Cart'a dokunulmadı. `AppNavigator`'daki Home sekmesi artık `HomeTabScreen` sarmalayıcısı — `restoran_yakinda` false ise birebir `<HomeScreen/>` döner. "Sipariş ver" sonrası mevcut akış (`EatCatalog` rotası) bugünkü `HomeScreen` bileşenini AYNEN yeniden kullanır, kopya kod yazılmadı.
7. i18n: `src/core/i18n/dictionaries.ts`'e TR+EN `eatkcal`, `share_card` namespace'leri + `ai_scan`'e limit/paylaşım anahtarları eklendi (üst seviye namespace testi `i18n.test.ts` hâlâ geçiyor). `I18nProvider` App.tsx'e EKLENMEDİ (önceki G5-S3 kararıyla aynı çizgi — üretime bağlanmamış durumda); `useT()` provider'sız da çalışıp varsayılan 'tr' metni döner, EN içerik hazır ama cihaz dili otomatik algılanmıyor (bkz. SORULAR).
8. Açık/koyu tema: yeni eatkcal ekranları `core/design/theme.ts`'teki `useTheme().color.*` token'larını kullanıyor (RULES.md'deki hex eşlemesiyle birebir aynı dosya). AI tarama ekranları T20Scan'in sabit koyu/beyaz paletini kullanıyor (tasarımda zaten tema-bağımsız).
9. Kontrol: **tsc 0**, **`npm run test:unit` 351/351 geçti** (yeni testler: `plateXRayLayout.test.ts`, `saveEstimate.test.ts`, `quotaStore.test.ts`, `mealTypeFromHour.test.ts`, `cityGate.test.ts`, `useCityGateFlow.test.ts`), **`expo export --platform ios` başarılı** (8.05 MB bundle). Commit `d1c06f9`.
10. Dal push edilmedi (RULES: PR yok). SORULAR aşağıda — hiçbiri bu geceki teslimi bloklamıyor, karar gerektiren noktalar.

## Yapılanlar (madde madde)

### Madde 1-2 — eatkcal T20Eat + şehir kapısı
- `EatHomeScreen` Home sekmesinde `restoran_yakinda` açıkken gösterilir (`AppNavigator.tsx`'teki `HomeTabScreen` sarmalayıcısı seçiyor). Şube kartları `fetchBranches()` (mevcut `lib/branches.ts`, değişmedi) + `subeBanneri(slug)` (mevcut `lib/branchBanner.ts`) ile gerçek veriden; `active` kolonu yok, dönen tüm satırlar gösteriliyor.
- "Sipariş ver": `cityGateStorage.readCityGatePassed()` kontrolü — geçilmişse direkt mevcut sipariş akışına (`navigation.navigate('EatCatalog')`, bugünkü `HomeScreen` bileşeni). Geçilmemişse `CityGateSheet` (T20SignupEat ekran 1) açılır.
- `CityGateSheet`: mevcut `useEatkcalRegistration()` hook'unu (G5-S3'ten, `restoran_yakinda` bayrağına zaten bağlı) ve `checkDeliveryCity` client/mock'unu DOĞRUDAN kullanıyor — yeni RPC/istemci YAZILMADI. İzmir "Devam" → `checkDeliveryCity({city:'izmir'})` ok ise `writeCityGatePassed()` + adres yoksa `Addresses` ekranına (mevcut), varsa doğrudan kataloğa. İstanbul/Ankara/Antalya "Haber ver" → `cityGateStorage.addNotifyCity()` ile yalnız yerel kayıt, sunucuya gitmez; SMS doğrulama adımı eklenmedi.
- "Çevrendeki sağlıklı restoranlar": tek "Yakında burada" kartı + yerel "Haber ver" (AsyncStorage, `EatHomeScreen.tsx` içinde, ayrı bir modül gerektirmeyecek kadar küçük).

### Madde 3 — AI tarama kotası
- `ScanQuotaChip`: `quotaStore.remaining` null ise HİÇ render olmaz (ekran ilk açıldığında veya bu oturumda hiç tarama yapılmadıysa kalan hak bilinmez — AsyncStorage'a YAZILMIYOR, kasıtlı: günlük sıfırlamadan sonra yanlış sayı göstermek riski, bilinmemekten daha kötü).
- `ScanScreen`: deklanşöre basınca `expo-image-picker`'ın `launchCameraAsync` ile sistem kamerası açılır → `runAiScan` (mevcut, G5-S3) çağrılır → `quotaStore.recordQuota(remaining, reset_at)`. `quota_exhausted` → `ScanLimitSheet` (T20ScanLimit: "Elle gir" mevcut Tracker modalına geri döner, "Pro ile sınırsız" `opacity:0.45` + `disabled`, dokunulamaz). `failed` → `Alert` + tekrar deneme. `ok` → sonuç ekranı (ad, kcal, bileşen etiketleri, "Güne ekle", `paylasim_karti` açıksa "Paylaş").
- Giriş noktası: `TrackerScreen`'deki "Kalori Ekle" düğmesinin yanına `ai_tarama` arkasında "AI ile tara" eklendi (TrackerScreen'in geri kalanı DEĞİŞMEDİ).
- Kayıt: `saveEstimate.ts` — G6-S1'in `meal_consumptions_source_check` güncellemesi (`'ai_scan'` eklemesi) bu dala henüz alınmadı, bu yüzden `source:'manual'`, `source_ref:'ai_scan'` ile yazılıyor (bkz. SORULAR).
- Öğün tipi seçici YOK (tasarımda da yok) — `mealTypeFromHour.ts` ile saatten çıkarılıyor.

### Madde 4 — Paylaşım kartı (Tabak Röntgeni)
- `PlateXRayShareCard` 1080×1920, `react-native-svg` (mevcut `MealShareCard` ile aynı teknik: `toDataURL` → PNG → `expo-sharing`, `lib/shareCard.ts` değişmedi).
- Güvenli alan (üst 250px, alt 340px) ve bileşen etiket konumları `plateXRayLayout.ts`'te — tasarım dosyasındaki 360×640 önizlemenin 3× karşılığı, birim testle doğrulandı (0/1/4/6 etiket senaryoları).
- Bileşen etiketlerinin foto üzerindeki konumu GERÇEK bir nesne tespiti değil (AI tarama sözleşmesinde bbox/konum verisi yok); tasarımdaki sabit yerleşim kullanıldı — süsleme, besin verisi değil. Bileşen başı kalori sunucudan gelmiyorsa (`ScanIngredient.kcal` opsiyonel) etikette yalnız ad gösteriliyor, uydurma sayı YOK.
- Bileşen yoksa yalnız öğün adı + toplam (kişisel hedef/gün toplamı hiçbir durumda yok). @handle yalnız varsa gösterilir.
- Mevcut 4:5 `MealShareCard`/`ShareMealCardModal` (Tracker'daki genel öğün paylaşımı) hiç dokunulmadı — "feed" seçeneği olarak duruyor.

### Madde 5 — i18n, tema, testler
- `dictionaries.ts`: `eatkcal.*`, `share_card.*` (yeni namespace, TR+EN) + `ai_scan.*`'e 9 yeni anahtar. Üst seviye namespace sayısı testi (`i18n.test.ts`) hâlâ geçiyor.
- Bricolage başlık fontu her yeni ekranda yerel `useFonts(bricolageFonts)` ile yükleniyor (App.tsx'teki önceki kararla aynı çizgi — üretim açılışı yüklemiyor).
- 13 yeni birim test (bkz. özet #9), hepsi `node:test`/`tsx` ile native bağımlılıksız.

## SORULAR
1. **`meal_consumptions_source_check`**: G6-S1'in bu CHECK'e `'ai_scan'` eklemesi bu dala henüz alınmadı. Şu an AI tarama kaydı `source:'manual', source_ref:'ai_scan'` ile yazılıyor (şema riski yok). G6-S1 entegre olunca `saveEstimate.ts`'teki `source` değeri `'ai_scan'`a çevrilebilir.
2. **`I18nProvider` App.tsx'e hâlâ bağlı değil** (G5-S3'ten kalma karar): yeni ekranlar `useT()` ile çalışıyor ama cihaz dili otomatik algılanmıyor, hep 'tr' varsayılanı dönüyor. TR/EN içerik hazır; provider'ı köke eklemek (düşük risk, additive) ayrı bir entegrasyon kararı — İlter'e bırakıldı.
3. **"Sipariş ver" hedefi**: G6-S4.md "mevcut sipariş akışına gider" diyor ama bu akışın tam olarak hangi ekran olduğu netleşmemiş (branch'e özel katalog yok, uygulamada tek ortak katalog var). Bugünkü `HomeScreen` bileşeni `EatCatalog` adıyla yeniden kullanıldı — yanlışsa (örn. doğrudan Checkout'a gidilmeli) tek satır (`navigation.navigate('EatCatalog')`) değişir.
4. **`branches` tablosunda `active` kolonu yok** (`lib/branches.ts` filtre uygulamıyor): T20Eat "aktif şubeler" dönen tüm satırları gösteriyor. Gerçekten pasif bir şube eklenirse bu listeye de girer — gerekiyorsa `branches`'e bir `active`/`is_open` kolonu eklenmeli (migration, G6-S1/İlter kararı).
5. **AI tarama analiz edge function adı**: `modules/ai/scan/client.ts` hâlâ `analyze_ai_scan` çağırıyor (G5-S3 SORUSU); G6-S1 bunu `analyze-ai-scan` + `{reservation_id, image_path}` gövdesine uydurmayı planlıyor (G6-CONTRACT). Bu oturum o dosyaya dokunmadı — G6-S1 entegre olunca otomatik düzelir.
