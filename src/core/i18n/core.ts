// i18n ÇEKİRDEĞİ — saf, native bağımlılığı YOK (yalnız i18n-js, saf JS).
//
// Bu dosya Node ortamında (tsx --test) import edilebilir; expo-localization ya
// da AsyncStorage'a DOKUNMAZ. Dil tespiti ve kullanıcı tercihi ayrı dosyalarda
// (detect.ts / storage.ts) — onlar native ve testlerde import edilmez.
//
// Varsayılan dil 'tr'. Eksik anahtarda 'tr'ye geri dönülür (enableFallback).
import { I18n } from 'i18n-js';

import { translations, DEFAULT_LANG, type Lang } from './dictionaries';

// Tek paylaşılan örnek. `locale` her çağrıda set edildiği için saf çağrılar
// (translate) birbirini etkilemez.
const i18n = new I18n(translations, {
  defaultLocale: DEFAULT_LANG,
  enableFallback: true, // 'en' eksikse 'tr' (defaultLocale) kullanılır
  missingBehavior: 'guess', // anahtar hiç yoksa son parçayı okunur hâle getir
});

// Yerel sayı biçimi: TR → "1.234,5" · EN → "1,234.5".
const NUMBER_FORMAT: Record<Lang, { delimiter: string; separator: string }> = {
  tr: { delimiter: '.', separator: ',' },
  en: { delimiter: ',', separator: '.' },
};

export type TParams = Record<string, string | number> & { count?: number };

/** Saf çeviri. `params.count` verilirse i18n-js çoğul ({one,other}) seçer. */
export function translate(lang: Lang, key: string, params?: TParams): string {
  i18n.locale = lang;
  return i18n.t(key, params) as string;
}

/**
 * Yerele göre sayı biçimi. precision=0 (varsayılan) tam sayı, binlik ayracı
 * ile; precision>0 ondalık. stripInsignificantZeros ile "2,0" → "2".
 */
export function formatNumber(
  lang: Lang,
  value: number,
  opts: { precision?: number } = {},
): string {
  const { delimiter, separator } = NUMBER_FORMAT[lang];
  i18n.locale = lang;
  return i18n.numberToRounded(value, {
    precision: opts.precision ?? 0,
    delimiter,
    separator,
    stripInsignificantZeros: (opts.precision ?? 0) > 0,
  });
}

/** Test/hata ayıklama için doğrudan örnek (üretimde I18nProvider kullanılır). */
export function getI18n(): I18n {
  return i18n;
}
