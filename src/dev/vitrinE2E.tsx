// G18-S5 md.2 — UÇTAN UCA AKIŞ KÖKÜ. YALNIZ __DEV__ (VitrinGate `kcal://dev/screen/E2E`).
//
// Vitrin sahnelerinden FARKI: sahne/rota zorlanmaz. Uygulama soğuk açılıştaki gibi
// başlar (oturum yok, depolama boş → FinOpen → Karşılama → Hesap …) ve bütün ekran
// geçişleri GERÇEK dokunuşla, gerçek AppNavigator içinde olur.
//
// Canlıya dokunmaz (G18-ORTAK #8, GECE19 mutlak yasaklar):
//  - Oturum: e-posta kodu doğrulanınca YENİ hesap kimliği bellekte açılır (Supabase
//    Auth'a istek gitmez; auth uçları 401).
//  - Supabase yazmaları (POST/PATCH/upsert) canlıya GİTMEZ: bellek içi tabloya yazılır,
//    aynı tablonun kullanıcıya özel okumaları oradan döner (yeni hesap = boş başlar).
//    RPC → null. Herkese açık okumalar (menü, ürün, banner) gerçek ağdan, anon anahtarla.
//  - Modül istemcileri (Keşfet, Gün, Profil, Tara) mock: gerçek sipariş/ödeme YOK.
//  - Ölçüm (G19-S4): analytics_events yazımı bellek tablosuna; Meta reklam rızası 'denied'.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContextForDev, type AuthContextValue } from '../core/AuthContext';
import { FlagsOverrideProvider, FLAG_DEFAULTS, type FlagKey } from '../core/flags';
import { ThemeProvider } from '../core/design';
import { I18nProvider } from '../core/i18n';
import { FINAL_FLAGS } from './screenCatalog';
import { restoreNetwork } from './vitrinState';
import { setKesfetClient } from '../modules/kesfet';
import { vitrinKesfetClient } from './vitrinKesfet';
import { createMockGunClient, setGunClient } from '../modules/gun';
import { createMockProfilClient, setProfilClient } from '../modules/profil';
import { createMockAiScanClient, setAiScanClient } from '../modules/ai/scan';
import { setAdConsent, setFirstPartyConsent } from '../lib/analytics';

const E2E_USER = {
  id: '00000000-0000-4000-8000-0000000e2e01',
  email: 'yeni-hesap@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as unknown as User;
const E2E_SESSION = { access_token: 'e2e', refresh_token: 'e2e', token_type: 'bearer', expires_in: 3600, user: E2E_USER } as unknown as Session;

// ── Bellek içi tablolar (yalnız bu süreç) ────────────────────────────────────
const tables = new Map<string, any[]>();
const realFetch: typeof fetch = global.fetch;
/** Kullanıcıya özel tablolar: yeni hesapta boş başlar, okumalar canlıya gitmez. */
const USER_TABLE = /^(user_|profiles|consumed|daily|meal|water|weight|activity|orders|order_|addresses|user_addresses|cart|notifications|push|kesfet_|posts|comments|follows|likes|saved|streak|collection|eatkcal_waitlist)/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/*' } });
}

/** PostgREST süzgeçlerinin basit karşılığı (eq/neq/lt/lte/gt/gte/is). ISO tarihler metin olarak karşılaştırılır. */
function filterRows(rows: any[], url: string): any[] {
  let q: URLSearchParams;
  try {
    q = new URL(url).searchParams;
  } catch {
    return rows;
  }
  let out = rows;
  q.forEach((v, k) => {
    const m = /^(eq|neq|lt|lte|gt|gte|is)\.(.*)$/.exec(v);
    if (!m || ['select', 'order', 'limit', 'offset'].includes(k)) return;
    const [, op, raw] = m;
    const val = decodeURIComponent(raw);
    out = out.filter((r) => {
      const x = r?.[k];
      if (op === 'is') return val === 'null' ? x == null : String(x) === val;
      if (x == null) return false;
      const a = String(x);
      if (op === 'eq') return a === val;
      if (op === 'neq') return a !== val;
      if (op === 'lt') return a < val;
      if (op === 'lte') return a <= val;
      if (op === 'gt') return a > val;
      return a >= val;
    });
  });
  const lim = Number(q.get('limit'));
  return Number.isFinite(lim) && lim > 0 ? out.slice(0, lim) : out;
}

function e2eFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const method = (init?.method ?? (input as Request)?.method ?? 'GET').toUpperCase();
  if (!url.includes('.supabase.co') && !url.includes('/functions/v1/')) {
    if (/facebook|sentry|segment|amplitude|posthog/.test(url)) return Promise.resolve(json({}));
    return realFetch(input as RequestInfo, init);
  }
  if (url.includes('/auth/v1/')) return Promise.resolve(json({ error: 'e2e' }, 401));
  if (url.includes('/functions/v1/')) return Promise.resolve(json({ ok: false, error: 'e2e' }, 503));
  if (url.includes('/rpc/')) return Promise.resolve(json(null));
  const m = /\/rest\/v1\/([a-z0-9_]+)/.exec(url);
  const table = m?.[1] ?? '';
  const headers = new Headers((init?.headers as any) ?? {});
  const single = (headers.get('Accept') ?? '').includes('vnd.pgrst.object');
  if (method === 'GET' || method === 'HEAD') {
    const rows = tables.get(table) ? filterRows(tables.get(table)!, url) : undefined;
    if (rows) return Promise.resolve(json(single ? rows[0] ?? null : rows, single && !rows[0] ? 406 : 200));
    if (USER_TABLE.test(table)) return Promise.resolve(single ? json(null, 406) : json([]));
    return realFetch(input as RequestInfo, init); // herkese açık okuma (menü, ürün, banner)
  }
  // Yazma → bellek; canlıya gitmez.
  let body: any = null;
  try {
    body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
  } catch {
    body = null;
  }
  if (method === 'DELETE') {
    tables.set(table, []);
    return Promise.resolve(json([]));
  }
  const incoming = (Array.isArray(body) ? body : body ? [body] : []).map((r: any, i: number) => ({
    id: r?.id ?? `e2e-${table}-${Date.now()}-${i}`,
    created_at: new Date().toISOString(),
    ...r,
  }));
  const prev = tables.get(table) ?? [];
  const key = (r: any) => r.user_id ?? r.id;
  const merged =
    method === 'PATCH'
      ? prev.map((r) => ({ ...r, ...(body ?? {}) }))
      : [...prev.filter((r) => !incoming.some((n: any) => key(n) === key(r) && /user_nutrition|profiles/.test(table))), ...incoming];
  tables.set(table, method === 'PATCH' && prev.length === 0 ? [{ id: E2E_USER.id, ...(body ?? {}) }] : merged);
  const out = method === 'PATCH' ? tables.get(table)! : incoming;
  return Promise.resolve(json(single ? out[0] ?? null : out, 201));
}

