# G26 — İzin ve onay envanteri (11 Kas 2026, `release/1.1.0`)

İlter kararı (11 Kas 01:45): kullanıcıdan istenen izin sayısı en aza insin; her sistem izni yalnız kullanıldığı
anda, bir kez. Kayıt / onboarding sırasında SİSTEM PENCERESİ YOK. ATT kaldırılır.

Satır numaraları G26-S1 sonrası koddan (`release/1.1.0`). "Önce" sütunu G25-S1 sonu (`c32a961`) hâlidir.
Bekçi testleri: `src/lib/permissions/__tests__/noPromptSources.test.ts` (kaynakta istenmeyen çağrı kalmasın),
`src/navigation/__tests__/storeConfig.test.ts` (Info.plist / Android izinleri).

## 1. Sistem izinleri (işletim sistemi penceresi)

| İzin | Önce: ne zaman tetikleniyordu (dosya:satır) | Sonra: ne zaman tetikleniyor (dosya:satır) | Ret sonrası | Metin (TR / EN) |
|---|---|---|---|---|
| **ATT** (iOS izleme) | Politika kabulünden hemen sonra / bayrak kapalıyken **açılışta** (`ConsentGate` → `initFBSDK` → `requestTrackingPermissionsAsync`, `analytics.ts:121`); Ayarlar'da reklam ölçümü açılınca (`analytics.ts:132`) | **KALDIRILDI** — paket, eklenti, `NSUserTrackingUsageDescription`, çağrılar yok. iOS `setAdvertiserTrackingEnabled(false)` + IDFA kapalı sabit (`src/lib/analytics.ts` `initFBSDK`); Meta ATT'siz (AEM / SKAdNetwork) | — | — |
| **Konum** (yalnız kullanılırken) | **Açılışta** adres yoksa (`useNearestLocationBootstrap.ts:85` → `nearestLocation.ts:75`); kayıt akışında adres paneli açılınca (`SignupEatFlowV2.tsx:381`); eatkcal adres ekleme ekranı açılınca (`EkAddressAddScreen.tsx:216`); eski adres doğrulama düzenleme modunda açılınca (`AddressVerificationSheet.tsx:143`) | YALNIZ kullanıcı "Konumumu kullan" / "İzin ver"e dokununca: `SignupEatFlowV2.tsx:403`, `EkAddressAddScreen.tsx:235`, `AddressVerificationSheet.tsx:165` → tek yardımcı `requestLocationPermission` (`src/modules/eatkcal/v2/model/addressGeocode.ts:49`, `askOnce`). Açılışta ve ekran açılışında yalnız okunur (izin önceden verilmişse cihaz konumu kullanılır) | Bir daha sorulmaz (`@kcal_location_denied`); il/ilçe elle + harita pini; eatkcal'da "Konum kapalı · Ayarlar" bandı | Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz. / We use your location to verify your delivery address on the map and find your nearest branch. |
| **Fotoğraflar** (okuma) | Galeriden seçmeden önce `requestMediaLibraryPermissionsAsync`: Tara (`ScanScreen.tsx:295`, `:449`), Keşfet foto (`kesfet/media.ts:26`), video (`pickVideo.ts:11`), avatar (`avatarUpload.ts:11`, `ProfileScreen.tsx:170`), destek eki (`SettingsSupportScreen.tsx:147`, `SupportScreen.tsx:98`) | **İzin İSTENMEZ** — sistem seçicisi (iOS PHPicker / Android Foto Seçici): aynı dosyalarda yalnız `launchImageLibraryAsync` (`ScanScreen.tsx:307`, `:448`, `kesfet/media.ts:27`, `pickVideo.ts:13`, `avatarUpload.ts:13`, `ProfileScreen.tsx:170`, `SettingsSupportScreen.tsx:148`, `SupportScreen.tsx:99`) | Seçici açılamazsa bilgi hâli (Tara: "Fotoğraflara erişim kapalı") — izin sorulmaz | (Info.plist anahtarı kalır, bkz. KARAR) Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için… / Photo library access is used to… |
| **Fotoğraflara ekleme** | Uygulama kodu istemiyor; yalnız sistem paylaşım sayfası "Görüntüyü Kaydet" | Aynı (yalnız kullanıcı "Kaydet"e dokununca, sistem sayfası ister) | — | Paylaşım kartlarını ve görselleri fotoğraflarına kaydetmek için izin gereklidir. / Permission is required to save share cards… |
| **Kamera** | Tara canlı vizör açılınca (`FinScanCamera.tsx:145`); eski kabuk deklanşörde (`ScanScreen.tsx:245`) — Android'de ret sonrası her açılışta yeniden sorabiliyordu | Tara'da kamera ilk açıldığında (`FinScanCamera.tsx:183` → `:153`, `askOnce`); eski kabuk deklanşöre dokununca (`ScanScreen.tsx:253`) | Bir daha sorulmaz (`@kcal_camera_denied`); "Kameraya erişim kapalı" + Ayarlar (FinScanError) | Tabağını tarayıp kalorisini tahmin etmek… / Camera access is used to scan your plate… |
| **Mikrofon + konuşma tanıma** | Tara ses modunda "perm" açıklaması → `requestPermissionsAsync` (iOS ikisini arka arkaya sorar) (`useVoiceScan.ts:298`); Koç mikrofonuna dokununca (`Composer.tsx:174`) — Android'de ret sonrası tekrar sorabiliyordu | Aynı noktalar, tek yardımcı `requestSpeechPermission` (`src/modules/ai/scan/voice/speech.ts:129`, `askOnce`): Tara ses moduna ilk dokunuş (`useVoiceScan.ts:298`), Koç mikrofonu (`Composer.tsx:176`). Mikrofon + konuşma tanıma tek akış | Bir daha sorulmaz (`@kcal_speech_denied`); Tara: "Mikrofon izni kapalı" + "Ayarlar'ı aç"; Koç: açıklama + "Ayarlar'ı aç", Gönder pasif | Sesle yemek eklerken söylediklerini yazıya çevirmek… / Söylediğin yemekleri telefonunda yazıya çevirmek için konuşma tanımayı kullanıyoruz… |
| **Bildirim** | (1) **Oturum açılır açılmaz** doğrudan (`App.tsx:113` → `registerForPushNotifications` isteği); (2) **açılıştan 2,5 sn sonra** "Sana özel indirimleri kaçırma" modalı, oturum şartı yok (`PushPermissionPrompt.tsx`, `App.tsx:137`); (3) ilk kutlama sonrası FinSheetNotify (`HomeCelebrations.tsx:197`); (4) Keşfet ilk sosyal etkileşimde SocialPushPrompt (`KesfetScreen.tsx:418`); (5) Tara sonucu "Planıma ekle" doğrudan (`mealActions.ts:32`); (6) onboarding OnbNotify (akışta erişilmiyordu) | **Tek fonksiyon** `src/core/push/pushPermission.ts` (`Notifications.requestPermissionsAsync` yalnız `:67`): **ilk öğün kutlaması** kapanınca tek açıklama ekranı (`HomeCelebrations.tsx:202` `canOfferPush('first_meal')` → `NotifyPermissionSheet.tsx:42`) ya da **Ayarlar › Bildirimler** "Bildirimleri aç" (`SettingsNotifyScreen.tsx:137`, eski `NotificationPreferencesScreen.tsx:154` → `enablePushFromSettings`). Oturumda yalnız jeton kaydı, izin istemez (`App.tsx:113`). Hatırlatma / seri / plan `pushGranted()` sorar (`mealReminder.ts`, `streakReminder.ts`, `mealActions.ts`); sosyal ön sayfa ve açılış modalı kaldırıldı | İlk teklif bir kez; reddeden ya da geçen kullanıcıya otomatik teklif yok — yalnız Ayarlar'dan, sistem penceresi 30 günde en fazla bir (`pushPolicy.ts`); işletim sistemi soramıyorsa Ayarlar uygulaması | Serini korumak için akşam 19:30’da hatırlatayım mı? · İzin ver / Şimdi değil (+ isteğe bağlı "Kampanya ve fırsat bildirimleri de gelsin") / Remind you at 7:30 PM to keep your streak? |

