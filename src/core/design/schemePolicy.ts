// G21-S1 md.3 — uygulama teması kararı (SAF; RN importu yok → node:test).

export interface AppSchemeDecision {
  /** ThemeProvider forceScheme: undefined = sistemi izle. */
  force: 'light' | undefined;
  /** Appearance.setColorScheme değeri; undefined = native çağrı yapma (sistem). */
  native: 'light' | undefined;
  /** Kök durum çubuğu (expo-status-bar). */
  statusBar: 'dark' | 'auto';
}

export function resolveAppScheme({ ready, yeniKabuk }: { ready: boolean; yeniKabuk: boolean }): AppSchemeDecision {
  // Bayrak çözülmeden eski kabuk çizilir → açık tema, native dokunulmaz.
  if (!ready) return { force: 'light', native: undefined, statusBar: 'dark' };
  // Yeni kabuk: telefonun açık/koyu ayarı.
  if (yeniKabuk) return { force: undefined, native: undefined, statusBar: 'auto' };
  // Eski kabuk (parite): açık tema + native açık (klavye/sistem sheet'leri).
  return { force: 'light', native: 'light', statusBar: 'dark' };
}
