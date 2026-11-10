// Kullanıcı dil tercihi — AsyncStorage (NATIVE). Testlerde import EDİLMEZ.
// G22-S2 md.6: tercih artık 'system' ("Telefon dili") da olabilir; kayıt yoksa = 'system'.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isLangPref, type LangPref } from './languages';

const KEY = 'i18n-lang-pref';

/** Kaydedilmiş dil tercihi; yoksa/okunmazsa null (= Telefon dili). */
export async function readLangPref(): Promise<LangPref | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (isLangPref(raw)) return raw;
  } catch {
    // yut
  }
  return null;
}

export async function writeLangPref(pref: LangPref): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, pref);
  } catch {
    // yut
  }
}
