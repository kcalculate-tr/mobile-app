import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../AuthContext';
import { getSupabaseClient } from '../supabase';
import { FLAG_DEFAULTS, FlagKey } from './registry';
import { mergeFlags, type FlagMap } from './resolve';
import { readCachedFlags, writeCachedFlags } from './storage';
import { readDevOverrides, setDevOverride as persistDevOverride } from './devOverrides';

// ─────────────────────────────────────────────────────────────────────────────
// Dalga dalga yayın için bayrak sağlayıcı.
//
// Tasarım (bkz. docs/night/G4-S2-FLAGS.md):
//  • Açılışı ASLA bekletmez: ilk render YEREL VARSAYILANLARLA (hepsi false) olur.
//  • Giriş yapıldıktan sonra get_my_features RPC'si çağrılır; dönen { key: bool }
//    haritası AsyncStorage'a önbelleklenir.
//  • Çevrimdışı/hata → önbellek; önbellek de yoksa varsayılan. Asla çökmez.
//  • __DEV__'de yerel override en üste uygulanır (prod'da yok).
//
// Çözümlemenin tek doğruluk kaynağı SUNUCUDUR (rollout/sürüm/platform/kilit
// orada hesaplanır). İstemci yalnız birleştirir + önbellekler.
// ─────────────────────────────────────────────────────────────────────────────

type FlagsContextValue = {
  flags: Record<FlagKey, boolean>;
  /** Sunucu çözümü en az bir kez denendi mi (false iken varsayılan/önbellekle render sürer). */
  ready: boolean;
  refresh: () => Promise<void>;
  /** __DEV__ geçersiz kılma haritası (prod'da daima boş). */
  devOverrides: FlagMap;
  setDevOverride: (key: FlagKey, value: boolean | null) => Promise<void>;
};

const FlagsContext = createContext<FlagsContextValue | undefined>(undefined);

export function FlagsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [remote, setRemote] = useState<FlagMap | null>(null);
  const [overrides, setOverrides] = useState<FlagMap>({});
  const [ready, setReady] = useState(false);

  // __DEV__ override'larını bir kez yükle.
  useEffect(() => {
    if (!__DEV__) return;
    void readDevOverrides().then(setOverrides).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    // 1) Hızlı yol: önbelleği uygula (henüz remote yoksa). Varsayılan zaten
    //    render ediliyor; bu yalnızca bilineni erken gösterir.
    try {
      const cached = await readCachedFlags();
      if (cached) setRemote((prev) => prev ?? cached);
    } catch {
      // yut
    }

    // 2) Giriş yoksa RPC çağırma — bayraklar kullanıcı bazlı çözülür.
    if (!user) {
      setReady(true);
      return;
    }

    // 3) Sunucu çözümü. Hata/çevrimdışı → önbellek/varsayılan kalır.
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('get_my_features', {
        p_app_version: Constants.expoConfig?.version ?? null,
        p_platform: Platform.OS,
      });
      if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
        const map = data as FlagMap;
        setRemote(map);
        void writeCachedFlags(map);
      }
    } catch {
      // yut — önbellek/varsayılan kullanılır
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDevOverride = useCallback(async (key: FlagKey, value: boolean | null) => {
    if (!__DEV__) return;
    await persistDevOverride(key, value);
    setOverrides(await readDevOverrides());
  }, []);

  const flags = useMemo(
    () => mergeFlags(remote, __DEV__ ? overrides : null),
    [remote, overrides],
  );

  const value = useMemo<FlagsContextValue>(
    () => ({ flags, ready, refresh: load, devOverrides: overrides, setDevOverride }),
    [flags, ready, load, overrides, setDevOverride],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

/**
 * Bir bayrağın değeri. Provider yoksa (olmamalı) güvenli YEREL VARSAYILANI
 * döner — asla çökmez. HİÇBİR canlı ekran şu an bunu kullanmıyor.
 */
export function useFeature(key: FlagKey): boolean {
  const ctx = useContext(FlagsContext);
  if (!ctx) {
    if (__DEV__) {
      console.warn('[flags] useFeature FlagsProvider dışında çağrıldı; varsayılan kullanılıyor:', key);
    }
    return FLAG_DEFAULTS[key] ?? false;
  }
  return ctx.flags[key] ?? FLAG_DEFAULTS[key] ?? false;
}

/** Tanı/geliştirici ekranı için tüm bağlam (yalnız __DEV__ kullanımında anlamlı). */
export function useFlagsContext(): FlagsContextValue | undefined {
  return useContext(FlagsContext);
}
