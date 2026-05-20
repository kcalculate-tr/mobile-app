import { Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

let initialized = false;

export const initFBSDK = async (): Promise<void> => {
  if (initialized) return;
  try {
    Settings.initializeSDK();
    if (Platform.OS === 'ios') {
      // ATT izni alındıysa IDFA toplama açılır. İzin akışını ayrı bir
      // pakete (expo-tracking-transparency) bağlamadan sadece mevcut
      // durumu yansıtıyoruz; izin yoksa Meta limited-data moduna düşer.
      try {
        const enabled = await Settings.getAdvertiserTrackingEnabled();
        await Settings.setAdvertiserTrackingEnabled(!!enabled);
      } catch {
        // sessiz: ATT API mevcut değilse (eski iOS) atla
      }
    }
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
