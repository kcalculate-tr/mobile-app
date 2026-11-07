# G17-S1 — Telefon testi hataları (1.1.0 (25), 7 Kas)

## ÖZET (10 satır)
(1) **Tara çalışıyor (P0):** analizden önce foto `user-media/<uid>/scans/<anahtar>.jpg`'e yüklenir, edge'e kova yolu gider; çevrimdışı kuyruk aynı adım; yükleme/analiz hatası → iade + FinErrFailed. Birim testleri: yol biçimi, reserve → upload → analyze sırası, hata → release (`scanUpload.test.ts` 7/7, kuyruk 2 yeni jest testi).
(2) Kamera: `expo-camera` onayı yok → sahte gri vizör yerine Final "Kamerayı aç" kartı (SORULAR 1). Giriş: Apple/Google sayfada sabit, "Kod gönder" formun içinde. İlk hedef her hesapta Ana sayfa; Niyet adımı akıştan çıktı.
(3) Kuponlar tek dikey kaydırma; özet: yöntem/zaman önceden seçili değil, "Öde" pasif + "Yöntem ve zaman seç"; PaynKolay resmî logo (iki tema); nokta ayraçları → "Sepet (1)" vb.; tab bar seçili hap #1C1C1E/beyaz (koyuda tersi); banner katman/"İncele" yok, tamamı bağlantı; ürün seçenekleri 44/48 satır.
(4) **Gezinme kuralı (md.7):** 9 ihlal düzeltildi (ürün sayfasında sol geri + sağ X birlikteydi; 8 modalda X soldaydı/sol ok/İptal metni) — tablo aşağıda.
(5) **Gerçek akış denetimi (md.13):** navigator'daki 42 kök rota (+ eatkcal v2 rotaları) + 6 R3 sekmesi sınıflandırıldı. **17 kök rota + gizli Abonelik sekmesi bayraklar açıkken 1.0.7 ekranına düşüyordu** → `navigation/finalRoutes.tsx` ile Final karşılığına bağlandı (kapalıyken eski bileşen AYNEN). `noLegacyWhenFlagsOn` rota bazına genişledi (10/10). Akış çekimi sırasında 1 hata daha bulundu ve düzeltildi (özet ekranında anahtar adı görünüyordu).
(6) Kontrol: tsc 0 · test:unit 617/617 (1 skip, önceden var) · test:components 28 suite / 146 test (snapshot 1/1) · prebuild iOS ✓ Android ✓ · `expo export --platform ios` ✓ (9.84 MB) · `--platform android` ✓ (9.87 MB).
(7) Bayrak kapalı parite: KİMSE dosyalarında diff = 0; yeni rota eşlemesi `finalScreenFor(..., enabled=false)` → eski bileşenin KENDİSİ; R3 değişiklikleri yalnız yeni kabukta çizilir; TrackerScreen flagOff snapshot aynı.
(8) **Eski tasarım: 0** (rota bazında). Yeniden giydirilen (Final'de yok): yok (yeni ekran eklenmedi; eski rotalar mevcut Fin*/Settings*/Ek* ekranlarına bağlandı).
(9) **OTA ile gönderilebilir:** bütün değişiklikler JS (yeni paket / native değişiklik / migration yok; expo-camera EKLENMEDİ). Dal `night17/fix` (taban `night16/ui` `3c00660`), worktree `.claude/worktrees/g17-s1`, simülatör "G17-1 iPhone" (`5114C75D…`), Metro 8099.
(10) SORULAR: 3 madde (expo-camera onayı, user-media kovasının canlıda doğrulanması, kalan veri ayracı kararı). Son commit GERÇEK dosya `docs/night/G17-S1-DONE`.

## Commit'ler
| Madde | Commit | Özet |
|---|---|---|
| 1 | `88538a3` | Tara: yükleme adımı (`scanPath.ts`, `client.uploadImage`, `runAiScan` reserve→upload→analyze), kuyruk aynı adım, testler |
| 2 | `7b4773b` | Sahte vizör → "Kamerayı aç" kartı |
| 3 | `3c0bfe7` | Giriş: `FormScreen.fixedFooter` (klavyeyle yükselmeyen alan), "Kod gönder" form içinde |
| 4 | `7c0c3a4` | İlk hedef Ana sayfa; Niyet adımı akış dışı; `postAuthShellTab` |
| 5 | `35674ed` | Kuponlar tek kaydırma |
| 6 | `c91085d`, `a78bd37` | Özet yöntem/zaman (görünüm katmanı, `model/methodTime.ts` + 7 test); sözlük anahtarı |
| 7 | `a7ff600` | Gezinme kuralı (9 ekran) |
| 8 | `fc554c8` | PaynKolay logosu (`v2/ui/PaynkolayLogo.tsx`) |
| 9 | `3d5aadb` | Nokta ayraçları (i18n 107 → 0, kod 50+ yer) |
| 10 | `7850371` | Tab bar seçili hap |
| 11 | `8246ea0` | Banner |
| 12 | `5880260` | Ürün seçenek satırı |
| 13 | `aad823b` | Rota eşlemesi + rota bazlı test + vitrin `Route-<rota>` |
| 14 | bu LOG | Kontroller |

## 1 — Tara (P0)
Kök neden: `ScanScreen` `runAiScan(..., { imageRef: uri })` ile yerel `file://` URI'sini gönderiyordu; `supabase/functions/analyze-ai-scan/index.ts:103` `<uid>/` önekini istiyor → 403 (canlı log 7 Kas 11:32: reserve 200 → analyze 403 → release 204 ile birebir).
- `src/modules/ai/scan/scanPath.ts`: `scanImagePath(uid, key)` → `<uid>/scans/<güvenli-anahtar>.jpg` (anahtar `<uid>-file:///…` biçiminde olduğundan `/ . :` → `_`; 96 karakteri aşarsa FNV özet + son kısım). `sniffImageType` (jpeg/png/webp başlıktan; yol `.jpg` kalır, edge önce blob türüne bakar), 5 MB sınırı.
- `client.ts` `uploadImage`: oturumdan uid → `expo-file-system/legacy` base64 → `base64-arraybuffer` → `storage.from('user-media').upload(path, …, { upsert: true })` (avatarUpload ile aynı mekanik; yeni paket yok). Foto kalitesi 0.8 → 0.5 (edge 5 MB sınırı).
- `runScan.ts`: reserve → (kota yoksa yükleme de YOK) → upload → analyze(kova yolu); upload ya da analyze hatası → `release_ai_scan` (hak iadesi) → `failed` → yeni kabukta FinScanErrorSheet `failed` (FinErrFailed) aynen.
- Çevrimdışı kuyruk `pendingProcessor` zaten `runAiScan` kullanıyor → aynı yükleme adımı (jest: "kuyruk: önce user-media yüklemesi, analize kova yolu gider", "yükleme başarısız → iade, analiz yok, girdi kuyrukta kalır").
- Testler: `__tests__/scanUpload.test.ts` 7/7; `offlineQueue.test.tsx` +2; mevcut `scan.test.ts` aynen geçiyor.

## 2 — Canlı kamera
`expo-camera` İlter onayına bağlı → kurulmadı (SORULAR 1). `FinScanViewfinder`: gri sahte vizör + çerçeve köşeleri + "Tabağı tam çerçevele" kaldırıldı; yerine Final kart (yüzey, 24 köşe, kamera ikonu, "Kamerayı aç" başlık + açıklama + lime birincil düğme → sistem kamerası). Alt panel (Fotoğraf/Barkod/Elle, galeri, deklanşör, flaş) aynen. Kanıt: `FinScanR2` çekimi.

## 3 — Giriş
`LoginV2` (e-posta adımı): Apple/Google `FormScreen.fixedFooter` içinde — KeyboardAvoidingView DIŞINDA, sayfada sabit; klavye açılınca altında kalır. "Kod gönder" e-posta alanı + 18+ onayının altında, kaydırılabilir formun içinde. Auth fonksiyonları/çağrı sırası değişmedi (onboarding v2 jest 38/38).

## 4 — İlk hedef
- `shell/tabs.ts resolveInitialShellTab`: oturum varsa (sipariş geçmişinden bağımsız) `Tracker` (= yeni kabukta Ana sayfa); oturumsuz `Home` (eatkcal, oturumsuz gezilebilen tek sekme).
- `LoginV2 → resolveLoginTarget(..., newShell)`: yeni kabukta hedefi olan/olmayan herkes `Tabs/Tracker` (Checkout/Addresses yönlendirmesi korunur; hedef kurulumu Ana sayfa makro kartından Final "Takibe başla"ya açılır — eski NutritionProfile'a düşmez).
- Onboarding: Karşılama "Başla" → doğrudan Hesap (Niyet adımı atlanır; `IntentScreen` ve `OnbIntent` rotası kayıtlı, hiçbir düğme gitmiyor); nokta göstergesi 4 → 3; dönen kullanıcı → `Tabs/Tracker`.
- Mevcut müşteri: `IntroOverlay` sipariş geçmişini sessizce okur ("Siparişe devam" kartı) — açılış sekmesini değiştirmez.
- Bilinçli: 18 yaş altı "Tamam" → eatkcal (takip 18+; değiştirilmedi).

## 5 — Kuponlar
`FinPrCouponsScreen`: `FinScreen` (sabit View) + iç `ScrollView flex:1` yerine tek dikey `FinScreen scroll` (başlık dahil), alt boşluk `insets.bottom + 16`; yatay banner şeridi `flexGrow:0, height:140`. Not: vitrin ağı kapalı olduğundan kupon listesiyle kaydırma çekilemedi (yapı tek kaydırma).

## 6 — Sipariş özeti
`EkCheckoutScreen` (görünüm): `pickedMethod` / `pickedTime` yerel durum; segmentler seçilene dek boş; özet satırı ve CTA "Yöntem ve zaman seç", CTA pasif. Gel-Al'da zaman gerekmez; ileri tarihte gün + dolu olmayan dilim gerekir. Mantık zaman türünü kendisi değiştirirse (dükkân kapalı → scheduled, bölge izni) ya da "Hemen" kapanırsa seçim düşer ve yeniden istenir. `useEkCheckout` / sipariş-ödeme fonksiyonları DEĞİŞMEDİ (acceptance 4/4), KİMSE diff 0. Saf karar `model/methodTime.ts` (7 test).

## 7 — Gezinme kuralı (ekran · önce · sonra)
Denetim: ~25 Final ekran/sheet tarandı (FinHeader/EkHeader/FormScreen yalnız sol geri; `Sheet` X sağda → uyumlu; Profil alt ekranları ~17 → uyumlu).
| Ekran | Sunum | Önce | Sonra |
|---|---|---|---|
| EkProduct (ürün) | push | sol geri + sağ X | yalnız sol geri |
| FinScanViewfinder (Tara) | modal | X solda | X sağda (hak hapı solda) |
| FinScanErrorSheet | modal | X solda | X sağda |
| FinPhotoResult (2 düzen) | modal içi | sol geri oku | sağ X (sonucu bırak → vizör) |
| CelebrateOverlay | modal | X solda | X sağda |
| RulesSheet (kurallar) | modal | X solda | X sağda |
| ReportFlow (şikâyet) | modal | X solda, başlık sağında | başlık solda, X sağda |
| VideoPlayer (tam ekran) | modal | X solda | X sağda |
| Composer (paylaş) | modal | solda "İptal" metni | sağda Paylaş · X |
Kapsam dışı: `ScanScreen` eski sonuç/vizör dalı yalnız `yeni_kabuk` kapalıyken çizilir.

## 8 — PaynKolay
Varlık: `assets/payment/paynkolay-logo.png` (245×48; eski `CheckoutScreen.tsx:2553` 82×16). `v2/ui/PaynkolayLogo.tsx`: oran korunur; koyu temada lacivert logo beyaz rozet içinde. `PaynkolayText` metindeki "PaynKolay" sözcüğünü satır içi logoyla değiştirir (a11y: tüm metin). Yerler: özet "güvenli ödeme" satırı, kart ekle güvenlik notu, kayıtlı kartlar notu (Ek + FinPrCards). Kanıt: `FinPrCards` açık/koyu çekimi.

## 9 — Nokta ayraçları
Kural: sayaç → `Sepet (1)`, `Yanıtlar (3)`, `Yorumlar (12)`, `Öğle (2/5)`; birim → `Boy (cm)`, `km (isteğe bağlı)`; etiket-değer → `Toplam: 915 kcal`, `Destek hattı: …`; CTA tutarı → `Siparişi ver (850,50 TL)`; iki ifade/veri listesi → virgül (`13:05, 6 Kas`, `P 30 g, K 40 g, Y 12 g`); P·K·Y sütunu → `P / K / Y`. Sözlük (`dictionaries.ts` + v2/i18n) ` · ` 107 → 0 (yalnız yorum), test `g17Keys.test.ts`. Kod: TabBarR3 sepet hapı, Keşfet (gönderi/yorum/video/detay), Gün, Koleksiyon, Tara, eatkcal v2, Profil.
Korunan (bilinçli): `v2/model/checkoutModel.ts:221` `Gel-Al · şube` (siparişe yazılan adres verisi — mantık); `HomeCelebrations.tsx:152` paylaşım metni "… · Kcalculate" (marka anı); TrackerScreen PDF/HTML rapor altbilgisi "Kcalculate · eatkcal.com" (marka); kart maskesi `••••`; durum/okunmadı noktaları (bildirim, canlı sipariş, ödeme bekleniyor nabzı, Macro kazanımı) — işlevsel/marka. Eski (bayrak kapalı) dosyalar dokunulmadı.

## 10 — Tab bar
`TabBarR3.glassTokens`: açık `bubble #1C1C1E` + `activeInk #FFFFFF`; koyu `bubble #F5F5F5` + `activeInk #1C1C1E`; aktif ikon dolu + kesik rengi hap rengi; etiket 600. `tablist` + her sekmede `accessibilityRole="tab"`, `selected`. Kanıt: `FinHomeR3` açık/koyu çekimi.

## 11 — Banner
`CampaignCard`: soluk siyah katman, üst metin ve "İncele" hapı kalktı; bannerın tamamı `Pressable` (`accessibilityRole="link"`, başlık etikette). Hedef: `navigate_to ?? link` (ürün/mağaza/kategori/eski hedef); yoksa `ProfileCoupons` (Kampanyalar — artık Final).

## 12 — Ürün seçenekleri
`OptionRow`: görsel `minHeight 44` (iOS), Android `48` dp; sabit `height` yok → Dynamic Type'ta büyür; gösterge (tekli yuvarlak/çoklu kare), 32'lik fotoğraf (varsa), ad (flex), kcal, fiyat; seçili lime dolgu + koyu metin + onay. Dikey liste (kartların yatay şeridi yerine). Kanıt: `FinEkProductScroll`.

## 13 — Gerçek akış / rota denetimi
Yöntem: (a) `AppNavigator`'daki her `Stack.Screen` + R3 sekmesi statik sınıflandırıldı (test bunu zorunlu kılıyor), (b) vitrin `Route-<rota>` ile her eşlenen rota GERÇEK navigator'da (Ana sayfa üstüne itilerek, bütün bayraklar açık) çekildi, (c) akış: Ana sayfa → Keşfet → eatkcal → Profil → 17 alt ekran (Sub-*) → Tara (vizör → sonuç → logla) → sepet → özet (ödeme ekranına kadar; SİPARİŞ VERİLMEDİ).

Önce eski bileşene düşen rotalar (ekran · önce · sonra):
| Rota | Önce (bayrak açık) | Sonra |
|---|---|---|
| ProfileCoupons | screens/profile/CouponsScreen (1.0.7) | FinPrCouponsScreen |
| Offers | OffersAndCouponsScreen (COLORS) | FinPrCouponsScreen |
| ProfileReviews | MyReviewsScreen | FinPrReviewsScreen |
| ProfileSecurity | SecurityScreen | SettingsSecurityScreen |
| ProfileNotificationPreferences | NotificationPreferencesScreen | SettingsNotifyScreen |
| Feedback | FeedbackScreen | SettingsFeedbackScreen |
| PersonalInfo | PersonalInfoScreen | SettingsPersonalScreen |
| MeasurementHistory | MeasurementHistoryScreen | FinPrMeasurementsScreen |
| ProductDetail | ProductDetailScreen (35 COLORS) | → EkProduct (aynı productId) |
| BrandLanding | BrandLandingScreen | → EkStore |
| OrderDetail | OrderDetailScreen | → EkOrderDetail |
| Categories / CategoryProducts / EatCatalog | eski katalog / HomeScreen | → eatkcal sekmesi (FinEkHome) |
| Checkout | CheckoutScreen | → EkCheckout (Paynkolay; `pendingPaymentOrderId` dönüşü eskide kalır) |
| NutritionProfile | NutritionProfileScreen | → TakibeBasla (editGoal) |
| SharedProfile | DeepLinkLanding | → PublicProfile |
| Tabs/Subscriptions (gizli) | SubscriptionScreen (EkOrderSuccess "Macro" bağlantısı) | FinPrMacroScreen |
Zaten Final olanlar: Onboarding, TakibeBasla, Login (LoginV2), KcalAiSignUp (SignupAIFlowV2), Kesfet, Composer, KesfetNotifications, AiScanOffline, v2 takası (Addresses, OrderSuccess, ProfileOrders, ProfileSavedCards, ProfileAddCard, ProfileSupport, ProfileContracts, PaymentScreen), eatkcal v2 rotaları, R3 sekmeleri (Tracker/Profile/AiScan/PublicProfile/SharedPost kendi içinde dallanır — snapshot/jest testleri). Yalnız bayrak kapalı: WelcomeGate. Dev: 4 rota.
Akış çekimlerinde bulunan ek hata: özet "pick method_time" (çalışma anı sözlüğünde anahtar yok) → `a78bd37`. `Route-PaymentScreen` vitrin çekimi sipariş parametresi istediği için açılmadı (ödeme ekranına sipariş oluşturmadan gidilemez; EkPaymentScreen rota testiyle doğrulandı).
Bilinçli sınır: CategoryProducts kategori filtresi taşınmıyor (FinEkHome kategori şeridi açılır) — EkHome'a kategori parametresi G18'de eklenebilir.

## 14 — Kontrol
tsc 0 · test:unit 617 pass / 0 fail / 1 skip (önceden var) · jest 28/28 suite, 146/146 test, snapshot 1/1 · `CI=1 expo prebuild --no-install` iOS ✓ Android ✓ · `expo export --platform ios` ✓ 9.84 MB · `--platform android` ✓ 9.87 MB · KİMSE diff 0 (`git diff night16/ui -- src/screens/HomeScreen.tsx src/modules/eatkcal/screens src/lib src/store/cartStore.ts src/components/checkout src/screens/profile src/screens/auth package.json app.config.js` boş).
**OTA ile gönderilebilir** (yalnız JS; expo-camera eklenmedi, yeni derleme gerekmez).

Eski tasarım: 0

## SORULAR
1. **expo-camera** (md.2): canlı vizör için `npx expo install expo-camera` + app.config kamera izin metni + FinScanR2 canlı önizleme gerekir — **yeni derleme gerekir** (OTA değil). Onay verilirse G18'de; şimdilik "Kamerayı aç" kartı.
2. **user-media kovası canlıda:** migration `20261104000700_user_media_bucket.sql` (özel kova, `<uid>/` sahip politikası, 10 MB, jpeg/png/webp) G6-APPLY ile uygulandı diye varsayıldı; bu oturumda canlı DB okuması izinle reddedildi (sınıflandırıcı). Telefonda ilk taramada yükleme hatası olursa kova/politika kontrol edilmeli (`storage.buckets` id=`user-media`).
3. **Kalan veri ayracı:** bayrak açık yolda ` · ` metinlerin tümü kaldırıldı; korunan 4 yer yukarıda (marka/sipariş verisi). Marka anı olarak başka yer istenirse liste verilebilir.
