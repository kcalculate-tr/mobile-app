import React, { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
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
import { RootStackParamList } from './src/navigation/types';
import { ErrorFallback } from './src/components/ErrorBoundary';
import KeyboardToolbar from './src/components/KeyboardToolbar';
import { setupGlobalErrorHandler, setupAppStateListener } from './src/lib/reliability';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

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

  if (!fontsLoaded) return null;
  SplashScreen.hideAsync();

  // Global font override — tüm Text bileşenleri Plus Jakarta Sans kullanır
  (Text as any).defaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };
  (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
  (TextInput as any).defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };

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
