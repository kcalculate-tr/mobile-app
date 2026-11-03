// Cihaz dili tespiti — expo-localization (NATIVE). Testlerde import EDİLMEZ.
import { getLocales } from 'expo-localization';

import { SUPPORTED_LANGS, DEFAULT_LANG, type Lang } from './dictionaries';

/** Cihaz dilini desteklenen bir dile eşle; bilinmiyorsa varsayılan (tr). */
export function detectDeviceLang(): Lang {
  try {
    const locales = getLocales();
    for (const l of locales) {
      const code = (l.languageCode ?? '').toLowerCase();
      if ((SUPPORTED_LANGS as readonly string[]).includes(code)) {
        return code as Lang;
      }
    }
  } catch {
    // expo-localization erişilemezse sessizce varsayılana düş.
  }
  return DEFAULT_LANG;
}
