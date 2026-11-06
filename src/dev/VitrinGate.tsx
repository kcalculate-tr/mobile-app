// G14-S1 — Ekran vitrini kökü. YALNIZ __DEV__ (App.tsx `if (__DEV__) require`).
//
// `kcal://dev/screen/<Pano>` gelince (soğuk açılış URL'i ya da çalışırken
// gelen URL) normal uygulama ağacının YERİNE vitrini açar:
//   sahte oturum (AuthContextForDev) · sabit bayraklar (FlagsOverrideProvider)
//   · zorlanmış tema/dil · mock istemciler + ağ taklidi (vitrinState)
//   · rota hedefleri için GERÇEK AppNavigator (initialState ile), diğerleri
//     için vitrinScreens sahnesi.
// URL'siz açılışta hiçbir şey yapmaz: çocukları aynen render eder.
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { DevSettings, Linking, LogBox, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import type { Session, User } from '@supabase/supabase-js';
import ErrorBoundary from 'react-native-error-boundary';

import { AuthContextForDev, type AuthContextValue } from '../core/AuthContext';
import { FlagsOverrideProvider, FLAG_DEFAULTS, type FlagKey } from '../core/flags';
import { ThemeProvider } from '../core/design';
import { I18nProvider } from '../core/i18n';
import { setDevInitialCollapse } from '../modules/shell/scroll';
import { parseVitrinUrl, resolvePano, type ResolvedEntry, type RouteSpec } from './screenCatalog';
import { installMockClients, installNetwork, restoreNetwork, seedStorage } from './vitrinState';
import { prepareScene } from './vitrinSetup';
import { VITRIN_SCENES } from './vitrinScreens';

const DEV_USER = {
  // Geçerli UUID olmalı: ekranlar bunu uuid kolonlarına filtre olarak yollar.
  id: '00000000-0000-4000-8000-00000000a14e',
  email: 'vitrin@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Deniz Kaya' },
  created_at: '2026-01-01T00:00:00.000Z',
} as unknown as User;

const DEV_SESSION = {
  access_token: 'vitrin',
  refresh_token: 'vitrin',
  token_type: 'bearer',
  expires_in: 3600,
  user: DEV_USER,
} as unknown as Session;

const fail = async () => ({ error: 'vitrin' });

function authValue(guest: boolean): AuthContextValue {
  return {
    user: guest ? null : DEV_USER,
    session: guest ? null : DEV_SESSION,
    loading: false,
    authLoading: false,
    signIn: fail,
    signUp: fail,
    signOut: async () => ({ error: null }),
    signInWithApple: fail,
    signInWithGoogle: fail,
    signInWithOtp: fail,
    verifyEmailOtp: fail,
  };
}

function toNavState(routes: RouteSpec[]): any {
  return {
    routes: routes.map((r) => ({
      name: r.name,
      params: r.params,
      state: r.state ? toNavState(r.state.routes) : undefined,
    })),
  };
}

