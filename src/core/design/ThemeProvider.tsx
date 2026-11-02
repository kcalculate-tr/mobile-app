import React, { createContext, useContext, useMemo } from 'react';
import type { ColorScheme, Theme } from './theme';
import { themes, useSystemTheme } from './theme';

/**
 * ThemeProvider + useTheme.
 *
 * Varsayılan davranış: telefonun sistem ayarını izle (Appearance API).
 * `forceScheme` prop'u yalnızca VİTRİN/test içindir — bir alt ağacı belirli
 * bir temaya zorlamak için (açık ve koyu yan yana gösterilebilsin). Üretimde
 * verilmez, sistem izlenir.
 *
 * Provider sarmalanmazsa `useTheme()` yine de sistem temasını döndürür; yani
 * tek tek bileşenler provider olmadan da doğru çalışır. Provider'ın tek işi
 * `forceScheme` ile bir ağacı sabitleyebilmek.
 */

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  forceScheme,
}: {
  children: React.ReactNode;
  forceScheme?: ColorScheme;
}) {
  const system = useSystemTheme();
  const value = useMemo<Theme>(
    () => (forceScheme ? themes[forceScheme] : system),
    [forceScheme, system],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  // Provider yoksa sisteme düş — bileşenler tek başına da çalışsın.
  const system = useSystemTheme();
  return ctx ?? system;
}
