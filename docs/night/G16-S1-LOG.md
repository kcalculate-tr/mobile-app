# G16-S1 — Son eksikler: çevrimdışı tarama + il kapısı birleştirme

## ÖZET (10 satır)
(1) Dal `night16/release` (taban `night15/release`), worktree `.claude/worktrees/g16-s1`.
(2) FinScanOffline: `offlineQueue.ts` sıralı kuyruk (en çok 10, 24 saat; eski tek anahtar taşınır, dolunca en eski düşer); `pendingProcessor.ts` + `drainPending.ts` bağlantı gelince (NetInfo) sırayla `analyze-ai-scan`; hak yalnız başarıda düşer (`runAiScan` başarısızlıkta release eder, girdi kuyrukta kalır); Ana sayfa `HomePendingScans` (çevrimdışı bandı + "Bağlanınca eklenecek" satırları + Elle gir); `ai_tarama` + `yeni_kabuk` arkasında; mevcut i18n anahtarları.
(3) Sonuç bildirimi: Tara ekranındaki mevcut "loglandı" toast'ı + LogTrail; kota çipi güncellenir.
(4) İl kapısı: eatkcal sekmesi ve EkCityGate rotası `CityGateView` (FinCityR1) kullanır; SignupEat (`yeni_onboarding`) ilk paneli, hedef "FinSignupEat Final ile aynı" gereği Final alttan-sheet'e GERİ döndürüldü (md.2 SignupEat kısmı gevşetildi; İzmir baştan seçili). Kapı `writeCityGatePassed` ile bir kez görünür.
(5) PDF rapor logosu: `design/final/` altında SVG/PNG logo varlığı YOK → `exportNutritionReport.ts` olduğu gibi bırakıldı (SORULAR 1).
(6) Pano çekimi + kaba ölçü (g15-ref, ort. |Δ|; G15 → şimdi): FinCityR1 2,09 → 2,1% aynı. FinScanOffline 10,98 → 6,3% küçük fark (sade `AiScanOffline` ekranı). FinSignupEat üç kare ayrı ölçüldü (Final kompoziti 3 telefon): şehir 6,6% · adres 7,3% · telefon 8,2% = hepsi küçük fark (G15: kompozit 18,60; vitrinde Final'deki gri "Klavye" yer tutucusu eklendi, yalnız __DEV__ vitrini). Çekimler `.claude/night/out/g16/app`.
(7) Kontrol: tsc 0 · test:unit 593/593 (skip 0, export sonrası) · jest 27 suite / 138 test (snapshot 1/1) · `expo prebuild --platform ios` ✓ · `expo export --platform ios` ✓.
(8) Bayrak kapalı parite: TrackerScreen eklemesi `yeniKabuk && aiTarama` içinde; ScanScreen eski yol dokunulmadı; flagOff/legacySwap testleri geçti; package.json/app.config.js/admin-panel diff yok.
(9) **Eski tasarım: 0** (noLegacyWhenFlagsOn geçti; yeni bileşen yalnız Final tema belirteçleri).
(10) Son commit `docs/night/G16-S1-DONE`.

## KARARLAR (İlter, 6 Kas — B)
1. Bayrak kapalı parite kanıtı: mevcut test kanıtı yeterli (TrackerScreen.flagOff snapshot, gates.flagOff, flagOffRoutes, legacySwap + korunan dosyalarda `git diff night15/release` boş). Ekran görüntüsü karşılaştırması YAPILMADI: iki çekim denemesi geliştirme başlatıcı ekranını yakaladı (geçersiz); Metro sonlandırma/worktree silme izni verilmedi.
2. Madde 2 şimdiki hâliyle kalır: SignupEat (`yeni_onboarding`) ilk paneli Final alttan-sheet (FinSignupEat panosu esas); fotoğraflı il kapısı (FinCityR1) eatkcal sekmesinde ve EkCityGate rotasında. Kapı `writeCityGatePassed` ile bir kez görünür.
3. Vitrindeki gri "Klavye" yer tutucusu (yalnız `__DEV__`, Final panosundaki yer tutucuyla aynı) kabul edildi; FinSignupEat kompozit (3 kare yan yana) 6,5%.
4. PDF rapor logosu: `design/final/` içinde logo varlığı yok → rapor olduğu gibi.

## SORULAR
Açık soru yok.

Not: Geçici parite worktree'leri `$CLAUDE_JOB_DIR/tmp/par-night15`, `par-night16` ve olası Metro (8098) silinemedi/sonlandırılamadı; repoya etkisi yok (job silinince temizlenir).

Yeniden giydirilen (Final'de yok): —
