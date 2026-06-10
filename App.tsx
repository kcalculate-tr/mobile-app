import React, { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
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
import ForceUpdateModal from './src/components/ForceUpdateModal';
import { checkForceUpdate } from './src/lib/forceUpdate';
import KeyboardToolbar from './src/components/KeyboardToolbar';
import { setupGlobalErrorHandler, setupAppStateListener } from './src/lib/reliability';
import { initFBSDK } from './src/lib/analytics';

setupGlobalErrorHandler();

// Tüm navigation katmanının arka planı sportive dark (#0A0A0A). Theme'siz
// NavigationContainer DefaultTheme'in açık gri (~#f2f2f2) background'ını
// kullanıyordu → OnboardingStack↔MainStack switch'inde beyaz flash.
const navDarkTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0A0A0A' },
};

function AppContent() {
  const { session } = useAuth();

  // Zorunlu güncelleme kontrolü — açılışta settings.min_supported_version'a göre.
  // Fail-open: kontrol başarısızsa kullanıcı kilitlenmez (checkForceUpdate içinde).
  const [forceUpdate, setForceUpdate] = useState(false);
  const [forceUpdateMessage, setForceUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    checkForceUpdate().then((res) => {
      if (res.required) {
        setForceUpdate(true);
        setForceUpdateMessage(res.message);
      }
    });
  }, []);

  // Notification listener'ı session'dan bağımsız mount et — cold-start'taki
  // tap response'unu yakalayabilmek için. Token register'ı session olunca yap.
  useEffect(() => {
    const cleanup = setupNotificationListeners(navigationRef);
    return cleanup;
  }, []);

  useEffect(() => {
    initFBSDK().catch((err) => {
      console.warn('[App] FB SDK init failed:', err);
    });
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

  return (
    <>
      <AppNavigator />
      <ForceUpdateModal visible={forceUpdate} message={forceUpdateMessage} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Fontlar hazır olunca native splash'ı gizle ve doğrudan uygulamaya geç.
  // Ayrı JS logo overlay yok → açılışta tek logo (native splash) görünür.
  // hideAsync KRİTİK: çağrılmazsa native splash hiç gizlenmez, app takılır.
  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // Global font override — tüm Text bileşenleri Plus Jakarta Sans kullanır
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };
  (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
  (TextInput as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <PortalProvider>
          <AuthProvider>
            <NavigationContainer ref={navigationRef} theme={navDarkTheme}>
              <AppContent />
            </NavigationContainer>
          </AuthProvider>
          <KeyboardToolbar />
          <StatusBar style="light" />
        </PortalProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
