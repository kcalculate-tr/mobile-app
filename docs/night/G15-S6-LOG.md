# G15-S6 — Entegrasyon + kabul turu

## ÖZET (10 satır)
(1) Dal `night15/release` (taban `night14/visual` a1fe71f), worktree `.claude/worktrees/g15-s6`. Beş dal sırayla `--no-ff` merge: onb → home → kesfet → profil → eatkcal. `admin-panel` işaretçisi değişmedi (016cffe).
(2) Çakışmalar: `vitrinScreens.tsx` (signupEatV2 + CelebrateScene ikisi de kaldı), `screenCatalog.ts`/`vitrinSetup.ts` (iki tarafın eklemeleri birleştirildi; `mockRoutesFor(entry, productIds)` + `resolveVitrinPhotos`), `EkCityGateScreen.tsx` (**`yeni_onboarding` açık → S1 3 panel `SignupEatGate`; kapalı → S5 fotoğraflı `CityGateView`**), FinPrCards katalog satırı S5 sürümü. `dictionaries.ts` otomatik birleşti (tsc 0, kopya anahtar yok).
(3) Kayıtlı kart ekleme: `yeni_siparis` açıkken Kayıtlı kartlarım › Yeni kart → `ProfileAddCard` = `EkAddCardScreen` (`v2ScreenFor`, routes.tsx:84); `AddCardScreen.tsx` diff = 0; `legacySwap.test.ts` geçiyor.
(4) **Eski tasarım: 0** — yeni `src/dev/__tests__/noLegacyWhenFlagsOn.test.ts` (7 test): eatkcal v2, onboarding v2/Final, profil Fin*, keşfet Final, celebrate, shell giriş dosyalarının import ağacında eski `COLORS` (constants/theme), `components/BottomSheet`, `kcalculateLogo`, `ScreenContainer/FormField/PopupModal/ReorderCard/ActiveOrderCard/FloatingCartPill` yok (`*Gate*/Legacy*` dosyaları durak). Test 2 gerçek kalıntı buldu ve düzeltildi: `NotifyPermissionSheet` (FinSheetNotify) eski BottomSheet kullanıyordu → Final `Sheet`; eatkcal `InfoSheet` `ilceleriOzetle` için eski `DeliveryZonesSheet`'i çekiyordu → saf `lib/deliveryZonesSummary.ts` (mantık aynı). Tek bilinçli istisna: PDF rapor logosu (aşağıda SORULAR).
(5) Bayrak kapalı parite: KİMSE dosyalarında `git diff night14/visual` BOŞ (Home/EatHome/Cart/Checkout/Payment/OrderSuccess, profile Orders/Detail/SavedCards/AddCard/Coupons, auth, checkout bileşenleri, lib/orders·activeOrder·reorder, store, package.json, app.config.js, admin-panel); Tracker flagOff snapshot 1/1 aynı; `flagOffRoutes`, `gates.flagOff`, `legacySwap` testleri geçiyor. (night10/release'e göre tek fark `EatHomeScreen` — G11/G12 hareket çalışması, bu oturumdan önce night14/visual'da.)
(6) Migration: `20261106000100_g15_water.sql` **G6-APPLY #18** olarak eklendi (canlıya UYGULANMADI).
(7) Kontrol: tsc 0 · test:unit 592/592 (skip 0 — önceki 1 atlama `vitrinTreeShake` "üretim paketi (varsa dist/)" idi: `dist/` yokken atlanır; `expo export` sonrası 3/3) · test:components 27 suite / 133 test geçti (snapshot 1/1) · `expo prebuild --platform ios` ✓ · `expo export --platform ios` ✓ (9.8 MB hbc). Birleşimde 1 test kırıldı: `flagOffRoutes` 'TakibeBasla' listesi (S2'nin yalnız `yeni_onboarding` açıkken kullanılan makro ayrıntısı girişi `TrackerScreen`) → test listesi güncellendi.
(8) **249 görüntünün TAMAMI yeniden çekildi** ("G15-6 iPhone", Metro 8096, `G14_MODE=storage`: openurl onay kutusu yerine bekleyen pano AsyncStorage manifest'ine yazılıp uygulama terminate+launch). Sonuç: **aynı 168 · küçük fark 54 · spec 26 · büyük fark 0 · ekran yok 1 (FinScanOffline: çevrimdışı tarama ekranı/kuyruğu uygulamada yok, Dalga 2)**. Karşılaştırma: S1–S5 son çekimleriyle piksel (166 aynı/10 küçük/6 farklı→gözle), tabanı olmayan 79 pano Final'e kaba ölçüyle + 10 şüpheli gözle. Yeni çekimle bulunan: FinSheetNotify artık Final Sheet; kalan farklar vitrin verisi (foto yok/canlı menü).
(9) Yeni paket / eas / canlı DB yazma YOK. Merge sonrası görsel yeniden doğrulama İlter'in elinde (aşağıdaki test listesi + SORULAR 1).
(10) Son commit `docs/night/G15-S6-DONE`.

## Pano kabul tablosu (G14 → G15) — GERÇEK ÖLÇÜM, 249 pano
Yöntem: `G14_MODE=storage scripts/dev/g14-shots.sh` (bekleyen pano AsyncStorage manifest'ine yazılır, openurl yok) → `.claude/night/out/g15/app`; `scripts/dev/g15-diff.ts` S1–S5'in en yeni çekimleriyle piksel karşılaştırması (|Δkanal|>24 oranı: <0,5% aynı, <3% küçük); tabanı olmayan panolar `g15-ref.ts` ile Final referansına kaba benzerlik (düşükse aynı, kaba ölçü). Gözle incelenenler: farklı çıkanlar + şüpheli en yüksek 14 pano.
Sayım: aynı 168 · ekran yok 1 · küçük fark 54 · spec 26

"G14" sütunu: G14-S1 tablosundaki durum (önce → sonra). Büyük fark: 0; ekran yok: FinScanOffline.

| Pano | G14 (önce → sonra) | G15 | Not |
|---|---|---|---|
| FinActivityCard | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinActivityCard-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinAddSheet | büyük fark → büyük fark (değişmedi) | küçük fark | Vitrin verisinde tabak fotoğrafı yok (baş harf), kapat X yok; yerleşim/boyutlar aynı [gözle] |
| FinAddSheet-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Vitrin verisinde tabak fotoğrafı yok; yerleşim aynı [gözle] |
| FinAddToast | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.09% fark) [piksel] |
| FinAddToast-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.09% fark) [piksel] |
| FinBadges | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinBadges-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCelebStreak3 | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 1.30% piksel farkı [piksel] |
| FinCelebStreak3-Dark | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 0.89% piksel farkı [piksel] |
| FinCelebStreak7 | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 1.29% piksel farkı [piksel] |
| FinCelebStreak7-Dark | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 0.74% piksel farkı [piksel] |
| FinCelebrate | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 0.95% piksel farkı [piksel] |
| FinCelebrate-Dark | küçük fark → küçük fark (değişmedi) | küçük fark | S1–S5 son çekimine göre 0.82% piksel farkı [piksel] |
| FinCityR1 | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCityR1-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectCut | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectCut-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectEntry | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.23% fark) [piksel] |
| FinCollectEntry-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.23% fark) [piksel] |
| FinCollectGrid | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectGrid-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectWon | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCollectWon-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinComments | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.09% fark) [piksel] |
| FinComments-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.09% fark) [piksel] |
| FinComponents | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinCompose | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinCompose-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinDetail | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.11% fark) [piksel] |
| FinDetail-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.11% fark) [piksel] |
| FinEatBerlin | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEatBerlin-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddress | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddress-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddressNoMap | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddressNoMap-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.36% fark) [piksel] |
| FinEkAddressNoPerm | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddressNoPerm-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddresses | büyük fark → ekran yok | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddresses-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkAddressesEmpty | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinEkAddressesEmpty-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinEkCart | küçük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCart-Dark | küçük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCartEmpty | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.17% fark) [piksel] |
| FinEkCartEmpty-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.17% fark) [piksel] |
| FinEkCartSkeleton | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.37% fark) [piksel] |
| FinEkCartSkeleton-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckout | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckout-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckoutPayFail | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckoutPayFail-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckoutPayUnknown | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckoutPayUnknown-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkCheckoutPayWait | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.02% fark) [piksel] |
| FinEkCheckoutPayWait-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkErrors | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkErrors-Dark | küçük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkHome | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkHome-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkHomeSkeleton | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkHomeSkeleton-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkInfo | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkInfo-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrderDetail | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.03% fark) [piksel] |
| FinEkOrderDetail-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.04% fark) [piksel] |
| FinEkOrders | büyük fark → ekran yok | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrders-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrdersEmpty | aynı → aynı | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrdersEmpty-Dark | küçük fark → aynı | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrdersFilterEmpty | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkOrdersFilterEmpty-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkProduct | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkProduct-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkProductScroll | büyük fark → büyük fark (değişmedi) | küçük fark | Kaydırma çalışıyor; canlı menünün ilk ürünü Final örneğinden farklı (Et Gramajı grubu) [gözle] |
| FinEkProductScroll-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Kaydırma çalışıyor; canlı menünün ilk ürünü Final örneğinden farklı [gözle] |
| FinEkReviews | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkReviews-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinEkStore | büyük fark → büyük fark (değişmedi) | küçük fark | Canlı menü verisi (Final örnek tabaklar); yapı aynı, kart foto/rozet düzeni farklı [gözle] |
| FinEkStore-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Canlı menü verisi; yapı aynı [gözle] |
| FinErrFailed | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinErrFailed-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinErrLimit | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinErrLimit-Dark | büyük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinErrOffline | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinErrOffline-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinFeed | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinFeed-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinFeedScrollR3 | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.01% fark) [piksel] |
| FinFeedScrollR3-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.01% fark) [piksel] |
| FinFeedTip | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.01% fark) [piksel] |
| FinFeedTip-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.01% fark) [piksel] |
| FinFollowingEmpty | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.06% fark) [piksel] |
| FinFollowingEmpty-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.06% fark) [piksel] |
| FinGunDone | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinGunDone-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinGunEmpty | küçük fark → küçük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 4.4% fark (düşük = yakın) [kaba ölçü] |
| FinGunEmpty-Dark | küçük fark → küçük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 11.6% fark (düşük = yakın) [kaba ölçü] |
| FinGunEnd | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinGunEnd-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinGunView | büyük fark → büyük fark (değişmedi) | küçük fark | Vitrin verisinde tabak fotoğrafı yok (koyu zemin); çubuklar/başlık/alt kart aynı [gözle] |
| FinGunView-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Vitrin verisinde tabak fotoğrafı yok [gözle] |
| FinHomeDelivered | büyük fark → büyük fark | küçük fark | S1–S5 son çekimine göre 1.80% piksel farkı [piksel] |
| FinHomeDelivered-Dark | büyük fark → büyük fark | küçük fark | S1–S5 son çekimine göre 1.41% piksel farkı [piksel] |
| FinHomeEN | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeEN-Dark | büyük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeEmptyR1 | büyük fark → büyük fark | küçük fark | S1–S5 son çekimine göre 0.69% piksel farkı [piksel] |
| FinHomeEmptyR1-Dark | büyük fark → büyük fark | küçük fark | S1–S5 son çekimine göre 0.73% piksel farkı [piksel] |
| FinHomeLogBefore | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeLogBefore-Dark | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeLogFlow | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeLogFlow-Dark | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeLogMerged | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeLogMerged-Dark | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeR3 | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeR3-Dark | büyük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeXL | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinHomeXL-Dark | büyük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinIntro | büyük fark → küçük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.1% fark (düşük = yakın) [kaba ölçü] |
| FinIntro-Dark | büyük fark → küçük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 7.4% fark (düşük = yakın) [kaba ölçü] |
| FinIntroOrder | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.2% fark (düşük = yakın) [kaba ölçü] |
| FinIntroOrder-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 7.5% fark (düşük = yakın) [kaba ölçü] |
| FinMoCard | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoCart | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoCollection | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoDeliver | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoGlass | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoLike | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoLiquid | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoLoad | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoLogA | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoLogB | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoMap | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoPay | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoRing | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoScan | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoShake | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoSheet | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoSticker | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoStreak | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinMoTokens | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinNotifications | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinNotifications-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinOnbAccount | büyük fark → büyük fark | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 4.0% fark (düşük = yakın) [kaba ölçü] |
| FinOnbAccount-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.4% fark (düşük = yakın) [kaba ölçü] |
| FinOnbIntent | büyük fark → büyük fark | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 3.2% fark (düşük = yakın) [kaba ölçü] |
| FinOnbIntent-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.9% fark (düşük = yakın) [kaba ölçü] |
| FinOnbNotify | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 4.2% fark (düşük = yakın) [kaba ölçü] |
| FinOnbNotify-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.3% fark (düşük = yakın) [kaba ölçü] |
| FinOnbUnderage | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 4.4% fark (düşük = yakın) [kaba ölçü] |
| FinOnbUnderage-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 5.6% fark (düşük = yakın) [kaba ölçü] |
| FinOnbWelcome | büyük fark → büyük fark | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 2.9% fark (düşük = yakın) [kaba ölçü] |
| FinOnbWelcome-Dark | büyük fark → küçük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.5% fark (düşük = yakın) [kaba ölçü] |
| FinPhotoEN | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPhotoEN-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPhotoR1 | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPhotoR1-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPostMenu | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.07% fark) [piksel] |
| FinPostMenu-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.07% fark) [piksel] |
| FinPostMenuBlock | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.07% fark) [piksel] |
| FinPostMenuBlock-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.07% fark) [piksel] |
| FinPosting | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.45% fark) [piksel] |
| FinPosting-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinPrAgreements | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrAgreements-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrCards | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrCards-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrFeedback | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrFeedback-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacro | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacro-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacroHistoryEmpty | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacroHistoryEmpty-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacroWhat | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrMacroWhat-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrNotify | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrNotify-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrPersonal | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrPersonal-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrProfile | küçük fark → küçük fark | küçük fark | Satırlar aynı; Final'deki sayaç satırı (gönderi/takipçi/takip) sahte oturumda gelmiyor, 'Hesabım' ek bölümü (Final'de yok, yeniden giydirilen); S4 taban görüntüsü yanlış ekrandı [gözle] |
| FinPrProfile-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.30% fark) [piksel] |
| FinPrProgress | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrProgress-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrSecurity | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrSecurity-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrSupport | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrSupport-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrivacy | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrivacy-Dark | büyük fark → büyük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrivacySettings | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinPrivacySettings-Dark | küçük fark → küçük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinProfilePublic | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinProfilePublic-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinReport | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinReport-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinReportDone | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinReportDone-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinReportNotice | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.05% fark) [piksel] |
| FinReportNotice-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.05% fark) [piksel] |
| FinRules | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinRules-Dark | küçük fark → küçük fark | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinScanError | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinScanError-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinScanOffline | büyük fark → ekran yok | ekran yok | Çevrimdışı tarama ekranı (uyarı + bekleyen foto + Elle gir) uygulamada YOK; i18n anahtarları var, ekran/kuyruk Dalga 2 (kalıcı yükleme kuyruğu) — kapatılamadı [gözle] |
| FinScanR2 | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinScanR2-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.36% fark) [piksel] |
| FinSerbest | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinSerbest-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.08% fark) [piksel] |
| FinSheetNotify | küçük fark → büyük fark | küçük fark | Final Sheet'e geçti (G15-S6); vitrin arka planı düz gri, sheet'te kapat X, boşluklar biraz geniş [gözle] |
| FinSheetNotify-Dark | büyük fark → büyük fark | küçük fark | Final Sheet'e geçti (G15-S6); vitrin arka planı düz gri [gözle] |
| FinSignupAI | büyük fark → büyük fark (değişmedi) | küçük fark | Karşılama aynı; 'Atla' metni ve logo konumu biraz farklı [gözle] |
| FinSignupAI-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 12.9% fark (düşük = yakın) [kaba ölçü] |
| FinSignupEat | büyük fark → büyük fark (değişmedi) | küçük fark | İzmir ön seçili değil, Devam pasif, arka plan düz gri (Final: eatkcal ana sayfası) [gözle] |
| FinSignupEat-Dark | ekran yok → ekran yok (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 10.2% fark (düşük = yakın) [kaba ölçü] |
| FinStreak | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 10.1% fark (düşük = yakın) [kaba ölçü] |
| FinStreak-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Keşfet paneli aynı yerleşim; örnek veri/rozet sayıları farklı [gözle] |
| FinStressDark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinStressEN | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinStressLong | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinStressXL | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinTabBar-mid | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTabBar-mid-Dark | büyük fark → ekran yok | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTabBar-min | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTabBar-min-Dark | büyük fark → ekran yok | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTabBar-rest | ekran yok → ekran yok (değişmedi) | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTabBar-rest-Dark | büyük fark → ekran yok | spec | Spec panosu: token'lar kodda doğrulandı (G14-S1); görüntü bağlam içinde [spec] |
| FinTbAbout | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 8.6% fark (düşük = yakın) [kaba ölçü] |
| FinTbAbout-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 10.5% fark (düşük = yakın) [kaba ölçü] |
| FinTbActivity | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 4.2% fark (düşük = yakın) [kaba ölçü] |
| FinTbActivity-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 7.4% fark (düşük = yakın) [kaba ölçü] |
| FinTbFirst | büyük fark → büyük fark (değişmedi) | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 3.1% fark (düşük = yakın) [kaba ölçü] |
| FinTbFirst-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.3% fark (düşük = yakın) [kaba ölçü] |
| FinTbGoal | büyük fark → büyük fark (değişmedi) | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 3.2% fark (düşük = yakın) [kaba ölçü] |
| FinTbGoal-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 7.2% fark (düşük = yakın) [kaba ölçü] |
| FinTbHow | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 9.6% fark (düşük = yakın) [kaba ölçü] |
| FinTbHow-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.5% fark (düşük = yakın) [kaba ölçü] |
| FinTbPace | büyük fark → büyük fark (değişmedi) | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 3.8% fark (düşük = yakın) [kaba ölçü] |
| FinTbPace-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 5.5% fark (düşük = yakın) [kaba ölçü] |
| FinTbResult | küçük fark → küçük fark (değişmedi) | aynı | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 1.9% fark (düşük = yakın) [kaba ölçü] |
| FinTbResult-Dark | büyük fark → büyük fark (değişmedi) | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 5.4% fark (düşük = yakın) [kaba ölçü] |
| FinTracker | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 5.9% fark (düşük = yakın) [kaba ölçü] |
| FinTracker-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 9.5% fark (düşük = yakın) [kaba ölçü] |
| FinTrackerEmpty | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 6.5% fark (düşük = yakın) [kaba ölçü] |
| FinTrackerEmpty-Dark | büyük fark → büyük fark | küçük fark | Taban yok (S1 vb.) → Final referansına kaba benzerlik: 13.5% fark (düşük = yakın) [kaba ölçü] |
| FinVideo | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.11% fark) [piksel] |
| FinVideo-Dark | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.11% fark) [piksel] |
| FinWaitlistR1 | büyük fark → büyük fark (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |
| FinWaitlistR1-Dark | ekran yok → ekran yok (değişmedi) | aynı | S1–S5 son çekimiyle piksel aynı (0.00% fark) [piksel] |

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
1. FinScanOffline (çevrimdışı tarama ekranı + bekleyen fotoğraf kuyruğu) Dalga 2'ye mi, yoksa şimdi yapılsın mı? (i18n anahtarları hazır, ekran/kuyruk yok.)
2. PDF rapor logosu Final'e çevrilsin mi (istisna 1)? Final logo varlığı repoda yok.
3. Çelişen il kapısı davranışı: `yeni_onboarding` açıkken S1 3 panel, yalnız `yeni_siparis` açıkken S5 fotoğraflı kapı — doğru mu?

## Commitler
Merge'ler: onb/home/kesfet/profil/eatkcal; `test(g15-s6): noLegacyWhenFlagsOn…`; `docs(g15-s6): G6-APPLY #18…`; LOG + DONE.
