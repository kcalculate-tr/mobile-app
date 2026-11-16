// Bayrak önbelleği — AsyncStorage (zaten kurulu, supabase auth da onu kullanır).
//
// Sunucudan çözümlenen { key: bool } haritası burada saklanır; sonraki açılışta
// RPC dönene kadar (ya da çevrimdışı/hata durumunda) bu kullanılır. Tüm okuma/
// yazmalar best-effort: hata asla yukarı sızmaz, asla çökmez.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { FlagMap } from './resolve';
import { parseCachedFlags } from './cacheFormat';

const CACHE_KEY = 'kcal.flags.cache.v1';

/**
 * 16 Kas: önbellek uygulama sürümüyle saklanır. Sunucu bayrakları sürüme göre çözdüğü için (min_app_version)
 * eski sürümün yazdığı harita (ör. 1.0.7: yeni_* false) güncellemeden sonraki ilk açılışta KULLANILMAZ.
 * Eski biçim (düz harita, sürümsüz) de bayat sayılır.
 */
function appVersion(): string {
  return String(Constants.expoConfig?.version ?? '');
}


export async function readCachedFlags(): Promise<FlagMap | null> {
  try {
    return parseCachedFlags(await AsyncStorage.getItem(CACHE_KEY), appVersion());
  } catch {
    return null;
  }
}

export async function writeCachedFlags(map: FlagMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ __v: appVersion(), map }));
  } catch {
    // yut — önbellek yazılamazsa bir sonraki açılış varsayılanla render eder
  }
}

export async function clearCachedFlags(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // yut
  }
}

// G20-S3 md.3 — girişten önce bayrak kovası için cihaz kimliği (rastgele, kişisel
// veri değil; analitik anon_id'den AYRI, hiçbir tabloya yazılmaz). Silinip yeniden
// kurulunca yenilenir.
const DEVICE_KEY = 'kcal.flags.device.v1';
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function makeFlagsDeviceId(rand: () => number = Math.random): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 24; i += 1) out += abc[Math.floor(rand() * abc.length) % abc.length];
  return out;
}

export function isFlagsDeviceId(v: unknown): v is string {
  return typeof v === 'string' && DEVICE_RE.test(v);
}

export async function readFlagsDeviceId(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_KEY);
    if (isFlagsDeviceId(raw)) return raw;
    const fresh = makeFlagsDeviceId();
    await AsyncStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return makeFlagsDeviceId();
  }
}
