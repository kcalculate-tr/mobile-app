// i18n — dışa açık yüzey. Saf çekirdek (core/dictionaries) her yerde; native
// parçalar (detect/storage) yalnız I18nProvider üzerinden kullanılır.
export { translate, formatNumber, getI18n, type TParams } from './core';
export {
  translations,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  type Lang,
} from './dictionaries';
export { I18nProvider, useT } from './I18nProvider';
export {
  LANGUAGES,
  SYSTEM_PREF,
  enabledLanguages,
  languageEntry,
  languageSubtitle,
  resolveLang,
  isLangPref,
  type LangPref,
  type LanguageEntry,
  type FlagId,
} from './languages';