### Info.plist / AndroidManifest (introspect, `npx expo config --type introspect`)
| | Önce | Sonra |
|---|---|---|
| iOS kullanım anahtarları | Camera, Microphone, SpeechRecognition, PhotoLibrary, PhotoLibraryAdd, LocationWhenInUse, **UserTracking** | Camera, Microphone, SpeechRecognition, PhotoLibrary, PhotoLibraryAdd, LocationWhenInUse (**ATT yok**) |
| iOS gizlilik manifesti | `NSPrivacyTracking: true`, `NSPrivacyTrackingDomains: [ep1.facebook.com]`, izleme = PurchaseHistory, ProductInteraction, DeviceID | `NSPrivacyTracking: false`, alan yok, izleme türü yok |
| Android `uses-permission` (uygulama manifesti) | INTERNET, VIBRATE, CAMERA, ACCESS_FINE/COARSE_LOCATION, RECORD_AUDIO, **READ/WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW** (prebuild şablonu) | INTERNET, VIBRATE, CAMERA, ACCESS_FINE/COARSE_LOCATION, RECORD_AUDIO; depolama + SYSTEM_ALERT_WINDOW `tools:node="remove"` (`blockedPermissions`) |
| Android kütüphane manifestlerinden gelenler (birleştirme) | POST_NOTIFICATIONS (expo-notifications), AD_ID (Meta SDK) vb. | Aynı — ikisi de kullanılıyor (bildirim; Android reklam kimliği rızaya bağlı) |

## 2. Uygulama içi onaylar (KVKK, AI, pazarlama) — bugünkü sıra ve sayı

Yeni kullanıcı (yeni arayüz bayrakları açık), ilk açılıştan ilk koç mesajına:

