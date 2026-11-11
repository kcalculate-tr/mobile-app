// Sentry kaynak haritasi yuklemesi yalnizca org + project tanimliysa devreye
// girer. Tanimli degilse eklenti HIC eklenmez: build yesil kalir, yalnizca
// stack trace'ler minified gorunur. SENTRY_AUTH_TOKEN'i EAS secret olarak ver.
const sentryPlugin =
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [
        [
          '@sentry/react-native/expo',
          {
            organization: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            url: process.env.SENTRY_URL || 'https://sentry.io/',
          },
        ],
      ]
    : [];

module.exports = {
  expo: {
    name: 'Kcalculate',
    slug: 'kcal-mobile',
    // 1.1.0 (G9): yeni yerel paketler geldi (expo-video, expo-video-thumbnails,
    // expo-clipboard) — OTA ile gidemez, yeni build sart. runtimeVersion policy
    // 'appVersion' oldugu icin bu satir ayni zamanda 1.0.7 cihazlarin bu paketi
    // ALMASINI engelleyen emniyet kilididir (OTA kanali yeni surume baglanir).
    // G20-S2 (mağaza hazırlığı): sürüm 1.1.0 olarak kalır. Build numarası EAS
    // remote'tan gelir (eas.json appVersionSource: 'remote' + production
    // autoIncrement) → aşağıdaki ios.buildNumber / android.versionCode alanları
    // EAS derlemesinde KULLANILMAZ; bilerek dokunulmadı.
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'kcal',
    jsEngine: 'hermes',
    // İzin metinleri varsayılan (TR) infoPlist/plugin seçeneklerinde; EN cihazlar
    // için üstüne biner (G8-S3). TR dosyası yalnız açıklık için — aynı metinler.
    locales: {
      tr: './locales/tr.json',
      en: './locales/en.json',
    },
    assetBundlePatterns: ['**/*'],
    notification: {
      icon: './assets/notification-icon.png',
      color: '#B9EF14',
      iosDisplayInForeground: true,
      androidMode: 'default',
      androidCollapsedTitle: 'Kcalculate',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.kcalmobile.app',
      buildNumber: '1',
      userInterfaceStyle: 'automatic',
      // DERİN BAĞLANTI (G5-S4, G20-S2) — Universal Links. l.eatkcal.com'daki
      // .well-known/apple-app-site-association bu bundle'a
      // (A63MT69ASR.com.kcalmobile.app) /p/* (gönderi), /u/* (profil),
      // /k/* (kutu kartı QR), /s/* (saha kodu) ve /kesfet yollarını eşler.
      // İçerik: docs/store/well-known/apple-app-site-association (web'e konacak).
      // Alan adı tek giriş yeterli; yollar AASA'da. Yeni build şart (OTA değil).
      associatedDomains: ['applinks:l.eatkcal.com'],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.',
        NSMicrophoneUsageDescription:
          'Sesle yemek eklerken söylediklerini yazıya çevirmek ve video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
        // G22-S1 md.1: sesle ekleme — telefonun konuşma tanıması (EN: locales/en.json).
        NSSpeechRecognitionUsageDescription:
          'Söylediğin yemekler telefonun konuşma tanımasıyla yazıya çevrilir. Ses kaydın saklanmaz; kalori tahmini için yalnız yazıya dökülen metin gönderilir.',
        NSPhotoLibraryUsageDescription:
          'Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir.',
        NSPhotoLibraryAddUsageDescription:
          'Paylaşım kartlarını ve görselleri fotoğraflarına kaydetmek için izin gereklidir.',
        NSLocationWhenInUseUsageDescription:
          'Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.',
      },
      // GİZLİLİK MANİFESTİ (2026-11-03, G3-S1) — prebuild bundan
      // ios/Kcalculate/PrivacyInfo.xcprivacy'yi üretir. Her veri tipi kodda
      // GERÇEKTEN toplanan veridir; satır referansları docs/night/G3-S1-LOG.md.
      //   · G26-S1: NSPrivacyTracking: false — ATT kaldırıldı, uygulama izleme
      //     YAPMAZ (IDFA yok, setAdvertiserTrackingEnabled(false)). Meta olayları
      //     ATT'siz AEM / SKAdNetwork ile toplu ölçüm. NSPrivacyTrackingDomains
      //     yok (FBSDK'nın kendi manifesti ep1.facebook.com'u ayrıca bildirir;
      //     ATT izni olmadığı için iOS o alana bağlantıyı zaten engeller).
      //   · Required-reason API'ler (FileTimestamp/UserDefaults/BootTime/
      //     DiskSpace) mevcut native dosyadan BİREBİR taşındı — kaybolmasın.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyCollectedDataTypes: [
          {
            // auth (OTP/Apple/Google) — src/core/AuthContext.tsx
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // profiles.name + Apple FULL_NAME scope — AuthContext / postSocialAuth.ts
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // profiles.phone / orders / addresses
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // teslimat adresleri — addresses / CheckoutScreen
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhysicalAddress',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // expo-location (when-in-use) — adres doğrulama / en yakın şube
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // boy/kilo/yaş + hedef — user_nutrition_profiles (NutritionProfileScreen)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeHealth',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // kalori/makro takibi — meal_logs / Tracker
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeFitness',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // profil/görsel seçimi — expo-image-picker; G20-S2: + AI tarama
            // fotoğrafı (user-media, Anthropic'e tahmin için), Keşfet foto/video, destek eki
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // G20-S2 — Keşfet video gönderilerinin ses izi (galeriden seçilen video)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeAudioData',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // G20-S2 — gönderi metni, yorum, değerlendirme (kesfet/client.ts create_post, orderFeedback)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // G20-S2 — destek talepleri (support_tickets, SupportScreen)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCustomerSupport',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // G20-S2 — kayıtlı kart: son 4 hane, marka, banka, kart jetonu
            // (user_cards / user_card_secrets, Paynkolay kart saklama). Kart numarası
            // uygulamada girilmez ama geliştirici jeton + son 4 haneyi saklıyor.
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePaymentInfo',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // siparişler + Meta logPurchase — orders / PaymentScreen / analytics.ts (G26: izleme yok)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              'NSPrivacyCollectedDataTypePurposeAnalytics',
              'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            ],
          },
          {
            // Meta app events (ViewedContent/AddToCart/…) + analytics_events — src/lib/analytics.ts (G26: izleme yok)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              'NSPrivacyCollectedDataTypePurposeAnalytics',
              'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            ],
          },
          {
            // G26-S1: IDFA TOPLANMAZ (ATT yok). Yalnız anon_id (cihazda kalıcı kurulum
            // kimliği, analytics_events, G20-S2) → birinci taraf Analytics.
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            // Supabase kullanıcı kimliği — analytics_events.user_id
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              'NSPrivacyCollectedDataTypePurposeAnalytics',
            ],
          },
          {
            // Sentry — src/lib/sentry.ts. G20-S2: Linked true — sentry.ts:68
            // Sentry.setUser({ id: userId }) kullanıcı UUID'sini olaya bağlıyor.
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // Sentry performans — src/lib/sentry.ts (setUser → Linked true, G20-S2)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
        ],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1', 'C56D.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
            NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
          },
        ],
      },
    },
    android: {
      package: 'com.kcalmobile.app',
      versionCode: 10,
      // G23-S1: Android'de koyu tema yalnız expo-system-ui kuruluyken uygulanır (prebuild-config
      // otomatik eklentisi; İlter 10 Kas onayı). Yeni native derleme gerekir.
      userInterfaceStyle: 'automatic',
      adaptiveIcon: {
        backgroundColor: '#000000',
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundImage: './assets/adaptive-icon-background.png',
        monochromeImage: './assets/adaptive-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // DERİN BAĞLANTI (G5-S4, G20-S2) — Android App Links. autoVerify, l.eatkcal.com'daki
      // .well-known/assetlinks.json ile imza parmak izini eşleştirir (parmak izi
      // İlter tarafından eklenecek — bkz. docs/store/well-known/README.md).
      // Yollar AASA ile aynı: /p/ /u/ /k/ /s/ + tam /kesfet. Önek SONUNDA "/"
      // var: eski '/p' öneki l.eatkcal.com/privacy sayfasını da uygulamaya
      // çekiyordu (pathPrefix '/p' → '/privacy' eşleşir). Diğer yollar
      // (privacy, terms, account-deletion) tarayıcıda açılır. Yeni build şart.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/p/' },
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/u/' },
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/k/' },
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/s/' },
            { scheme: 'https', host: 'l.eatkcal.com', path: '/kesfet' },
          ],
        },
      ],
      // READ/WRITE_EXTERNAL_STORAGE KALDIRILDI (2026-11-03, G3-S1): Android 13+
      // (API 33) bunları yok sayar; expo-image-picker Foto Seçici (Photo Picker)
      // kullandığı için depolama izni gerekmiyor (kodda MediaLibrary/dosya
      // yazımı yok). Play "hassas izin" incelemesini gereksiz yere tetikliyordu.
      permissions: [
        'CAMERA',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        // G22-S1 md.1: sesle ekleme (expo-speech-recognition). Ses kaydı saklanmaz.
        'RECORD_AUDIO',
      ],
      // G26-S1 md.9: introspect'te prebuild şablonundan gelen kullanılmayan izinler
      // (depolama — Foto Seçici izinsiz; SYSTEM_ALERT_WINDOW — yalnız geliştirme katmanı)
      // birleştirilmiş manifestten de silinir (tools:node="remove").
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      // FAZ L — react-native-maps (Android zorunlu). Ayrı, kısıtlı bir Android
      // key (sadece "Maps SDK for Android") kullanılır; tanımlı değilse genel
      // EXPO_PUBLIC_GOOGLE_MAPS_KEY'e düşer. iOS PROVIDER_DEFAULT (Apple Maps)
      // kullanıyor, ek key gerekmiyor.
      config: {
        googleMaps: {
          apiKey:
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ||
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/5a65d66c-617a-423a-8346-d6a19e1bfca8',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: { policy: 'appVersion' },
    extra: {
      eas: {
        projectId: '5a65d66c-617a-423a-8346-d6a19e1bfca8',
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
      EXPO_PUBLIC_PAYMENT_PROVIDER: process.env.EXPO_PUBLIC_PAYMENT_PROVIDER,
      EXPO_PUBLIC_GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
      // Google OAuth client ID'leri gizli değil (app bundle'ında zaten görünür) —
      // .env yerine doğrudan burada.
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
        '173333296344-d04r7n8hosc79b1pvjrg5e30pbq4cjss.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
        '173333296344-vnu2l4uv6a71hsl26afltb5gpg0bl3jq.apps.googleusercontent.com',
      // Bos birakilirsa Sentry hic baslatilmaz (bkz. src/lib/sentry.ts).
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    },
    plugins: [
      ...sentryPlugin,
      'expo-asset',
      [
        // Fontlar BUILD'e gömülür. Çıplak 'expo-font' ile yalnızca çalışma
        // zamanında (useFonts) yükleniyorlardı; Android + Fabric'te metin
        // typeface kaydolmadan ölçülebiliyor ve bazı OEM ROM'ları sonradan
        // yeniden çizmediği için sistem fontuna düşüyordu. Gömülü fontta bu
        // yarış hiç oluşmuyor. useFonts çağrısı aynı isimleri kullandığı
        // için ikisi bir arada sorunsuz çalışır.
        'expo-font',
        {
          fonts: [
            './node_modules/@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf',
            './node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
            './node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf',
            './node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf',
            './node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
            // G16-S2: Final başlık fontu da gömülü (Android aile adı = dosya adı).
            './assets/fonts/BricolageGrotesque_400Regular.ttf',
            './assets/fonts/BricolageGrotesque_500Medium.ttf',
            './assets/fonts/BricolageGrotesque_600SemiBold.ttf',
            './assets/fonts/BricolageGrotesque_700Bold.ttf',
            './assets/fonts/BricolageGrotesque_800ExtraBold.ttf',
          ],
        },
      ],
      [
        'expo-splash-screen',
        {
          // Splash = app icon (icon.png, tek kare amblem) → ana ekran ikonuyla
          // tutarlı. imageWidth ekranı kaplamayan, kenar boşluklu makul boyut.
          // backgroundColor icon.png'nin zemini (#000000) ile aynı → görünür
          // kare kenar oluşmaz. adaptiveIcon backgroundColor da #000000 (eşit).
          image: './assets/icon.png',
          imageWidth: 170,
          resizeMode: 'contain',
          backgroundColor: '#000000',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir.',
          cameraPermission:
            'Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.',
          microphonePermission:
            'Sesle yemek eklerken söylediklerini yazıya çevirmek ve video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
        },
      ],
      // G17-S2 md.1/3 (İlter onayı 7 Kas 15:35): canlı Tara vizörü. İzin metni
      // locales/tr.json `ios.NSCameraUsageDescription` ile birebir (EN çevirisi
      // locales/en.json'dan gelir). Android: yalnız CAMERA (ses kaydı yok →
      // RECORD_AUDIO eklenmez). YENİ NATIVE DERLEME gerekir (OTA değil).
      [
        'expo-camera',
        {
          cameraPermission:
            'Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.',
          microphonePermission:
            'Sesle yemek eklerken söylediklerini yazıya çevirmek ve video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
          recordAudioAndroid: false,
        },
      ],
      'expo-video',
      // G22-S1 md.1 (İlter paket izni 10 Kas): sesle ekleme — telefonun konuşma tanıması.
      // iOS NSSpeechRecognitionUsageDescription + NSMicrophoneUsageDescription (aynı metinler),
      // Android RECORD_AUDIO + Google konuşma hizmeti görünürlüğü. YENİ NATIVE DERLEME gerekir.
      [
        'expo-speech-recognition',
        {
          microphonePermission:
            'Sesle yemek eklerken söylediklerini yazıya çevirmek ve video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
          speechRecognitionPermission:
            'Söylediğin yemekler telefonun konuşma tanımasıyla yazıya çevrilir. Ses kaydın saklanmaz; kalori tahmini için yalnız yazıya dökülen metin gönderilir.',
          androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.as'],
        },
      ],
      // expo-image-manipulator (~14.0.8, G19-S1 Tara uzun kenar ≤ 1600): bu
      // paketin config plugin'i YOK (app.plugin.js yok) → plugins dizisine
      // eklenemez (eklenirse `expo config` "does not contain a valid config
      // plugin" hatası verir). Yerel modül autolinking ile derlemeye girer;
      // izin/Info.plist gerektirmez. YENİ NATIVE DERLEME şart (G20-S2 KARAR).
      [
        'expo-location',
        {
          // G20-S2: yalnız "uygulama kullanılırken" konum. Önceden yalnız
          // AlwaysAndWhenInUse verildiği için eklenti NSLocationAlwaysUsageDescription'ı
          // İngilizce varsayılanla ("Allow $(PRODUCT_NAME) to access your location")
          // Info.plist'e yazıyordu; uygulama arka plan konumu KULLANMIYOR.
          // false = anahtarı Info.plist'ten sil (config-plugins applyPermissions).
          locationWhenInUsePermission:
            'Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#B9EF14',
          defaultChannel: 'default',
          sounds: [],
        },
      ],
      'expo-apple-authentication',
      [
        '@react-native-google-signin/google-signin',
        {
          // REVERSED_CLIENT_ID (Google iOS OAuth client) — iOS deep link geri
          // dönüşü için gerekli. EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ile eşleşir.
          iosUrlScheme:
            'com.googleusercontent.apps.173333296344-d04r7n8hosc79b1pvjrg5e30pbq4cjss',
        },
      ],
      // G26-S1 (İlter 11 Kas): expo-tracking-transparency (ATT) KALDIRILDI — Apple izleme
      // sorusu yok, NSUserTrackingUsageDescription Info.plist'e yazılmaz. Meta ölçümü ATT'siz
      // (AEM / SKAdNetwork); iOS'ta setAdvertiserTrackingEnabled(false) sabit (analytics.ts).
      [
        'react-native-fbsdk-next',
        {
          // Meta uygulaması "KCAL" (Graph API ile doğrulandı, 2026-09-19): appID ve clientToken
          // gerçek değerler (clientToken istemci tarafı token'ıdır, bundle'da görünmesi normal).
          // scheme: "fb<META_APP_ID>" (fb prefix zorunlu) — iOS deep link.
          appID: '4403872953189106',
          clientToken: '99ec21a60f8699f2534e3aaa52951f73',
          displayName: 'KCAL',
          scheme: 'fb4403872953189106',
          // SDK açılışta OTOMATİK başlatılmaz ve IDFA'yı TOPLAMAZ (G3-S1).
          // G26-S1: ATT yok → src/lib/analytics.ts iOS'ta
          // setAdvertiserTrackingEnabled(false) + setAdvertiserIDCollectionEnabled(false)
          // SABİT çağırır, SONRA initializeSDK(). iosUserTrackingPermission VERİLMEZ
          // (verilirse eklenti NSUserTrackingUsageDescription yazar).
          advertiserIDCollectionEnabled: false,
          // G27-S1: otomatik olaylar varsayılan KAPALI (KVKK açık rıza); analytics.ts yalnız
          // reklam tercihi açıkça 'açık' ise setAutoLogAppEventsEnabled(true) çağırır.
          autoLogAppEventsEnabled: false,
          isAutoInitEnabled: false,
        },
      ],
    ],
  },
};
