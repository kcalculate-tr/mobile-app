import React, { useEffect, useState } from 'react';
import { Text, TextInput, View, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PortalProvider } from '@gorhom/portal';
import ErrorBoundary from 'react-native-error-boundary';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

SplashScreen.preventAutoHideAsync();
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from './src/lib/notifications';
import { navigationRef } from './src/navigation/navigationRef';
import { ErrorFallback } from './src/components/ErrorBoundary';
import KeyboardToolbar from './src/components/KeyboardToolbar';
import { setupGlobalErrorHandler, setupAppStateListener } from './src/lib/reliability';

setupGlobalErrorHandler();


function AppContent() {
  const { session } = useAuth();

  // Notification listener'ı session'dan bağımsız mount et — cold-start'taki
  // tap response'unu yakalayabilmek için. Token register'ı session olunca yap.
  useEffect(() => {
    const cleanup = setupNotificationListeners(navigationRef);
    return cleanup;
  }, []);

  useEffect(() => {
    if (!session) return;
    registerForPushNotifications().catch((error) => {
      console.warn('[Push Notifications] Auto-register failed:', error);
    });
  }, [session]);

  useEffect(() => {
    const cleanup = setupAppStateListener(
      () => {
        console.log('[App] Returned from background - refreshing session');
      },
      () => {
        console.log('[App] Going to background');
      },
    );

    return cleanup;
  }, []);

  return <AppNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Premium intro: fontlar hazır olunca native splash'ı gizle, ~1.2s siyah
  // + KCAL logosu overlay göster, sonra gerçek app'e geç. fontsLoaded zaten
  // "hazır" sinyali — ayrı appReady state'i gereksiz olurdu.
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setIntroVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // Global font override — tüm Text bileşenleri Plus Jakarta Sans kullanır
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };
  (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
  (TextInput as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };

  if (introVisible) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('./assets/kcal-onboard-logo.png')}
          style={{ width: 200, height: 76 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <SafeAreaProvider>
        <PortalProvider>
          <AuthProvider>
            <NavigationContainer ref={navigationRef}>
              <AppContent />
            </NavigationContainer>
          </AuthProvider>
          <KeyboardToolbar />
          <StatusBar style="auto" />
        </PortalProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