export function E2ERoot({ lang }: { lang?: 'tr' | 'en' }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const flags = useMemo(() => {
    const map = { ...FLAG_DEFAULTS } as Record<FlagKey, boolean>;
    for (const k of FINAL_FLAGS) map[k] = true;
    return map;
  }, []);

  useEffect(() => {
    (async () => {
      restoreNetwork();
      // Yeni kurulum eşdeğeri: bütün yerel durum silinir (ilk açılış imzası, ilk 60 sn
      // bayrakları, il kapısı, kutlama/izin "bir kez" anahtarları).
      await AsyncStorage.clear().catch(() => {});
      // G19-S4: simülatörde Meta reklam olayları (product_view, add_to_cart,
      // begin_checkout) yerel SDK'dan Meta'ya giderdi. E2E'de reklam rızası 'denied': Meta'ya
      // hiçbir şey gitmez; birinci taraf olaylar bellek içi tabloya yazılır (canlıya değil).
      await setAdConsent('denied').catch(() => {});
      tables.clear();
      // Keşfet akışı herkese açık içerik: vitrin örnek gönderileri (yerel fotoğraflar).
      setKesfetClient(vitrinKesfetClient('', false));
      setGunClient(createMockGunClient({ ringCount: 0, cardCount: 0 }));
      setProfilClient(createMockProfilClient());
      setAiScanClient(createMockAiScanClient());
      global.fetch = e2eFetch as typeof fetch;
      // Birinci taraf ölçüm açık (olay denetimi için) — fetch kesildikten SONRA: yazımlar
      // bellek tablosuna gider, canlıya değil.
      await setFirstPartyConsent(true).catch(() => {});
      setReady(true);
    })();
    return () => {
      global.fetch = realFetch;
    };
  }, []);

  const auth = useMemo<AuthContextValue>(
    () => ({
      user,
      session: user ? E2E_SESSION : null,
      loading: false,
      authLoading: false,
      signIn: async () => ({ error: 'e2e' }),
      signUp: async () => ({ error: 'e2e' }),
      signOut: async () => {
        setUser(null);
        return { error: null };
      },
      signInWithApple: async () => ({ error: 'e2e' }) as any,
      signInWithGoogle: async () => ({ error: 'e2e' }) as any,
      // E-posta kodu: istek canlıya gitmez; "Doğrula" yeni hesabı bellekte açar.
      signInWithOtp: async () => ({ error: null }),
      verifyEmailOtp: async () => {
        setUser(E2E_USER);
        return { error: null };
      },
    }),
    [user],
  );

  if (!ready) return <View style={styles.fill} />;
  const AppNavigator = require('../navigation/AppNavigator').default;
  return (
    <AuthContextForDev.Provider value={auth}>
      <FlagsOverrideProvider flags={flags}>
        <StatusBar style="dark" />
        <I18nProvider forceLang={lang}>
          <ThemeProvider>
            <NavigationIndependentTree>
              <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0A0A' } }}>
                <AppNavigator />
              </NavigationContainer>
            </NavigationIndependentTree>
          </ThemeProvider>
        </I18nProvider>
      </FlagsOverrideProvider>
    </AuthContextForDev.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#000' } });