function VitrinRoot({ entry }: { entry: ResolvedEntry }) {
  const [ready, setReady] = useState(false);
  const [routeOverride, setRouteOverride] = useState<RouteSpec[] | null>(null);

  const flags = useMemo(() => {
    const map = { ...FLAG_DEFAULTS } as Record<FlagKey, boolean>;
    for (const k of entry.flags) map[k] = true;
    return map;
  }, [entry]);

  useEffect(() => {
    let alive = true;
    (async () => {
      restoreNetwork();
      setDevInitialCollapse(entry.collapse ?? 0);
      installMockClients(entry.data);
      // Sahne hazırlığı gerçek (okuma) ağıyla yapılır; durum taklidi sonra kurulur.
      const prepared = await prepareScene(entry).catch(() => ({ routes: null, mockRoutes: [] }));
      if (!alive) return;
      installNetwork(entry.data, prepared.mockRoutes ?? []);
      if (prepared.routes) setRouteOverride(prepared.routes);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [entry]);

  if (!ready) return <View style={[styles.fill, { backgroundColor: entry.scheme === 'dark' ? '#000' : '#F3F4F6' }]} />;

  let body: React.ReactNode;
  if (entry.target.kind === 'route') {
    // Gerçek uygulama gezgini — bayraklar/oturum sahte, rota yığını hazır.
    const AppNavigator = require('../navigation/AppNavigator').default;
    body = (
      <NavigationIndependentTree>
        <NavigationContainer
          theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0A0A' } }}
          initialState={toNavState(routeOverride ?? entry.target.routes)}
        >
          <AppNavigator />
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  } else {
    const Scene = VITRIN_SCENES[entry.target.key];
    const { createNativeStackNavigator } = require('@react-navigation/native-stack');
    const Stack = createNativeStackNavigator();
    const props = entry.target.props;
    const Screen = () => (Scene ? <Scene {...(props ?? {})} /> : <Missing name={entry.target.kind} />);
    body = (
      <NavigationIndependentTree>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="VitrinScene" component={Screen} />
          </Stack.Navigator>
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  }

  return (
    <AuthContextForDev.Provider value={authValue(entry.auth === 'guest')}>
      <FlagsOverrideProvider flags={flags}>
        <I18nProvider forceLang={entry.lang}>
          <ThemeProvider forceScheme={entry.scheme}>{body}</ThemeProvider>
        </I18nProvider>
      </FlagsOverrideProvider>
    </AuthContextForDev.Provider>
  );
}

function Missing({ name }: { name: string }) {
  return (
    <View style={[styles.fill, styles.center]}>
      <Text>Vitrin: sahne yok ({name})</Text>
    </View>
  );
}

// Panolar arası geçişte JS baştan yüklenir (store/singleton/gezgin durumu
// sızmasın; ör. Tabs → Onboarding geçişinde StackRouter 'stale' hatası).
// Bekleyen pano adı yeniden yüklemeden sonra buradan okunur.
const PENDING_KEY = 'g14-vitrin-pending';

export default function VitrinGate({ children }: { children: React.ReactNode }) {
  const [pano, setPano] = useState<string | null>(null);
  const active = React.useRef(false);

  useEffect(() => {
    const open = (p: string) => {
      active.current = true;
      // Vitrin görüntüsü temiz kalsın (uyarı şeritleri/kırmızı kutu yok).
      LogBox.ignoreAllLogs(true);
      setPano(p);
    };
    void (async () => {
      const pending = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
      if (pending) {
        await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
        open(pending);
        return;
      }
      const p = parseVitrinUrl(await Linking.getInitialURL());
      if (p) open(p);
    })();
    const sub = Linking.addEventListener('url', ({ url }) => {
      const p = parseVitrinUrl(url);
      if (!p) return;
      if (!active.current) {
        open(p);
        return;
      }
      void AsyncStorage.setItem(PENDING_KEY, p).then(() => DevSettings.reload());
    });
    return () => sub.remove();
  }, []);

  if (!pano) return <>{children}</>;
  const entry = resolvePano(pano);
  if (!entry) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text>Vitrin: bilinmeyen pano {pano}</Text>
      </View>
    );
  }
  // key → her pano temiz bir ağaç (store'lar sahne hazırlığında sıfırlanır).
  // Pano başına hata sınırı: bir sahnenin çökmesi sonraki panoları bozmasın;
  // çökme görüntüde açıkça görünür (LOG'da "çöktü").
  return (
    <ErrorBoundary key={pano} FallbackComponent={({ error }) => <Crashed pano={pano} error={error} />}>
      <VitrinRoot entry={entry} />
    </ErrorBoundary>
  );
}

function Crashed({ pano, error }: { pano: string; error: Error }) {
  return (
    <View style={[styles.fill, styles.center, { padding: 24, backgroundColor: '#fff' }]}>
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Vitrin: {pano} çöktü</Text>
      <Text selectable>{String(error?.message ?? error)}</Text>
    </View>
  );
}

// seedStorage dışa açık kalsın (vitrinSetup kullanır).
export { seedStorage };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
