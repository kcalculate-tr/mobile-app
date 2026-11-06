# G16-S1 — Son eksikler: çevrimdışı tarama + il kapısı birleştirme

## ÖZET (10 satır)
(1) Dal `night16/release` (taban `night15/release`), worktree `.claude/worktrees/g16-s1`.
(2) FinScanOffline: `offlineQueue.ts` sıralı kuyruk (en çok 10, 24 saat; eski tek anahtar taşınır, dolunca en eski düşer); `pendingProcessor.ts` + `drainPending.ts` bağlantı gelince (NetInfo) sırayla `analyze-ai-scan`; hak yalnız başarıda düşer (`runAiScan` başarısızlıkta release eder, girdi kuyrukta kalır); Ana sayfa `HomePendingScans` (çevrimdışı bandı + "Bağlanınca eklenecek" satırları + Elle gir); `ai_tarama` + `yeni_kabuk` arkasında; mevcut i18n anahtarları.
(3) Sonuç bildirimi: Tara ekranındaki mevcut "loglandı" toast'ı + LogTrail; kota çipi güncellenir.
(4) İl kapısı: `SignupEatFlowV2` ilk panel artık `CityGateView` (FinCityR1/Waitlist/EatBerlin); adres/harita/telefon panelleri aynen. EkHome, EkCityGate ve SignupEat tek bileşeni kullanır; `cityGatePassed` ile kapı bir kez görünür.
(5) PDF rapor logosu: `design/final/` altında SVG/PNG logo varlığı YOK → `exportNutritionReport.ts` olduğu gibi bırakıldı (SORULAR 1).
(6) Pano çekimi ("G15-6 iPhone", Metro 8097, storage) + kaba ölçü (g15-ref yöntemi: 40×86 gri, ort. |Δ|; G15 değeri → şimdi): FinCityR1 2.09 → 2.1% = **aynı**. FinScanOffline 10.98 → 15.7% = **büyük fark (kabul EDİLMEDİ)**: Final panosu yalnız bant + "Bugün" listesi + Elle gir'den oluşan sade ekran; uygulamada aynı bileşenler tam Ana sayfa (halkalar, makro, öğün slotları) içinde, bant/satır slotlardan önce. FinSignupEat 18.60 → 14.6% = **büyük fark (kabul EDİLMEDİ)**: Final'de alttan şehir sheet'i, md.2 gereği uygulamada FinCityR1 tam ekran kapısı (FinCityR1 referansına 5.2%). Çekimler `.claude/night/out/g16/app`.
(7) Kontrol: tsc 0 · test:unit 593/593 (skip 0, export sonrası) · jest 27 suite / 138 test (snapshot 1/1) · `expo prebuild --platform ios` ✓ · `expo export --platform ios` ✓.
(8) Bayrak kapalı parite: TrackerScreen eklemesi `yeniKabuk && aiTarama` içinde; ScanScreen eski yol dokunulmadı; flagOff/legacySwap testleri geçti; package.json/app.config.js/admin-panel diff yok.
(9) **Eski tasarım: 0** (noLegacyWhenFlagsOn geçti; yeni bileşen yalnız Final tema belirteçleri).
(10) Son commit `docs/night/G16-S1-DONE`.

## SORULAR
1. Final logo varlığı (SVG/PNG) `design/final/` içinde yok; PDF raporu eski logoda. Varlık eklenirse `exportNutritionReport.ts` güncellenir.
2. KARAR GEREKLİ — FinSignupEat: md.2 (FinCityR1 her yerde) ile hedef (FinSignupEat ≈ Final sheet) çelişiyor. Seçenek A: FinSignupEat panosu FinCityR1 olarak kabul edilir; B: ilk panel Final sheet'e geri döner (md.2 gevşer).
3. KARAR GEREKLİ — FinScanOffline: Final sade ekranı birebir için çevrimdışı+bekleyen durumda Ana sayfa halkaları/slotları gizlenmeli (özellik gizleme, RULES'a aykırı olabilir); aksi hâlde fark kalır.

Yeniden giydirilen (Final'de yok): —
