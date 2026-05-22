module.exports = {
  expo: {
    name: 'Kcalculate',
    slug: 'kcal-mobile',
    version: '1.0.4',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'kcal',
    jsEngine: 'hermes',
    splash: {
      image: './assets/kcal-onboard-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0A',
    },
    assetBundlePatterns: ['**/*'],
    notification: {
      icon: './assets/notification-icon.png',
      color: '#C6F04F',
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
          'Teslimat adresinizi otomatik doldurmak için konumunuz kullanılır.',
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
    },
    plugins: [
      'expo-asset',
      'expo-font',
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
            'Teslimat adresinizi otomatik doldurmak için konumunuz kullanılır.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#C6F04F',
          defaultChannel: 'default',
          sounds: [],
        },
      ],
      'expo-video',
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
          // TODO(meta): META_APP_ID + CLIENT_TOKEN gerçek değerlerle değiştir.
          // Meta Business Suite → App Settings → Basic'ten alınacak.
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
