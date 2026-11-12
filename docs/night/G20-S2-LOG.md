# G20-S2 — Mağaza gönderimine hazırlık · LOG (9 Kas)
Dal `night20/store` (taban `night20/consent` @ 1485180, G20-S1 DONE sonrası) · worktree `.claude/worktrees/g20-s2`.
Yalnız dosya/yapılandırma: derleme, gönderim, deploy, canlı yazma YOK. `node_modules` g20-s1 worktree'sine sembolik bağ (commit dışı).

## ÖZET (10 satır)
1. md.1 `app.config.js`: sürüm 1.1.0 (build no. EAS remote, dokunulmadı); derin bağlantı `/p/ /u/ /k/ /s/ /kesfet` (iOS AASA + Android intentFilters); Android eski `/p` öneki `/privacy` sayfasını da yakalıyordu → `/p/` düzeltildi.
2. md.1 izinler: Info.plist'te İngilizce varsayılan "Allow $(PRODUCT_NAME)…" ile kalan **Always konum anahtarları silindi** (uygulama arka plan konumu kullanmıyor); EN konum metni eklendi; foto-ekleme metni paylaşım kartına göre düzeltildi; ATT (G20-S1) korunarak.
3. md.1 `expo-image-manipulator`'ın config plugin'i YOK — plugins'e eklenince `expo config` PluginError veriyor (denendi); autolinking ile derlemeye girer. AASA/assetlinks içerik dosyaları `docs/store/well-known/`.
4. md.2 App Store + Google Play metinleri TR/EN (Takip et · Üret · Paylaş; eatkcal yalnız İzmir; "tıbbi tavsiye değildir"; 18+), bütün karakter sınırları betikle denetlendi; inceleme notu yer tutuculu (şifre yok).
5. md.2 Giriş yalnız e-posta kodu/Apple/Google → inceleme için posta kutusu yolu + `user_feature_unlocks` ile bayrak kilidi önerildi.
6. md.3 App Privacy + Data safety tabloları koddan; iOS gizlilik manifesti hizalandı (18 tür: +Audio, OtherUserContent, CustomerSupport, PaymentInfo; Sentry → bağlı; DeviceID +Analytics). L-S1/G3-S1 ile 7 fark işaretli.
7. **P0 bulgu:** tabak fotoğrafı Anthropic'e (ABD) gidiyor, uygulamada ilk taramadan önce üçüncü taraf AI bildirimi/izni yok → Apple 5.1.2(i) (Kas 2025) ret riski. Kod işi, SORULAR 1.
8. md.4 8 karelik plan (6.9" 1320×2868, 6.5" 1242×2688, Android 1080×1920/2160), TR/EN başlıklar; `scripts/store/store-shots.sh` + `compose-frames.mjs` (Chrome başsız, yeni paket yok) — **çekim yapılmadı: disk 12 GB < 20 GB**; başlık katmanı sahte görselle 3 boyutta denendi ✓.
9. md.5 `YAYIN_KONTROL.md`: bayrak dalgaları (%10→%50→%100), min_app_version, OTA, geri dönüş, cihaz testleri; canlıda `user_consents` yok; migration geçmişi kayması uyarısı.
10. Kontrol: tsc 0 · unit 845 (844 ✓, 1 atlandı, 0 ✗; +8 yeni `storeConfig`) · hygiene ✓ · `expo config` public/introspect ✓.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `01a192b` | 1 | app.config derin bağlantı + konum + izin metinleri, locales TR/EN, `docs/store/well-known/*`, `IZIN_METINLERI.md`, `storeConfig.test.ts`, expo config çıktısı |
| `106046f` | 2 | `APP_STORE_METINLERI.md`, `GOOGLE_PLAY_METINLERI.md`, `INCELEME_NOTU.md`, `_uret_metinler.py` |
| `ab5e548` | 3 | `GIZLILIK_BEYANLARI.md`, iOS gizlilik manifesti, manifest testi |
| `6fcee8a` | 4 | `EKRAN_GORUNTUSU_PLANI.md`, `scripts/store/{store-shots.sh,compose-frames.mjs,captions.json}` |
| `94149cb` | 5 | `YAYIN_KONTROL.md` |
| (bu) | — | LOG + `docs/store/README.md` + güncel expo config çıktısı |
| (son) | — | `docs/night/G20-S2-DONE` |

