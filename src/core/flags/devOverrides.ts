// Yerel bayrak geçersiz kılma — YALNIZ __DEV__.
//
// Geliştirici, Tanı ekranındaki "Bayraklar" listesinden bir bayrağı elle
// aç/kapat/sıfırla yapabilir. Prod build'de bu modülün hiçbir fonksiyonu
// AsyncStorage'a dokunmaz (hepsi __DEV__ kontrolüyle erken döner) — yani
// yayınlanan uygulamada override diye bir şey YOKTUR.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlagMap } from './resolve';
import type { FlagKey } from './registry';

const DEV_KEY = 'kcal.flags.devOverrides.v1';

export async function readDevOverrides(): Promise<FlagMap> {
  if (!__DEV__) return {};
  try {
    const raw = await AsyncStorage.getItem(DEV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as FlagMap;
    }
    return {};
  } catch {
    return {};
  }
}

/** value=null → override'ı kaldır (sunucu/varsayılan değerine dön). */
export async function setDevOverride(key: FlagKey, value: boolean | null): Promise<void> {
  if (!__DEV__) return;
  try {
    const current = await readDevOverrides();
    if (value === null) {
      delete current[key];
    } else {
      current[key] = value;
    }
    await AsyncStorage.setItem(DEV_KEY, JSON.stringify(current));
  } catch {
    // yut
  }
}

export async function clearDevOverrides(): Promise<void> {
  if (!__DEV__) return;
  try {
    await AsyncStorage.removeItem(DEV_KEY);
  } catch {
    // yut
  }
}