| # | Onay | Tür | Nerede / ne zaman | Zorunlu? | Kayıt |
|---|---|---|---|---|---|
| 1 | Koşullar + Gizlilik + 18 yaş (tek kutu) + "Reklam ölçümü (Meta) açık · Ayrıntılar" satırı | Satır içi (sheet değil) | Onboarding › Hesap (`OnboardingNavigator.tsx:285`); "Ayrıntılar" → ConsentSheet `details` (`:299`, kullanıcı açar) | Evet (giriş düğmeleri kutusuz pasif) | `user_consents` policy×2 + ad_measurement, `@kcal_consent_policy` |
| 1b | Aynısı + KVKK aydınlatma bağlantısı + reklam ölçümü anahtarı | Satır içi | E-posta ile devam sheet'i (`AccountEmailSheet.tsx:264` ConsentBlock) | Evet | aynı |
| 2 | Sağlık verisi açık rızası | Satır içi kutu | Takibe başla › "Seni tanıyalım" (`TakibeNavigator.tsx:243`) — Ana sayfa "Profilini oluşturalım"dan | Evet (adım için) | Yalnız taslak durumu (sunucuya ayrı rıza satırı yazılmıyor — bkz. LOG SORULAR) |
| 3 | **Fotoğraf ve ses analizi (AI)** | ConsentSheet `ai_photo` | İLK AI analizinde (çekim / galeri / ses dökümü sonrası) `ScanScreen.tsx:160` `aiBlocked` → `:845` | Evet (AI için; "Vazgeç" → elle ekle) | `@kcal_ai_photo_consent` (metin sürümü 2) + `user_consents` ai_photo |
| 4 | Bildirim açıklaması + isteğe bağlı pazarlama kutusu (işaretsiz) | Sheet (FinSheetNotify) | İlk öğün kutlaması sonrası (`HomeCelebrations.tsx:202`) — bu oturumda başka onay sheet'i açıldıysa sonraki oturuma kalmaz, Ayarlar'dan | Hayır | `marketing_enabled` yalnız izin + kutu |
| 5 | **kcalAI Koç ve yapay zekâ** | ConsentSheet `ai_coach` | İLK koç mesajı gönderilirken (`CoachChatScreen.tsx:125` → `:431`) | Evet (koç için) | `@kcal_ai_coach_consent` (yalnız cihaz) + `user_consents` (best effort) |
| 6 | Topluluk kuralları | Tam sayfa | İlk gönderi öncesi (`ComposerScreen.tsx:723`) | Evet (paylaşım için) | AsyncStorage |
| 7 | Mesafeli Satış Sözleşmesi + Koşullar | Satır içi kutu | Sipariş ödeme (`CheckoutFooter.tsx:174`) | Evet | — |
| — | Mevcut kullanıcı bilgilendirme (`notice`) / yeni belge sürümü (`reconsent`) | ConsentSheet | Açılışta (ConsentGate, `ConsentGate.tsx:97`) | reconsent evet | `user_consents` |

**Sayı**: yeni kullanıcı için otomatik açılan onay **sheet'i**: en fazla 3 (ai_photo, bildirim açıklaması, ai_coach) — her biri kendi
eyleminde ve farklı anlarda. Satır içi kutular: hesap (1), sağlık (1), sipariş (1).

**Aynı oturumda arka arkaya** (önce → sonra):
- Açılış: ConsentGate `notice` + 2,5 sn PushPermissionPrompt (koordinasyonsuz) → **PushPermissionPrompt kaldırıldı**.
- Kayıt sonrası: ATT + bildirim sistem penceresi art arda → **ikisi de kaldırıldı**.
- Keşfet: Topluluk kuralları → SocialPushPrompt → **SocialPushPrompt kaldırıldı**.
- İlk öğün: başka bir onay sheet'i (ör. ai_photo) aynı oturumda açıldıysa bildirim açıklaması **gösterilmez**
  (`src/lib/permissions/sheetSession.ts`, `ConsentSheet.tsx:78`).
- Tara (yeni kabuk): kamera sistem penceresi Tara açılınca, AI sheet'i ilk çekimde — farklı anlar (bkz. SORULAR).

## 3. Öneri — tek "Tercihler" ekranı (Tur 26l TASARIM bekliyor, bu oturumda YAPILMADI)
Profil › Gizlilik altında bugün dağınık duran anahtarlar tek ekranda: **Kullanım ölçümü** · **Reklam ölçümü (Meta)** ·
**Fotoğraf ve ses analizi (AI)** · **kcalAI Koç (AI)** · **Kampanya bildirimleri (pazarlama)** · **Bildirimler (sistem)** durum
satırı + "Bildirimleri aç" (tek fonksiyon) · **Konum / Kamera / Mikrofon** durum satırları (salt okuma + "Ayarlar'ı aç") ·
belgeler (Koşullar, Gizlilik, KVKK). Her satır `user_consents`'e yazar (mevcut `setAdMeasurement` / `setUsageMeasurement` /
`setAiPhotoConsent` / `setCoachConsent` / `setMarketingOptIn`). Sağlık açık rızası da buraya kalıcı satır olarak alınabilir.
