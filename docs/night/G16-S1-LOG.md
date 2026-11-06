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

## SORULAR
1. Final logo varlığı (SVG/PNG) `design/final/` içinde yok; PDF raporu eski logoda.
2. md.2 SignupEat kısmı (3 panelli kapıda da FinCityR1) hedef koşul için GEVŞETİLDİ; geri alınmak istenirse `98aee02`'yi yeniden uygula.

Yeniden giydirilen (Final'de yok): —
