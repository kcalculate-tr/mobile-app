import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { resolveNavigation } from './navigation';

export const PUSH_PERMISSION_FLAG = '@kcal_push_permission_status';

// Foreground'da notification nasıl gösterilsin
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | null {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    null
  );
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#C6F04F',
    sound: 'default',
  });
}

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

// Sadece izin ister + AsyncStorage flag'e yazar (token almaz, DB'ye dokunmaz)
// Onboarding son step'inde çağrılır — kullanıcı henüz auth olmamış olabilir.
export async function requestPushPermissionOnly(): Promise<PushPermissionStatus> {
  try {
    if (!Device.isDevice) {
      await AsyncStorage.setItem(PUSH_PERMISSION_FLAG, 'undetermined');
      return 'undetermined';
    }
    await setupAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status as PushPermissionStatus;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status as PushPermissionStatus;
    }
    await AsyncStorage.setItem(PUSH_PERMISSION_FLAG, status);
    return status;
  } catch (e) {
    console.warn('[push] permission ask error:', e);
    return 'undetermined';
  }
}

export type RegisterResult = {
  success: boolean;
  token?: string;
  error?: string;
};

// İzin + token al + push_tokens tablosuna upsert.
// Auth sonrası (login/register) çağrılır. Daha önce reddedildiyse token istemez.
export async function registerForPushNotifications(): Promise<RegisterResult> {
  try {
    if (!Device.isDevice) {
      return { success: false, error: 'Physical device required' };
    }

    await setupAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (existing.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      await AsyncStorage.setItem(PUSH_PERMISSION_FLAG, 'denied');
      return { success: false, error: 'Permission denied' };
    }
    await AsyncStorage.setItem(PUSH_PERMISSION_FLAG, 'granted');

    const projectId = getProjectId();
    if (!projectId) {
      return { success: false, error: 'EAS projectId not found' };
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult.data;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const deviceType = (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web')
      ? (Platform.OS as 'ios' | 'android' | 'web')
      : null;
    const deviceName = Device.deviceName ?? Device.modelName ?? 'Unknown';
    const appVersion = Constants.expoConfig?.version ?? '0.0.0';

    const { error: upsertError } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: token,
          device_type: deviceType,
          device_name: deviceName,
          app_version: appVersion,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' },
      );

    if (upsertError) {
      console.error('[push] token upsert error:', upsertError.message);
      return { success: false, error: upsertError.message };
    }

    if (__DEV__) {
      console.log('[push] token registered:', token.substring(0, 24) + '...');
    }
    return { success: true, token };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[push] register error:', message);
    return { success: false, error: message };
  }
}

// Logout / hesap silme öncesi cihaz token'ını deaktive et.
// Sessiz fail — logout akışı bloklamasın.
export async function unregisterPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const projectId = getProjectId();
    if (!projectId) return;

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });

    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('expo_push_token', tokenResult.data);
  } catch (e) {
    console.warn('[push] unregister error:', e);
  }
}

type NavigationLike = {
  isReady: () => boolean;
  navigate: (...args: any[]) => void;
};

// Notification dinleyicileri. App.tsx'te NavigationContainer ref ile mount.
// navigationRef: createNavigationContainerRef sonucu — `.isReady()` ve
// `.navigate()` metotları olan nesne.
export function setupNotificationListeners(
  navigationRef: NavigationLike | null,
): () => void {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) {
      console.log('[push] received:', notification.request.content.title);
    }
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const deepLink =
        (typeof data.deep_link === 'string' && data.deep_link) ||
        (typeof data.deepLink === 'string' && data.deepLink) ||
        null;
      const sendId = typeof data.send_id === 'string' ? data.send_id : null;
      const orderId = data.orderId != null ? Number(data.orderId) : null;

      // opened_at analytics (Aşama 2'den itibaren admin send'lerinde send_id gelir)
      if (sendId) {
        supabase
          .from('notification_sends')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', sendId)
          .then(({ error }) => {
            if (error && __DEV__) console.warn('[push] opened update error:', error.message);
          });
      }

      if (!navigationRef) return;

      // Cold start: navigation henüz ready olmayabilir, kısa bir delay ver
      const dispatch = () => {
        if (!navigationRef.isReady()) return;
        if (deepLink) {
          resolveNavigation(navigationRef, deepLink);
        } else if (orderId && Number.isFinite(orderId)) {
          navigationRef.navigate('OrderDetail', { orderId });
        }
      };

      if (navigationRef.isReady()) {
        dispatch();
      } else {
        setTimeout(dispatch, 500);
      }
    } catch (e) {
      console.error('[push] response handler error:', e);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
