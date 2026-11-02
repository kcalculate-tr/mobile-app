# iOS `Info.plist` — G3-S1 düzeltmeleri (ios/ .gitignore'da)

`ios/` klasörü `.gitignore`'da (`.gitignore:39` → `/ios`). Yani
`ios/Kcalculate/Info.plist` **git'te değil**; sadece İlter'in yerel checkout'unda
var ve `xcodebuild` mağaza build'ini bu dosyadan alıyor. Bu yüzden G3-S1
değişiklikleri **repoya commit edilemiyor** — iki yoldan biriyle uygulanmalı:

**Yol A (önerilen) — `app.config.js`'ten yeniden üret:**
```
export DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer
cd ~/dev/kcal-mobile && npx expo prebuild --clean -p ios
```
`app.config.js` zaten temiz (mikrofon/Always izinleri yok, privacyManifests
eklendi, version 1.0.7). Prebuild hem `Info.plist`'i hem `PrivacyInfo.xcprivacy`'yi
doğru üretir. **Dikkat:** prebuild native projeyi yeniden kurar — CLAUDE.md'deki
build akışını değiştirir, bu yüzden kararı İlter vermeli (gece kuralı).

**Yol B — elle düzenle** (prebuild çalıştırmadan): aşağıdaki 3 düzeltmeyi
`ios/Kcalculate/Info.plist`'e uygula, `PrivacyInfo.xcprivacy`'yi bu klasördeki
referansla değiştir.

## Info.plist'te yapılacak 3 değişiklik

1. **`NSMicrophoneUsageDescription` SİL** (mevcut satır ~97-98). Kodda mikrofon
   kullanımı YOK (ses kaydı/özelliği yok). Kullanılmayan izin + İngilizce
   placeholder (`"Allow $(PRODUCT_NAME) to access your microphone"`) tipik Apple
   5.1.1 ret sebebi.
   ```xml
   <!-- SİL:
   <key>NSMicrophoneUsageDescription</key>
   <string>Allow $(PRODUCT_NAME) to access your microphone</string>
   -->
   ```

2. **`NSLocationAlwaysUsageDescription` + `NSLocationAlwaysAndWhenInUseUsageDescription` SİL**
   (mevcut satır ~91-94). Uygulama konumu yalnızca "kullanırken" (when-in-use)
   kullanıyor (expo-location `locationAlwaysAndWhenInUsePermission` değil,
   `NSLocationWhenInUseUsageDescription` yeterli). "Always" hiç kullanılmıyor,
   biri İngilizce placeholder. `NSLocationWhenInUseUsageDescription` (TR, doğru)
   KALIR.
   ```xml
   <!-- SİL:
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>Teslimat adresinizi otomatik doldurmak için konumunuz kullanılır.</string>
   <key>NSLocationAlwaysUsageDescription</key>
   <string>Allow $(PRODUCT_NAME) to access your location</string>
   -->
   <!-- KALIR:
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.</string>
   -->
   ```
   Not: Kalan `NSLocationWhenInUseUsageDescription` metnini `app.config.js`'teki
   (daha açık) metinle hizala.

3. **`CFBundleShortVersionString` 1.0.6 → 1.0.7** (mevcut satır ~24). `app.config.js`
   `version: '1.0.7'` ile tutarlı olsun (native dosyadan build alınırsa 1.0.6
   gidiyordu).
   ```xml
   <key>CFBundleShortVersionString</key>
   <string>1.0.7</string>
   ```

## Kodda kullanılmadığının kanıtı (G3-S1 taraması)
- **Mikrofon:** `grep -ri "microphone\|Audio.Recording\|expo-av\|Recording" src/` → ilgili özellik yok.
- **Konum "Always":** expo-location yalnızca `getCurrentPositionAsync`/when-in-use
  deseninde; arka plan konum/`startLocationUpdatesAsync`/geofencing YOK.
- **Depolama (Android, app.config.js'ten kaldırıldı):** expo-image-picker Foto
  Seçici kullanıyor; `MediaLibrary`/dosya yazımı YOK → READ/WRITE_EXTERNAL_STORAGE
  gereksiz (Android 13+ zaten yok sayar).
