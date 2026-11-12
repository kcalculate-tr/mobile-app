// i18n sağlayıcı + useT hook'u. Dil çözümü: kullanıcı tercihi → cihaz dili →
// varsayılan (tr). Tercih AsyncStorage'da saklanır. Üretim ekranları bu
// provider'a HENÜZ bağlı değildir; yalnız G5 veri modülleri ve __DEV__ deneme
// ekranı kullanır (davranış değişmez).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { translate, formatNumber, type TParams } from './core';
import { DEFAULT_LANG, type Lang } from './dictionaries';
import { detectDeviceLang } from './detect';
import { readLangPref, writeLangPref } from './storage';
import { SYSTEM_PREF, resolveLang, type LangPref } from './languages';

interface I18nContextValue {
  lang: Lang;
  /** G22-S2 md.6: kullanıcı tercihi — 'system' = Telefon dili (varsayılan). */
  pref: LangPref;
  ready: boolean;
  /** Belirli dile geç (tercih kalıcı). */
  setLang: (lang: Lang) => void;
  /** Tercihi değiştir: dil kodu ya da 'system'. Uygulama anında o dile geçer. */
  setPref: (pref: LangPref) => void;
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
  const [pref, setPrefState] = useState<LangPref>(forceLang ?? SYSTEM_PREF);
  const [device, setDevice] = useState<Lang>(() => detectDeviceLang());
  const [ready, setReady] = useState<boolean>(forceLang != null);

  // Kayıtlı tercihi bir kez yükle (forceLang verilmediyse).
  useEffect(() => {
    if (forceLang != null) return;
    let alive = true;
    readLangPref().then((saved) => {
      if (!alive) return;
      if (saved) setPrefState(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [forceLang]);

  // forceLang dışarıdan değişirse izle (deneme ekranı).
  useEffect(() => {
    if (forceLang != null) setPrefState(forceLang);
  }, [forceLang]);

  // "Telefon dili": uygulama öne gelince cihaz dili yeniden okunur (Android'de dil
  // değişince süreç yeniden başlamayabilir).
  useEffect(() => {
    if (forceLang != null) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setDevice(detectDeviceLang());
    });
    return () => sub.remove();
  }, [forceLang]);

  const setPref = useCallback((next: LangPref) => {
    setPrefState(next);
    void writeLangPref(next);
  }, []);
  const setLang = useCallback((next: Lang) => setPref(next), [setPref]);

  const lang = resolveLang(pref, device);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      pref,
      ready,
      setLang,
      setPref,
      t: (key, params) => translate(lang, key, params),
      fmt: (v, opts) => formatNumber(lang, v, opts),
    }),
    [lang, pref, ready, setLang, setPref],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provider yoksa (ör. izole test/preview) varsayılan dilde saf çeviriye düş.
    return {
      lang: DEFAULT_LANG,
      pref: SYSTEM_PREF,
      ready: true,
      setLang: () => {},
      setPref: () => {},
      t: (key, params) => translate(DEFAULT_LANG, key, params),
      fmt: (v, opts) => formatNumber(DEFAULT_LANG, v, opts),
    };
  }
  return ctx;
}
