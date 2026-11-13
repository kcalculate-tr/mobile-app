// Cihaz dili tespiti — expo-localization (NATIVE). Testlerde import EDİLMEZ.
// G39-S1 md.7: Türkçe cihaz → TR, diğer her dil → EN (kural saf: languages.ts › pickDeviceLang).
import { getLocales } from 'expo-localization';

import type { Lang } from './dictionaries';
import { DEVICE_FALLBACK_LANG, pickDeviceLang } from './languages';

/** Cihaz dilini desteklenen bir dile eşle: birincil dil Türkçe → 'tr', aksi hâlde 'en'. */
export function detectDeviceLang(): Lang {
  try {
    return pickDeviceLang(getLocales());
  } catch {
    // expo-localization erişilemezse sessizce İngilizceye düş.
    return DEVICE_FALLBACK_LANG;
  }
}
