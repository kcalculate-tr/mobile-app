// i18n sağlayıcı + useT hook'u. Dil çözümü: kullanıcı tercihi → cihaz dili →
// varsayılan (tr). Tercih AsyncStorage'da saklanır. Üretim ekranları bu
// provider'a HENÜZ bağlı değildir; yalnız G5 veri modülleri ve __DEV__ deneme
// ekranı kullanır (davranış değişmez).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { translate, formatNumber, type TParams } from './core';
import { DEFAULT_LANG, type Lang } from './dictionaries';
import { detectDeviceLang } from './detect';
import { readLangPref, writeLangPref } from './storage';

interface I18nContextValue {
  lang: Lang;
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: TParams) => string;
  fmt: (value: number, opts?: { precision?: number }) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  forceLang,
}: {
  children: React.ReactNode;
  /** __DEV__ deneme ekranı dili elle değiştirmek için; üretimde verilmez. */
  forceLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(forceLang ?? detectDeviceLang());
  const [ready, setReady] = useState<boolean>(forceLang != null);

  // Kayıtlı tercihi bir kez yükle (forceLang verilmediyse).
  useEffect(() => {
    if (forceLang != null) return;
    let alive = true;
    readLangPref().then((pref) => {
      if (!alive) return;
      if (pref) setLangState(pref);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [forceLang]);

  // forceLang dışarıdan değişirse izle (deneme ekranı).
  useEffect(() => {
    if (forceLang != null) setLangState(forceLang);
  }, [forceLang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void writeLangPref(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      ready,
      setLang,
      t: (key, params) => translate(lang, key, params),
      fmt: (v, opts) => formatNumber(lang, v, opts),
    }),
    [lang, ready, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provider yoksa (ör. izole test/preview) varsayılan dilde saf çeviriye düş.
    return {
      lang: DEFAULT_LANG,
      ready: true,
      setLang: () => {},
      t: (key, params) => translate(DEFAULT_LANG, key, params),
      fmt: (v, opts) => formatNumber(DEFAULT_LANG, v, opts),
    };
  }
  return ctx;
}
