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
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
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
      userInterfaceStyle: 'light',
      // DERİN BAĞLANTI (G5-S4) — Universal Links. l.eatkcal.com'daki
      // .well-known/apple-app-site-association (Vercel landing-page) bu bundle'a
      // (A63MT69ASR.com.kcalmobile.app) /p/* ve /u/* yollarını eşler. Alan adı
      // yayına girene ve YENİ BUILD çıkana kadar mevcut 1.0.7 cihazlarda etkisiz.
      associatedDomains: ['applinks:l.eatkcal.com'],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Tabağını tarayıp kalorisini tahmin etmek, profil fotoğrafı çekmek, video kaydetmek ve ürün görselleri yüklemek için kameraya erişim gereklidir.',
        NSMicrophoneUsageDescription:
          'Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
        NSPhotoLibraryUsageDescription:
          'Tabak fotoğrafını taramak, profil fotoğrafı, görsel ve video seçmek için fotoğraf kütüphanesine erişim gereklidir.',
        NSPhotoLibraryAddUsageDescription:
          'Siparişlerinize ait görselleri fotoğraflarınıza kaydetmek için izin gereklidir.',
        NSLocationWhenInUseUsageDescription:
          'Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.',
      },
      // GİZLİLİK MANİFESTİ (2026-11-03, G3-S1) — prebuild bundan
      // ios/Kcalculate/PrivacyInfo.xcprivacy'yi üretir. Her veri tipi kodda
      // GERÇEKTEN toplanan veridir; satır referansları docs/night/G3-S1-LOG.md.
      //   · NSPrivacyTracking: true — Meta SDK + ATT + SKAdNetwork aktif.
      //   · NSPrivacyTrackingDomains: FBSDK'nın kendi manifestiyle aynı
      //     (ep1.facebook.com); app seviyesinde true + boş domain = Apple reddi.
      //   · Required-reason API'ler (FileTimestamp/UserDefaults/BootTime/
      //     DiskSpace) mevcut native dosyadan BİREBİR taşındı — kaybolmasın.
      privacyManifests: {
        NSPrivacyTracking: true,
        NSPrivacyTrackingDomains: ['ep1.facebook.com'],
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
            // profil/görsel seçimi — expo-image-picker
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // siparişler + Meta logPurchase — orders / PaymentScreen / analytics.ts
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: true,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              'NSPrivacyCollectedDataTypePurposeAnalytics',
              'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            ],
          },
          {
            // Meta app events (ViewedContent/AddToCart/…) + analytics_events — src/lib/analytics.ts
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: true,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              'NSPrivacyCollectedDataTypePurposeAnalytics',
              'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            ],
          },
          {
            // IDFA — react-native-fbsdk-next (ATT sonrası, analytics.ts)
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: true,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising'],
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
            // Sentry — src/lib/sentry.ts
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // Sentry performans — src/lib/sentry.ts
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
            NSPrivacyCollectedDataTypeLinked: false,
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
      userInterfaceStyle: 'light',
      adaptiveIcon: {
        backgroundColor: '#000000',
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundImage: './assets/adaptive-icon-background.png',
        monochromeImage: './assets/adaptive-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // DERİN BAĞLANTI (G5-S4) — Android App Links. autoVerify, l.eatkcal.com'daki
      // .well-known/assetlinks.json ile imza parmak izini eşleştirir (parmak izi
      // İlter tarafından eklenecek — bkz. docs/night/G5-S4-LINKS.md). Yalnız /p
      // ve /u yolları; diğer yollar tarayıcıda açılır. Alan adı + yeni build şart.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/p' },
            { scheme: 'https', host: 'l.eatkcal.com', pathPrefix: '/u' },
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
            'Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
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
            'Video paylaşırken sesi kaydetmek için mikrofona erişim gereklidir.',
          recordAudioAndroid: false,
        },
      ],
      'expo-video',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.',
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
      [
        'expo-tracking-transparency',
        {
          // G20-S1: ATT amacı rıza bloğuyla aynı (reklam ölçümü — kişiselleştirilmiş reklam DEĞİL).
          // EN: locales/en.json ios.NSUserTrackingUsageDescription.
          userTrackingPermission:
            'Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin.',
        },
      ],
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
          // ATT UYUMU (2026-11-03, G3-S1): SDK açılışta OTOMATİK başlatılmaz ve
          // IDFA'yı varsayılan olarak TOPLAMAZ. src/lib/analytics.ts önce ATT
          // iznini ister, izin verilirse setAdvertiserTrackingEnabled(true) +
          // setAdvertiserIDCollectionEnabled(true) çağırır, SONRA
          // initializeSDK() der. Böylece ATT onayından önce IDFA okunmaz
          // (Apple 5.1.2). Önceki true/true/true değerleri auto-init ile bu
          // sırayı atlayıp izin öncesi IDFA okuyabiliyordu.
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: false,
          iosUserTrackingPermission:
            'Reklam kampanyalarımızın etkisini ölçmek için bu izni istiyoruz. İzin vermesen de uygulamanın tamamını kullanabilirsin.',
        },
      ],
    ],
  },
};
