# İzin metinleri — TR / EN (G20-S2 md.1)

Kaynak: `app.config.js` (varsayılan TR — `ios.infoPlist` + eklenti seçenekleri) ve `locales/{tr,en}.json`
(cihaz dili EN ise iOS `InfoPlist.strings` ile üstüne biner). Doğrulama: `npx expo config --type introspect`
(G20-S2 LOG) + `src/navigation/__tests__/storeConfig.test.ts` + `src/modules/ai/scan/__tests__/cameraConfig.test.ts`.

| İzin | Nerede istenir (kod) | TR | EN | Platform |
|---|---|---|---|---|
| Kamera `NSCameraUsageDescription` | Tara canlı vizör (`expo-camera`) ve "fotoğraf çek" (`ScanScreen.tsx:203` `launchCameraAsync`) | Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir. | Camera access is used to scan your plate and estimate its calories, take your profile photo, record video, and upload product images. | iOS · Android `CAMERA` |
| Fotoğraflar `NSPhotoLibraryUsageDescription` | Tara galeri, avatar, Keşfet görsel/video, destek eki (`expo-image-picker`) | Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir. | Photo library access is used to scan a plate photo and to pick profile photos, images, and videos. | iOS · Android 13+ Foto Seçici (izin yok); Android ≤12 `READ_EXTERNAL_STORAGE` |
| Fotoğraflara ekleme `NSPhotoLibraryAddUsageDescription` | Paylaşım kartı → sistem paylaşım sayfası "Görüntüyü Kaydet" | **(G20-S2)** Paylaşım kartlarını ve görselleri fotoğraflarına kaydetmek için izin gereklidir. | **(G20-S2)** Permission is required to save share cards and images to your photo library. | iOS |
| Konum `NSLocationWhenInUseUsageDescription` | Adres doğrulama, en yakın şube (`expo-location`, yalnız ön plan) | Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz. | **(G20-S2, önce yoktu)** We use your location to verify your delivery address on the map and find your nearest branch. | iOS · Android `ACCESS_FINE/COARSE_LOCATION` |
| Konum (her zaman) | — kullanılmıyor | **(G20-S2) Info.plist'ten silindi** (önce eklenti İngilizce varsayılan "Allow $(PRODUCT_NAME)…" yazıyordu) | — | — |
| Mikrofon `NSMicrophoneUsageDescription` | Uygulama içi kayıt yok (video yalnız galeriden); `expo-camera`/`expo-image-picker` eklentileri ekler | Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir. | Microphone access is required to record audio when sharing a video. | iOS · Android `RECORD_AUDIO` (image-picker eklentisi) |
| Takip (ATT) `NSUserTrackingUsageDescription` | Rıza bloğu → reklam ölçümü açıksa (`ConsentGate`, G20-S1) | Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin. | We ask for this to measure how our ad campaigns perform. You can use the whole app without allowing it. | iOS (G20-S1 metni — üzerine yazılmadı) |
| Bildirim | iOS'ta sistem metni yok; Android 13+ `POST_NOTIFICATIONS` (expo-notifications kütüphane manifesti). Uygulama içi ön soru: onboarding (FinOnbNotify) ve ilk öğün kutlaması | Serini korumak için akşam 19:30’da hatırlatayım mı? · Günde en fazla bir kez. Saati sonra değiştirebilirsin. · İzin ver / Şimdi değil | Remind you at 7:30 PM to keep your streak? · At most once a day. You can change the time later. · Allow / Not now | iOS · Android (`src/core/i18n/dictionaries.ts` `onb.notify`, `celebrate.notify_*`) |

## Notlar
- Kamera metni G20-S1'de denetlendi ve testle kilitli (bu oturumda değişmedi). Kodda profil
  fotoğrafı/video için kamera kullanılmıyor (avatar ve video yalnız galeriden) — daraltma önerisi
  SORULAR'da (`docs/night/G20-S2-LOG.md`).
- Android `READ/WRITE_EXTERNAL_STORAGE` hâlâ manifestte: `expo-image-picker` eklentisi ekliyor ve
  Android ≤12'de `requestMediaLibraryPermissionsAsync` bunları istiyor (engellenirse eski Android'de
  avatar/galeri seçimi kırılır). Play'de "hassas izin" değil; `app.config.js`'teki G3-S1 "KALDIRILDI"
  yorumu yalnız `android.permissions` listesini anlatıyor.
- `com.google.android.gms.permission.AD_ID` (Meta SDK) manifestte → Play Console "Reklam kimliği"
  beyanı: **Evet, reklam/analiz** (`GIZLILIK_BEYANLARI.md`).
