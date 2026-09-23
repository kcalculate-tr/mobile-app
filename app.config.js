module.exports = {
  expo: {
    name: 'Kcalculate',
    slug: 'kcal-mobile',
    version: '1.0.6',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'kcal',
    jsEngine: 'hermes',
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
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          'Profil fotoğrafınızı çekmek ve ürün görsellerini yüklemek için kameraya erişim gereklidir.',
        NSPhotoLibraryUsageDescription:
          'Profil fotoğrafı ve görsel seçmek için fotoğraf kütüphanesine erişim gereklidir.',
        NSPhotoLibraryAddUsageDescription:
          'Siparişlerinize ait görselleri fotoğraflarınıza kaydetmek için izin gereklidir.',
        NSLocationWhenInUseUsageDescription:
          'Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.',
      },
    },
    android: {
      package: 'com.kcalmobile.app',
      versionCode: 9,
      userInterfaceStyle: 'light',
      adaptiveIcon: {
        backgroundColor: '#000000',
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundImage: './assets/adaptive-icon-background.png',
        monochromeImage: './assets/adaptive-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
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
    },
    plugins: [
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
            'Profil fotoğrafı ve görsel seçmek için fotoğraf kütüphanesine erişim gereklidir.',
          cameraPermission:
            'Profil fotoğrafınızı çekmek için kameraya erişim gereklidir.',
        },
      ],
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
      'expo-video',
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
          userTrackingPermission:
            'KCAL, size daha alakalı reklamlar gösterebilmek için bu izni istiyor.',
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
          advertiserIDCollectionEnabled: true,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: true,
          iosUserTrackingPermission:
            'KCAL, size daha alakalı reklamlar gösterebilmek için bu izni istiyor.',
        },
      ],
    ],
  },
};
