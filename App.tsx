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

  useEffect(() => {
    if (!session) return;

    let notificationCleanup: (() => void) | undefined;

    try {
      registerForPushNotifications();

      notificationCleanup = setupNotificationListeners(
        () => {},
        (response) => {
          try {
            const data = response.notification.request.content.data as Record<string, unknown>;
            if (data?.orderId && navigationRef.isReady()) {
              navigationRef.navigate('OrderDetail', { orderId: Number(data.orderId) });
            }
          } catch (error) {
            console.error('[Notification Handler] Error:', error);
          }
        },
      );
    } catch (error) {
      console.error('[Push Notifications] Setup failed:', error);
    }

    return () => {
      notificationCleanup?.();
    };
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
