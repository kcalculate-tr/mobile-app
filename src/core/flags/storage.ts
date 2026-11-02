// Bayrak önbelleği — AsyncStorage (zaten kurulu, supabase auth da onu kullanır).
//
// Sunucudan çözümlenen { key: bool } haritası burada saklanır; sonraki açılışta
// RPC dönene kadar (ya da çevrimdışı/hata durumunda) bu kullanılır. Tüm okuma/
// yazmalar best-effort: hata asla yukarı sızmaz, asla çökmez.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlagMap } from './resolve';

const CACHE_KEY = 'kcal.flags.cache.v1';

export async function readCachedFlags(): Promise<FlagMap | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as FlagMap;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeCachedFlags(map: FlagMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
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
