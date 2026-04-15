module.exports = {
  expo: {
    name: 'KCAL',
    slug: 'kcal-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'kcal',
    jsEngine: 'hermes',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
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
      package: 'com.kcal.mobile',
      versionCode: 1,
      userInterfaceStyle: 'light',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
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
          icon: './assets/icon.png',
          color: '#C6F04F',
        },
      ],
      'expo-video',
    ],
  },
};
