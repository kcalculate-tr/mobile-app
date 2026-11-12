import React, { useEffect, useRef } from 'react';
import { Appearance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFeature, useFlagsContext } from '../flags';
import { ThemeProvider } from './ThemeProvider';
import { resolveAppScheme } from './schemePolicy';

/**
 * G21-S1 md.3 — Tema telefonu izler.
 *
 * app.config.js artık `userInterfaceStyle: 'automatic'` (iOS/Android/kök). Bu kapı:
 *  · `yeni_kabuk` AÇIK (soğuk açılışta bir kez okunur, AppNavigator ile aynı kural):
 *    sistem teması izlenir — useTheme, durum çubuğu ('auto'), klavye ve sistem
 *    sheet'leri telefonla birlikte açık/koyu.
 *  · KAPALI (eski kabuk, parite): ağaç ThemeProvider `forceScheme: 'light'` ile açık
 *    temada kalır ve native görünüm `Appearance.setColorScheme('light')` ile açığa
 *    sabitlenir (klavye, Alert/ActionSheet, tarih seçici bugünkü gibi açık).
 *  · Bayrak henüz çözülmediyse eski kabuk gösterilir → açık tema (native çağrı yok).
 */
export function AppSchemeGate({ children }: { children: React.ReactNode }) {
  const live = useFeature('yeni_kabuk');
  const ctx = useFlagsContext();
  const ready = ctx ? ctx.ready : true;
  const frozen = useRef<boolean | undefined>(undefined);
  if (frozen.current === undefined && ready) frozen.current = live;
  const scheme = resolveAppScheme({ ready: frozen.current !== undefined, yeniKabuk: frozen.current === true });

  useEffect(() => {
    if (scheme.native === undefined) return;
    try {
      Appearance.setColorScheme(scheme.native);
    } catch {
      // Eski platform (iOS < 13 / Android < 10): yok sayılır, tema yine JS'te sabit.
    }
  }, [scheme.native]);

  return (
    <ThemeProvider forceScheme={scheme.force}>
      {children}
      {/* Kök durum çubuğu: eski kabukta bugünkü gibi koyu ikon; yeni kabukta temaya göre. */}
      <StatusBar style={scheme.statusBar} />
    </ThemeProvider>
  );
}
