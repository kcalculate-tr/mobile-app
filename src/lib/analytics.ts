import { Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import * as TrackingTransparency from 'expo-tracking-transparency';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getSupabaseClient } from './supabase';

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

// ─── Görev 1.2: analytics_events (tek olay tablosu) ─────────────────────────
//
// NOT: Mevcut 5 Meta event'i (yukarıdaki logEvent.*) kasıtlı olarak burada
// otomatik tetiklenmiyor — çağıranlar hem logEvent.xxx(...) hem track(...) çağırır
// (bkz. ProductDetailScreen/cartStore/CheckoutScreen/PaymentScreen). Böylece
// Meta'ya giden veri/parametreler ve çağrı sırası hiç değişmez, çift event riski
// olmaz. track() yalnızca Supabase'e yazar.
//
// Meta'ya ASLA gönderilmeyenler: marj/maliyet (order_financials ayrı, kilitli
// bir view), telefon, e-posta, beslenme verisi. track() bu alanları zaten hiç
// almıyor/Meta'ya iletmiyor.

const ANON_ID_KEY = '@kcal_analytics_anon_id';
const QUEUE_KEY = '@kcal_analytics_queue';
const MAX_QUEUE_SIZE = 50;

const genId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// Modül yüklendiğinde (soğuk başlangıçta) bir kez üretilir — JS motoru
// yeniden başlamadıkça (uygulama kapatılıp açılmadıkça) sabit kalır.
const sessionId = genId();
let cachedAnonId: string | null = null;

const getAnonId = async (): Promise<string> => {
  if (cachedAnonId) return cachedAnonId;
  try {
    const stored = await AsyncStorage.getItem(ANON_ID_KEY);
    if (stored) {
      cachedAnonId = stored;
      return stored;
    }
    const fresh = genId();
    await AsyncStorage.setItem(ANON_ID_KEY, fresh);
    cachedAnonId = fresh;
    return fresh;
  } catch {
    return genId();
  }
};

type AnalyticsRow = {
  event_name: string;
  props: Record<string, unknown>;
  user_id: string | null;
  anon_id: string;
  session_id: string;
  platform: string;
  app_version: string;
  created_at: string;
};

const readQueue = async (): Promise<AnalyticsRow[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsRow[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: AnalyticsRow[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    /* kuyruk yazılamadıysa event kaybolur — track() zaten best-effort */
  }
};

let flushing = false;

// Kuyruktaki (önceki başarısız) event'leri göndermeyi dener. Basit tutuldu:
// her track() çağrısında bir kez denenir, tekrar başarısız olursa kuyrukta kalır.
const flushQueue = async (): Promise<void> => {
  if (flushing) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('analytics_events').insert(queue);
    if (!error) await writeQueue([]);
  } catch {
    /* sessizce yut, kuyruk kalıcı kalır */
  } finally {
    flushing = false;
  }
};

/**
 * Tek analytics giriş noktası. Supabase `analytics_events` tablosuna yazar;
 * hata uygulamayı bozmaz (sessizce loglanır, kuyruğa alınıp bir sonraki
 * track() çağrısında tekrar denenir). Meta'ya YÖNLENDİRME yapmaz — bkz.
 * yukarıdaki not.
 */
export const track = (eventName: string, props: Record<string, unknown> = {}): void => {
  void (async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const anonId = await getAnonId();
      const row: AnalyticsRow = {
        event_name: eventName,
        props,
        user_id: session?.user?.id ?? null,
        anon_id: anonId,
        session_id: sessionId,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? '0.0.0',
        created_at: new Date().toISOString(),
      };

      await flushQueue();

      const { error } = await supabase.from('analytics_events').insert(row);
      if (error) {
        if (__DEV__) console.warn(`[analytics] track(${eventName}) failed, queued:`, error.message);
        const queue = await readQueue();
        queue.push(row);
        await writeQueue(queue);
      } else if (__DEV__) {
        console.log(`[analytics] track(${eventName})`, props);
      }
    } catch (err) {
      if (__DEV__) console.warn(`[analytics] track(${eventName}) failed:`, err);
    }
  })();
};
