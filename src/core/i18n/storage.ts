// Kullanıcı dil tercihi — AsyncStorage (NATIVE). Testlerde import EDİLMEZ.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SUPPORTED_LANGS, type Lang } from './dictionaries';

const KEY = 'i18n-lang-pref';

/** Kaydedilmiş dil tercihi; yoksa/okunmazsa null. */
export async function readLangPref(): Promise<Lang | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && (SUPPORTED_LANGS as readonly string[]).includes(raw)) {
      return raw as Lang;
    }
  } catch {
    // yut
  }
  return null;
}

export async function writeLangPref(lang: Lang): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, lang);
  } catch {
    // yut
  }
}
