// G26-S1 md.6 — PushPermissionPrompt akışı: bildirim izni için TEK fonksiyon.
//
// Uygulamada `Notifications.requestPermissionsAsync` YALNIZ burada çağrılır (bekçi testi:
// src/lib/permissions/__tests__/noPromptSources.test.ts). Karar: pushPolicy.ts.
//  • İlk öğün kaydı sonrası açıklama ekranı (NotifyPermissionSheet / FinSheetNotify):
//    `canOfferPush('first_meal')` true ise gösterilir, "İzin ver" → `requestPushPermission('first_meal')`.
//  • Ayarlar › Bildirimler "Bildirimleri aç" → `enablePushFromSettings()`.
//  • Hatırlatma / seri / sosyal / plan modülleri → `pushGranted()` (izin yoksa sessizce geçer).
//  • Oturum açılınca → `registerForPushNotifications()` (izin YOKSA sormaz, yalnız jeton kaydı).
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PUSH_PERMISSION_FLAG, registerForPushNotifications, setupAndroidChannel } from '../notifications';
import { decidePush, type PushDecision, type PushSource, type PushStatus } from './pushPolicy';

/** Son sistem penceresi zamanı (ms). */
export const PUSH_ASKED_AT_KEY = '@kcal_push_asked_at';

async function readAskedAt(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_ASKED_AT_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function readStatus(): Promise<{ status: PushStatus; canAskAgain: boolean }> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { status: (p.status as PushStatus) ?? 'undetermined', canAskAgain: p.canAskAgain !== false };
  } catch {
    return { status: 'undetermined', canAskAgain: false };
  }
}

/** Sormadan: izin var mı? (Hatırlatma / seri / sosyal / plan modülleri bunu kullanır.) */
export async function pushGranted(): Promise<boolean> {
  return (await readStatus()).status === 'granted';
}

export async function pushDecision(source: PushSource, now = Date.now()): Promise<PushDecision> {
  const [{ status, canAskAgain }, askedAt] = await Promise.all([readStatus(), readAskedAt()]);
  return decidePush({ status, canAskAgain, askedAt, now, source });
}

/** Açıklama ekranı gösterilebilir mi? (gerçek cihaz + karar 'ask') */
export async function canOfferPush(source: PushSource): Promise<boolean> {
  if (!Device.isDevice) return false;
  return (await pushDecision(source)) === 'ask';
}

/**
 * Sistem penceresi (yalnız karar 'ask' ise). Sonuç kaydedilir; izin verilirse jeton
 * hemen kaydedilir (oturum varsa). Karar 'ask' değilse pencere AÇILMAZ, mevcut durum döner.
 */
export async function requestPushPermission(source: PushSource): Promise<PushStatus> {
  try {
    if (!Device.isDevice) return 'undetermined';
    const d = await pushDecision(source);
    if (d === 'granted') return 'granted';
    if (d !== 'ask') return (await readStatus()).status;
    await setupAndroidChannel();
    await AsyncStorage.setItem(PUSH_ASKED_AT_KEY, String(Date.now())).catch(() => {});
    const res = await Notifications.requestPermissionsAsync();
    const status = (res.status as PushStatus) ?? 'undetermined';
    await AsyncStorage.setItem(PUSH_PERMISSION_FLAG, status).catch(() => {});
    if (status === 'granted') void registerForPushNotifications();
    return status;
  } catch (e) {
    console.warn('[push] permission ask error:', e);
    return 'undetermined';
  }
}

/**
 * Ayarlar › Bildirimler "Bildirimleri aç": 30 günde en fazla bir sistem penceresi;
 * aksi hâlde (ya da işletim sistemi artık soramıyorsa) Ayarlar uygulaması açılır.
 */
export async function enablePushFromSettings(): Promise<PushStatus | 'settings'> {
  const d = await pushDecision('settings');
  if (d === 'granted') return 'granted';
  if (d === 'ask') return requestPushPermission('settings');
  await Linking.openSettings().catch(() => {});
  return 'settings';
}
