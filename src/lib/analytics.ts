import { Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import * as TrackingTransparency from 'expo-tracking-transparency';

let initialized = false;

export const initFBSDK = async (): Promise<void> => {
  if (initialized) return;
  try {
    // Önemli sıra: iOS'ta ATT prompt'unu explicit tetikle ve advertiser
    // tracking durumunu set et, SDK init'i ondan SONRA çağır. Tersi sırada
    // Meta IDFA'yı izin gelmeden okumaya çalışır.
    if (Platform.OS === 'ios') {
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      const granted = status === 'granted';
      await Settings.setAdvertiserTrackingEnabled(granted);
      if (__DEV__) console.log('[analytics] ATT status:', status);
    }
    Settings.initializeSDK();
    initialized = true;
    if (__DEV__) console.log('[analytics] FB SDK initialized');
  } catch (err) {
    if (__DEV__) console.warn('[analytics] FB SDK init failed:', err);
  }
};

const safeLog = (eventName: string, params: Record<string, string | number>): void => {
  try {
    if (__DEV__) console.log(`[analytics] event=${eventName}`, params);
    AppEventsLogger.logEvent(eventName, params);
  } catch (err) {
    if (__DEV__) console.warn(`[analytics] logEvent ${eventName} failed:`, err);
  }
};

export const logEvent = {
  viewContent: (productId: string, productName: string, price: number): void => {
    safeLog(AppEventsLogger.AppEvents.ViewedContent, {
      content_id: productId,
      content_name: productName,
      currency: 'TRY',
      value: price,
    });
  },

  addToCart: (productId: string, price: number, quantity: number): void => {
    safeLog(AppEventsLogger.AppEvents.AddedToCart, {
      content_id: productId,
      currency: 'TRY',
      value: Number((price * quantity).toFixed(2)),
      num_items: quantity,
    });
  },

  initiateCheckout: (totalValue: number, numItems: number): void => {
    safeLog(AppEventsLogger.AppEvents.InitiatedCheckout, {
      currency: 'TRY',
      value: Number(totalValue.toFixed(2)),
      num_items: numItems,
    });
  },

  purchase: (orderId: string, totalValue: number): void => {
    try {
      if (__DEV__) {
        console.log('[analytics] event=Purchase', { orderId, totalValue });
      }
      AppEventsLogger.logPurchase(Number(totalValue.toFixed(2)), 'TRY', {
        order_id: orderId,
      });
    } catch (err) {
      if (__DEV__) console.warn('[analytics] logPurchase failed:', err);
    }
  },

  completeRegistration: (method: string): void => {
    safeLog(AppEventsLogger.AppEvents.CompletedRegistration, {
      registration_method: method,
    });
  },
};
