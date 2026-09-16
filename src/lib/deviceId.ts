import AsyncStorage from '@react-native-async-storage/async-storage';

// Saklı kart ödemesinde "yeni cihaz mı?" kontrolü için kalıcı, cihaza özel kimlik.
// Analytics'teki anon ID'den KASITLI OLARAK AYRI (farklı endişe: biri pazarlama
// attribution'ı, biri ödeme güvenlik sinyali — biri sıfırlansa diğeri etkilenmesin).
const DEVICE_ID_KEY = '@kcal_payment_device_id';

const genId = (): string =>
  `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

let cachedDeviceId: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      cachedDeviceId = stored;
      return stored;
    }
    const fresh = genId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedDeviceId = fresh;
    return fresh;
  } catch {
    return genId();
  }
}