## Doğrulama (introspect — eklentiler uygulandıktan sonraki Info.plist / manifest)
| Anahtar | Önce | Sonra |
|---|---|---|
| NSLocationAlwaysUsageDescription | "Allow $(PRODUCT_NAME) to access your location" (EN varsayılan) | **yok** |
| NSLocationAlwaysAndWhenInUseUsageDescription | TR metin | **yok** |
| NSLocationWhenInUseUsageDescription | TR (EN yok) | TR + EN (`locales/en.json`) |
| NSPhotoLibraryAddUsageDescription | "Siparişlerinize ait görselleri…" | "Paylaşım kartlarını ve görselleri…" / EN |
| Android intentFilters | `/p`, `/u` | `/p/`, `/u/`, `/k/`, `/s/`, `/kesfet` |
| associated-domains | `applinks:l.eatkcal.com` | aynı (yollar AASA'da) |
| Android izinler | CAMERA, FINE/COARSE_LOCATION, RECORD_AUDIO, AD_ID, INTERNET, READ/WRITE_EXTERNAL_STORAGE | aynı (bkz. KARAR 6) |

## KARAR
1. **Sürüm/build**: `version: '1.1.0'` korunur; `ios.buildNumber` / `android.versionCode` EAS remote nedeniyle kullanılmaz → görev gereği dokunulmadı, yorumla belgelendi.
2. **expo-image-manipulator plugins'e EKLENMEDİ**: 14.0.8'de `app.plugin.js` yok; ekleyince `expo config` PluginError (çıktı LOG'da değil, komut: plugins'e ekle → `npx expo config`). Yerel modül autolinking ile gelir, izin gerektirmez. Test bunu kilitliyor (yanlışlıkla eklenmesin).
3. **Android önekleri `/x/`**: eski `/p` → `/privacy`, `/u` → (ileride `/uyelik` vb.) çakışması. `/kesfet` tam yol (`path`), çünkü `/k` öneki `/kesfet`'i de kapsardı. `/k/` kutu QR ve `/s/` saha kodu uygulamada rota açmaz, yalnız kaynak takibi (`attribution.ts`) — normal açılış.
4. **Konum yalnız "kullanılırken"**: `locationAlwaysAndWhenInUsePermission: false`, `locationAlwaysPermission: false` (config-plugins `false` = anahtarı sil). İnceleme "neden her zaman konum?" sorusunu ortadan kaldırır.
5. **Foto-ekleme metni** paylaşım kartı kaydetmeye göre yazıldı (paylaşım sayfasındaki "Görüntüyü Kaydet" bu anahtarı ister); kamera metni G20-S1'de denetlenip testle kilitlendiği için DEĞİŞMEDİ (daraltma önerisi SORULAR 3). ATT metni G20-S1'den aynen.
6. **Android depolama izinleri bırakıldı**: `expo-image-picker` eklentisi ekliyor ve Android ≤12'de `requestMediaLibraryPermissionsAsync` bunları istiyor; `blockedPermissions` eski Android'de avatar/galeriyi kırar. Play'de hassas izin değil.
7. **Gizlilik manifesti** koddaki gerçeğe hizalandı (yalnız beyan; davranış değişmedi). Sentry'yi "bağlı değil"e çekmek yerine etiket düzeltildi (setUser kaldırmak kod işi).
8. **Mağaza URL'leri** eatkcal.com (kcal-web'de sayfalar var: `/gizlilik-politikasi`, `/destek`, `/account-deletion`, `/en/legal/privacy`, `/en/support`); kcalculate.ai yalnız pazarlama URL'si (canlılığı doğrulanmadı).
9. **Anahtar kelime** sınırı hem karakter hem bayt ≤ 100 alındı (Türkçe karakterler UTF-8'de 2 bayt; App Store sayımında belirsizlik var).
10. **Ekran görüntüsü başlıkları** yeni öneri (`MAGAZA_GORSEL_BASLIKLARI_v1.md` bulunamadı); başlık katmanı düzeni Final'de olmayan mağaza materyali → öneri olarak işaretli, uygulama arayüzüne dokunmaz.
11. **Çekim yapılmadı** (disk 12 GB < 20 GB). Betik `G14_MODE=storage` kullanır → G20-S1'i durduran iOS 26 "Açılsın mı?" onayı/Erişilebilirlik izni sorunu yok.
12. **Canlı okuma**: Supabase MCP `list_migrations` + `list_edge_functions` çalıştı; `execute_sql` (bayrak satırları, legal slug'lar) **reddedildi** → CANLI_SEMA + migration listesiyle yazıldı; bayrak değerleri doğrulanamadı (YAYIN_KONTROL A5).

## CANLIYA UYGULANACAK
- Bu oturum yeni migration YAZMADI.
- G20-S1 `20261109210100_g20_s1_user_consents.sql` canlıda yok → 1.1.0 öncesi (YAYIN_KONTROL A4).
- Bayrak satırları kontrolü/eksik satır migration'ı (A5); demo hesap + `user_feature_unlocks` (A6) — canlı yazım, İlter onayı.
- Önce `supabase migration list` — 20261102…20261106 dosyaları canlı geçmişte yok (tablolar var) → `migration repair` gerekebilir.

## DEPLOY GEREKİR
- **Web (Vercel landing-page, l.eatkcal.com)**: `docs/store/well-known/apple-app-site-association` + `assetlinks.json` (parmak izleri) → `landing-page/.well-known/`; `/k/:code`, `/s/:code`, `/kesfet` dönüş sayfaları (`vercel.json`). Bu oturum `landing-page/`'e dokunmadı.
- **Yeni native derleme (1.1.0)**: bu oturumun bütün app.config değişiklikleri (intentFilters, Info.plist izinleri, gizlilik manifesti) + G19/G20-S1 native işleri. OTA ile GİTMEZ. `eas build --profile production` = İlter onayı.
- Edge function: yok.

## SORULAR
1. **(P0) Üçüncü taraf AI izni** — Apple 5.1.2(i): ilk Tara'dan önce "fotoğrafın ve notun kalori tahmini için Anthropic'e (ABD) gönderilir" bildirimi + açık izin (+ `user_consents` amacı `ai_processing`) eklensin mi? Önerim: evet, 1.1.0 incelemesinden önce (JS işi, ~1 sheet + kayıt). Anthropic'in veriyi eğitimde kullanmadığı (API varsayılanı) hukukça teyit edilmeli.
2. **İnceleme girişi**: posta kutusu yolu (A) mı, Apple ile giriş + bayraklar %100 (B) mi? Alternatif: inceleme hesabı için sabit kod — güvenlik nedeniyle önermiyorum.
3. **Kamera metni daraltma**: kodda kamera yalnız Tara için kullanılıyor (avatar/video yalnız galeriden). Öneri TR: "Tabağının fotoğrafını çekip kalorisini tahmin etmek için kameraya erişim gerekir." EN: "Camera access lets you photograph your plate to estimate its calories." Onaylanırsa `app.config.js` 3 yer + `locales` + `cameraConfig.test.ts` aynı anda (derleme öncesi).
4. **Mikrofon**: uygulama içi ses/video kaydı yok; `NSMicrophoneUsageDescription` ve Android `RECORD_AUDIO` eklentilerden geliyor. Kaldırılsın mı (image-picker `microphonePermission: false` + expo-camera)? Video kaydı ileride gelecekse kalsın.
5. **Meta varsayılanı AÇIK** (G20-S1, İlter kararı) ↔ L-S1 B-06 "varsayılan kapalı" önerisi — mağaza beyanı her iki durumda aynı, hukuki karar İlter'de.
6. **R1 — bayraklar girişsiz çözülmüyor**: yeni kurulumda karşılama/onboarding bayrak kapalı yolda açılıyor olabilir; `yeni_onboarding` yüzdesi ilk kuruluma yansımayabilir. G18/G20-S1 bunu ele aldıysa YAYIN_KONTROL E notu düşürülebilir; değilse anonim/cihaz kovası gerekir.
7. **`notify-order-status`** edge function'ı repoda var, canlıda yok — kullanılıyor mu?
8. **App Store adı**: "Kcalculate AI: Kalori Takibi" / "Kcalculate AI: Calorie Tracker" — mevcut mağaza adı farklıysa değiştirme (arama sıralaması) kararı.
9. **assetlinks ikinci parmak izi** (EAS yükleme anahtarı) gerekli mi? Yalnız Play'den kurulum test edilecekse satır silinebilir.
10. Ekran görüntüsü çekimi: disk ≥ 20 GB olunca `STORE_COMPOSE=1 scripts/store/store-shots.sh` (Metro açık, dev client derli). Mock verilerde gerçek kişi adı olmadığı çekimden sonra kontrol edilmeli.

## Ek: `npx expo config --type public` (EXPO_NO_DOTENV=1, son hâl)
`.env` okunmadı → `EXPO_PUBLIC_*` değerleri `undefined`/yok; Meta `clientToken` (app.config.js'te zaten açık) burada maskelendi.
Aynı içerik: `docs/night/g20-s2/expo-config-public.json`.

```json
{
  "name": "Kcalculate",
  "slug": "kcal-mobile",
  "version": "1.1.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "light",
  "scheme": "kcal",
  "jsEngine": "hermes",
  "locales": {
    "tr": "./locales/tr.json",
    "en": "./locales/en.json"
  },
  "assetBundlePatterns": [
    "**/*"
  ],
  "notification": {
    "icon": "./assets/notification-icon.png",
    "color": "#B9EF14",
    "iosDisplayInForeground": true,
    "androidMode": "default",
    "androidCollapsedTitle": "Kcalculate"
  },
  "ios": {
    "supportsTablet": false,
    "bundleIdentifier": "com.kcalmobile.app",
    "buildNumber": "1",
    "userInterfaceStyle": "light",
    "associatedDomains": [
      "applinks:l.eatkcal.com"
    ],
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false,
      "NSCameraUsageDescription": "Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.",
      "NSMicrophoneUsageDescription": "Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.",
      "NSPhotoLibraryUsageDescription": "Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir.",
      "NSPhotoLibraryAddUsageDescription": "Paylaşım kartlarını ve görselleri fotoğraflarına kaydetmek için izin gereklidir.",
      "NSLocationWhenInUseUsageDescription": "Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.",
      "NSUserTrackingUsageDescription": "Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin.",
      "SKAdNetworkItems": [
        {
          "SKAdNetworkIdentifier": "v9wttpbfk9.skadnetwork"
        },
        {
          "SKAdNetworkIdentifier": "n38lu8286q.skadnetwork"
        }
      ]
    },
    "privacyManifests": {
      "NSPrivacyTracking": true,
      "NSPrivacyTrackingDomains": [
        "ep1.facebook.com"
      ],
      "NSPrivacyCollectedDataTypes": [
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhoneNumber",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhysicalAddress",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePreciseLocation",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeHealth",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeFitness",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosorVideos",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeAudioData",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCustomerSupport",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePaymentInfo",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePurchaseHistory",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": true,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            "NSPrivacyCollectedDataTypePurposeAnalytics",
            "NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeProductInteraction",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": true,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            "NSPrivacyCollectedDataTypePurposeAnalytics",
            "NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeDeviceID",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": true,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising",
            "NSPrivacyCollectedDataTypePurposeAnalytics"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            "NSPrivacyCollectedDataTypePurposeAnalytics"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCrashData",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        },
        {
          "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePerformanceData",
          "NSPrivacyCollectedDataTypeLinked": true,
          "NSPrivacyCollectedDataTypeTracking": false,
          "NSPrivacyCollectedDataTypePurposes": [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality"
          ]
        }
      ],
      "NSPrivacyAccessedAPITypes": [
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
          "NSPrivacyAccessedAPITypeReasons": [
            "C617.1",
            "0A2A.1",
            "3B52.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
          "NSPrivacyAccessedAPITypeReasons": [
            "CA92.1",
            "C56D.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
          "NSPrivacyAccessedAPITypeReasons": [
            "35F9.1"
          ]
        },
        {
          "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
          "NSPrivacyAccessedAPITypeReasons": [
            "E174.1",
            "85F4.1"
          ]
        }
      ]
    }
  },
  "android": {
    "package": "com.kcalmobile.app",
    "versionCode": 10,
    "userInterfaceStyle": "light",
    "adaptiveIcon": {
      "backgroundColor": "#000000",
      "foregroundImage": "./assets/adaptive-icon-foreground.png",
      "backgroundImage": "./assets/adaptive-icon-background.png",
      "monochromeImage": "./assets/adaptive-icon-monochrome.png"
    },
    "predictiveBackGestureEnabled": false,
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "category": [
          "BROWSABLE",
          "DEFAULT"
        ],
        "data": [
          {
            "scheme": "https",
            "host": "l.eatkcal.com",
            "pathPrefix": "/p/"
          },
          {
            "scheme": "https",
            "host": "l.eatkcal.com",
            "pathPrefix": "/u/"
          },
          {
            "scheme": "https",
            "host": "l.eatkcal.com",
            "pathPrefix": "/k/"
          },
          {
            "scheme": "https",
            "host": "l.eatkcal.com",
            "pathPrefix": "/s/"
          },
          {
            "scheme": "https",
            "host": "l.eatkcal.com",
            "path": "/kesfet"
          }
        ]
      }
    ],
    "permissions": [
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.RECORD_AUDIO",
      "com.google.android.gms.permission.AD_ID",
      "android.permission.INTERNET"
    ]
  },
  "web": {
    "favicon": "./assets/favicon.png"
  },
  "updates": {
    "enabled": true,
    "url": "https://u.expo.dev/5a65d66c-617a-423a-8346-d6a19e1bfca8",
    "fallbackToCacheTimeout": 0
  },
  "runtimeVersion": {
    "policy": "appVersion"
  },
  "extra": {
    "eas": {
      "projectId": "5a65d66c-617a-423a-8346-d6a19e1bfca8"
    },
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "173333296344-d04r7n8hosc79b1pvjrg5e30pbq4cjss.apps.googleusercontent.com",
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "173333296344-vnu2l4uv6a71hsl26afltb5gpg0bl3jq.apps.googleusercontent.com"
  },
  "plugins": [
    "expo-asset",
    [
      "expo-font",
      {
        "fonts": [
          "./node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf",
          "./node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf",
          "./node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf",
          "./node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf",
          "./assets/fonts/BricolageGrotesque_400Regular.ttf",
          "./assets/fonts/BricolageGrotesque_500Medium.ttf",
          "./assets/fonts/BricolageGrotesque_600SemiBold.ttf",
          "./assets/fonts/BricolageGrotesque_700Bold.ttf",
          "./assets/fonts/BricolageGrotesque_800ExtraBold.ttf"
        ]
      }
    ],
    [
      "expo-splash-screen",
      {
        "image": "./assets/icon.png",
        "imageWidth": 170,
        "resizeMode": "contain",
        "backgroundColor": "#000000"
      }
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir.",
        "cameraPermission": "Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.",
        "microphonePermission": "Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir."
      }
    ],
    [
      "expo-camera",
      {
        "cameraPermission": "Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.",
        "microphonePermission": "Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.",
        "recordAudioAndroid": false
      }
    ],
    "expo-video",
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.",
        "locationAlwaysAndWhenInUsePermission": false,
        "locationAlwaysPermission": false
      }
    ],
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png",
        "color": "#B9EF14",
        "defaultChannel": "default",
        "sounds": []
      }
    ],
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        "iosUrlScheme": "com.googleusercontent.apps.173333296344-d04r7n8hosc79b1pvjrg5e30pbq4cjss"
      }
    ],
    [
      "expo-tracking-transparency",
      {
        "userTrackingPermission": "Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin."
      }
    ],
    [
      "react-native-fbsdk-next",
      {
        "appID": "4403872953189106",
        "clientToken": "<REDACTED: app.config.js>",
        "displayName": "KCAL",
        "scheme": "fb4403872953189106",
        "advertiserIDCollectionEnabled": false,
        "autoLogAppEventsEnabled": true,
        "isAutoInitEnabled": false,
        "iosUserTrackingPermission": "Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin."
      }
    ]
  ],
  "sdkVersion": "54.0.0",
  "platforms": [
    "ios",
    "android"
  ],
  "androidStatusBar": {
    "backgroundColor": "#000000"
  }
}
```
