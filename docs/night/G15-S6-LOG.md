# G15-S6 — Entegrasyon + kabul turu

## ÖZET (10 satır)
(1) Dal `night15/release` (taban `night14/visual` a1fe71f), worktree `.claude/worktrees/g15-s6`. Beş dal sırayla `--no-ff` merge: onb → home → kesfet → profil → eatkcal. `admin-panel` işaretçisi değişmedi (016cffe).
(2) Çakışmalar: `vitrinScreens.tsx` (signupEatV2 + CelebrateScene ikisi de kaldı), `screenCatalog.ts`/`vitrinSetup.ts` (iki tarafın eklemeleri birleştirildi; `mockRoutesFor(entry, productIds)` + `resolveVitrinPhotos`), `EkCityGateScreen.tsx` (**`yeni_onboarding` açık → S1 3 panel `SignupEatGate`; kapalı → S5 fotoğraflı `CityGateView`**), FinPrCards katalog satırı S5 sürümü. `dictionaries.ts` otomatik birleşti (tsc 0, kopya anahtar yok).
(3) Kayıtlı kart ekleme: `yeni_siparis` açıkken Kayıtlı kartlarım › Yeni kart → `ProfileAddCard` = `EkAddCardScreen` (`v2ScreenFor`, routes.tsx:84); `AddCardScreen.tsx` diff = 0; `legacySwap.test.ts` geçiyor.
(4) **Eski tasarım: 0** — yeni `src/dev/__tests__/noLegacyWhenFlagsOn.test.ts` (7 test): eatkcal v2, onboarding v2/Final, profil Fin*, keşfet Final, celebrate, shell giriş dosyalarının import ağacında eski `COLORS` (constants/theme), `components/BottomSheet`, `kcalculateLogo`, `ScreenContainer/FormField/PopupModal/ReorderCard/ActiveOrderCard/FloatingCartPill` yok (`*Gate*/Legacy*` dosyaları durak). Test 2 gerçek kalıntı buldu ve düzeltildi: `NotifyPermissionSheet` (FinSheetNotify) eski BottomSheet kullanıyordu → Final `Sheet`; eatkcal `InfoSheet` `ilceleriOzetle` için eski `DeliveryZonesSheet`'i çekiyordu → saf `lib/deliveryZonesSummary.ts` (mantık aynı). Tek bilinçli istisna: PDF rapor logosu (aşağıda SORULAR).
(5) Bayrak kapalı parite: KİMSE dosyalarında `git diff night14/visual` BOŞ (Home/EatHome/Cart/Checkout/Payment/OrderSuccess, profile Orders/Detail/SavedCards/AddCard/Coupons, auth, checkout bileşenleri, lib/orders·activeOrder·reorder, store, package.json, app.config.js, admin-panel); Tracker flagOff snapshot 1/1 aynı; `flagOffRoutes`, `gates.flagOff`, `legacySwap` testleri geçiyor. (night10/release'e göre tek fark `EatHomeScreen` — G11/G12 hareket çalışması, bu oturumdan önce night14/visual'da.)
(6) Migration: `20261106000100_g15_water.sql` **G6-APPLY #18** olarak eklendi (canlıya UYGULANMADI).
(7) Kontrol: tsc 0 · test:unit 592/592 (skip 0 — önceki 1 atlama `vitrinTreeShake` "üretim paketi (varsa dist/)" idi: `dist/` yokken atlanır; `expo export` sonrası 3/3) · test:components 27 suite / 133 test geçti (snapshot 1/1) · `expo prebuild --platform ios` ✓ · `expo export --platform ios` ✓ (9.8 MB hbc). Birleşimde 1 test kırıldı: `flagOffRoutes` 'TakibeBasla' listesi (S2'nin yalnız `yeni_onboarding` açıkken kullanılan makro ayrıntısı girişi `TrackerScreen`) → test listesi güncellendi.
(8) **249 görüntülük yeniden çekim YAPILAMADI** (engel): "G15-6 iPhone" simülatörü (4FED1BB8…, iOS 26.5) oluşturuldu, dev client kuruldu, Metro 8096'da çalıştı; ancak iOS 26'nın her `simctl openurl` için çıkardığı "“Kcalculate” ile Açılsın mı?" onayı otomasyonla (osascript Return) kapatılamadı → vitrin URL'si hiç açılmadı, tek görüntü alınmadı. Engeli aşmaya çalışılmadı (RULES: engel kuralı). Aşağıdaki tablo bu yüzden YENİ ölçüm değil; S1–S5 LOG'larındaki son görsel değerlendirmelerin birleşimidir.
(9) Yeni paket / eas / canlı DB yazma YOK. Merge sonrası görsel yeniden doğrulama İlter'in elinde (aşağıdaki test listesi + SORULAR 1).
(10) Son commit `docs/night/G15-S6-DONE`.

## Pano kabul tablosu (G14 → G15) — S1–S5 LOG'larından birleşim (yeniden çekim yok)
| Oturum | Kapsam | G14 | G15 (kendi son çekimi) | Kaynak |
|---|---|---|---|---|
| S1 onboarding + takibe başla (+Giriş, Kcal AI kayıt, eatkcal ilk kayıt) | tüm panolar | — | hepsi Final ile yan yana doğrulandı; "küçük fark"/"aynı" | G15-S1-LOG |
| S2 ana sayfa/tara/kutlama/koleksiyon | 56 görüntü | aynı 0 · küçük 15 · büyük 39 · ekran yok 2 | **aynı 4 · küçük 52 · büyük 0** | G15-S2-LOG |
| S3 keşfet | 38 pano | — | **aynı 21 · küçük 17 · büyük 0** | G15-S3-LOG |
| S4 profil | 32 pano (16 Dark okundu) | — | hepsi aynı/küçük fark | G15-S4-LOG |
| S5 eatkcal | 56 görüntü (28 pano × L/D) | aynı 2 · küçük 11 · büyük 34 · ekran yok 9 | **aynı 22 · küçük 34 · büyük 0 · ekran yok 0** | G15-S5-LOG |
Spec panoları (FinMo*, FinTabBar-*, FinComponents): token doğrulaması G14-S1'de kodda yapıldı; bu oturumda yeniden doğrulanmadı. Satır satır 249'luk tablo S1–S5 LOG'larındaki panolara bakar (her pano tek oturumun alanında).

## Eski tasarım: 0
Kanıt: `src/dev/__tests__/noLegacyWhenFlagsOn.test.ts` 7/7. İstisna 1 (bilinçli): `constants/kcalculateLogo.ts` → `modules/profil/exportNutritionReport.ts` (Ölçüm raporu PDF belgesinin içindeki logo; uygulama ekranı değil). Not: test yalnız Final giriş dosyalarından erişilebilirliği tarar; render ağacı denetimi değil, import-ağacı denetimidir.

## İlter'e test listesi (merge sonrası, bayraklar açık, telefonda)
1. Kayıt: e-posta + kod giriş (LoginV2) → Kcal AI kayıt 3 adım → Takibe başla (tekerlek, makro kartları).
2. Eat kaydı: Sipariş ver → şehir (3 panel, yeni_onboarding açık) / fotoğraflı kapı (yalnız yeni_siparis) → harita pinli adres → telefon.
3. Ana sayfa: su halkasına dokun (+250 ml, Geri al — migration #18 uygulanmadan su_takibi kapalı kalmalı), Tara (izin kapalı hâli), kutlama + bildirim izni sheet'i (artık Final Sheet).
4. Keşfet: akış kartı, paylaşım (Paylaşılıyor → Yayında), yorumlar, bildirimler, şikayet.
5. Profil: Kayıtlı kartlarım › Yeni kart (EkAddCardScreen), Macro, Gizlilik, Seri hatırlatması 19:30.
6. Sipariş: sepet → ödeme (Paynkolay) → başarılı; kupon, destek, sözleşmeler.
7. Tüm bayraklar KAPALI: eski uygulama aynen (WelcomeGate, eski ana sayfa/Keşfet/Profil).
8. Koyu tema + büyük yazı + EN dili ile her sekme.

## SORULAR
1. 249'luk yeniden çekim: `simctl openurl` onayını geçmek için Simulator'ın Erişilebilirlik/otomasyon iznini (Terminal/Claude Code için System Settings › Privacy › Accessibility) verip `scripts/dev/g14-shots.sh` (G14_UDID=4FED1BB8-CCDC-417E-AF57-0AFDA873101A) çalıştırmak, ya da bu oturumun devamında İlter'in onay verdiği bir yol. Metro: `npx expo start --dev-client --port 8096`.
2. PDF rapor logosu Final'e çevrilsin mi (istisna 1)? Final logo varlığı repoda yok.
3. Çelişen il kapısı davranışı: `yeni_onboarding` açıkken S1 3 panel, yalnız `yeni_siparis` açıkken S5 fotoğraflı kapı — doğru mu?

## Commitler
Merge'ler: onb/home/kesfet/profil/eatkcal; `test(g15-s6): noLegacyWhenFlagsOn…`; `docs(g15-s6): G6-APPLY #18…`; LOG + DONE.
