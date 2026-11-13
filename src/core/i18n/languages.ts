// G22-S2 md.6 — dil seçici kayıt tablosu (SAF; RN/native yok, node:test okur).
//
// Yeni dil eklemek = (1) `dictionaries.ts`'e o dilin sözlüğü + `SUPPORTED_LANGS`'a kod,
// (2) aşağıya bir satır (`enabled: true`) + `LangFlag`'e bayrak. Sözlükler JS paketinde
// olduğundan yeni dil OTA (eas update) ile gelebilir; native derleme gerekmez.
// `enabled: false` satır listede GÖRÜNMEZ (hazırlık aşamasındaki dil).
import { SUPPORTED_LANGS, type Lang } from './dictionaries';

/** Kullanıcı tercihi: belirli bir dil ya da "Telefon dili" (cihazı izle, varsayılan). */
export type LangPref = Lang | 'system';

export const SYSTEM_PREF = 'system' as const;

/** Yerel bayrak çizimi kimliği (`core/design/components/LangFlag`). */
export type FlagId = 'tr' | 'gb';

export interface LanguageEntry {
  code: Lang;
  /** Dilin KENDİ adı — her arayüz dilinde aynı yazılır (Türkçe, English). */
  nativeName: string;
  /** Dilin arayüz dillerindeki adı (alt satır). */
  names: Record<Lang, string>;
  flag: FlagId;
  enabled: boolean;
}

export const LANGUAGES: readonly LanguageEntry[] = [
  { code: 'tr', nativeName: 'Türkçe', names: { tr: 'Türkçe', en: 'Turkish' }, flag: 'tr', enabled: true },
  { code: 'en', nativeName: 'English', names: { tr: 'İngilizce', en: 'English' }, flag: 'gb', enabled: true },
];

/** Listede gösterilecek (etkin + sözlüğü olan) diller, kayıt sırasıyla. */
export function enabledLanguages(list: readonly LanguageEntry[] = LANGUAGES): LanguageEntry[] {
  return list.filter((l) => l.enabled && (SUPPORTED_LANGS as readonly string[]).includes(l.code));
}

export function isLangPref(v: unknown): v is LangPref {
  return v === SYSTEM_PREF || (typeof v === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(v));
}

/** Etkin dil: tercih yoksa / "Telefon dili" ise cihaz dili; desteklenmeyen kod → varsayılan. */
export function resolveLang(pref: LangPref | null | undefined, device: Lang): Lang {
  if (pref && pref !== SYSTEM_PREF && (SUPPORTED_LANGS as readonly string[]).includes(pref)) return pref;
  // G39-S1 md.7: desteklenmeyen cihaz dili → İngilizce (DEFAULT_LANG yalnız sağlayıcısız iç varsayılan).
  return (SUPPORTED_LANGS as readonly string[]).includes(device) ? device : DEVICE_FALLBACK_LANG;
}

/**
 * Alt satır: dilin arayüz dilindeki adı; bu ad kendi adıyla aynıysa (Türkçe arayüzde
 * "Türkçe") diğer arayüz dilindeki adı — böylece her satırda İngilizce/Türkçe karşılık
 * görünür: "Türkçe · Turkish", "English · İngilizce".
 */
export function languageSubtitle(entry: LanguageEntry, uiLang: Lang): string {
  const inUi = entry.names[uiLang];
  if (inUi && inUi !== entry.nativeName) return inUi;
  const other = (SUPPORTED_LANGS as readonly Lang[]).find((l) => l !== uiLang && entry.names[l] !== entry.nativeName);
  return other ? entry.names[other] : entry.nativeName;
}

export function languageEntry(code: Lang): LanguageEntry | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/**
 * G39-S1 md.7 — İngilizce birincil yayın: cihazın BİRİNCİL dili Türkçe → 'tr', diğer HER dil (de, fr, ar,
 * bilinmeyen, boş liste) → 'en'. Yalnız ilk (tercih edilen) yerel dikkate alınır: ["de-DE", "tr-TR"] → 'en'.
 */
export const DEVICE_FALLBACK_LANG: Lang = 'en';
export function pickDeviceLang(locales: readonly { languageCode?: string | null }[] | null | undefined): Lang {
  const first = (locales?.[0]?.languageCode ?? '').toLowerCase();
  return first === 'tr' ? 'tr' : DEVICE_FALLBACK_LANG;
}
