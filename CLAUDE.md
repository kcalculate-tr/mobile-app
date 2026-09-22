# KCAL Mobile

## Stack
- Expo SDK 54 + React Native, Supabase (ref `xtjakvinklthlvsfcncu`), Node 20
- Geliştirme: development build + iOS Simülatör (Expo Go değil)

## Yerel iOS geliştirme
- Xcode 26 kullan: `DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer`
  (Xcode 27 ile `expo run:ios` çalışmaz — Simulator.app yerine Device Hub geliyor,
  simülatör açılamıyor.)
- **`npx expo run:ios` bu projede doğrudan çalışmıyor**: Apple ile Giriş entitlement'ı
  (`com.apple.developer.applesignin`) yüzünden Expo CLI simülatör build'i için bile
  gerçek bir "Apple Development" codesigning kimliği arıyor; bu makinede sertifika
  keychain'de var ama private key eşleşmiyor (`CommandError: No code signing
  certificates are available to use.`). Simülatörün kendisi buna hiç ihtiyaç
  duymuyor (Xcode "Sign to Run Locally" ile sorunsuz derliyor) — bu Expo CLI'nin
  aşırı temkinli bir ön kontrolü. **`security`/keychain tarayan komutlar çalıştırma**
  (parola sorma diyaloğu tetikliyor) — aşağıdaki 2 komutu kullan:

  1) Native build + simülatöre kurulum (native kod/paket değiştiğinde, veya ilk kurulumda):
     ```
     export DEVELOPER_DIR=/Applications/Xcode-26.app/Contents/Developer
     cd ~/dev/kcal-mobile/ios && xcodebuild -workspace Kcalculate.xcworkspace -scheme Kcalculate \
       -configuration Debug -destination "id=31E99C6C-55F8-48A3-84A8-E382E0481AA5" \
       -allowProvisioningUpdates DEVELOPMENT_TEAM=A63MT69ASR CODE_SIGN_STYLE=Automatic build \
       && xcrun simctl install 31E99C6C-55F8-48A3-84A8-E382E0481AA5 \
       ~/Library/Developer/Xcode/DerivedData/Kcalculate-*/Build/Products/Debug-iphonesimulator/Kcalculate.app
     ```

  2) Günlük döngü — Metro başlat + uygulamayı aç (JS değişiklikleri Fast Refresh ile
     anında yansır, native rebuild gerekmez):
     ```
     export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
     cd ~/dev/kcal-mobile && npx expo start --dev-client & \
       xcrun simctl launch 31E99C6C-55F8-48A3-84A8-E382E0481AA5 com.kcalmobile.app
     ```

  Simülatör UDID'si "iPhone 17 (iOS 26.3)" içindir — Xcode 26.6, iOS 27.0 runtime'ını
  desteklemez, `xcrun simctl list devices available` ile iOS 26.3/26.5 bir cihaz seç.
- `eas update` / `eas build` sadece gerçek cihaz testi ve mağaza gönderimi için;
  günlük simülatör geliştirmesinde kullanılmaz.

## Migration kuralları
- Önce migration dosyası yaz, sonra `supabase db push`
- Elle (Dashboard üzerinden) şema değişikliği yok
- Backend commit'leri (supabase/, edge functions) main'e de cherry-pick edilir

## Test kullanıcıları
- Supabase Auth Admin API ile oluşturulur/silinir
- Şifre/token asla çıktıya yazılmaz
- Test verisi iş bitince her zaman temizlenir

## Raporlama
- Uzun işler için rapor: `~/kcal-reports/YYYY-MM-DD_HHMM-konu.md`
- Sohbette en fazla 10 satır özet

## ONAYSIZ YASAK
- `eas update --channel production`
- production build
- mağaza gönderimi (App Store / Play Store submit)
- admin-panel main merge
- `supabase db reset`
- Supabase Dashboard auth ayarları değişikliği
- secret/token/şifre çıktıya yazdırmak
