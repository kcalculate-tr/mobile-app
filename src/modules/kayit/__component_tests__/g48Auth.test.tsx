// G48-S1 md.0 — AuthSheet (G47 giriş katmanı) İlter'in cihaz geri bildirimi: tek font, küçük ölçek, HIG özel Apple
// düğmesi, renksiz logolar; K1 · E1 · E2 giriş düğmeleri aynı ölçek.
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pressable, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  const R = require('react');
  const useSharedValue = (init: unknown) => {
    const ref = R.useRef(null);
    if (!ref.current) ref.current = { value: init };
    return ref.current;
  };
  const withTiming = (v: unknown, _c?: unknown, cb?: (ok: boolean) => void) => {
    cb?.(true);
    return v;
  };
  const runOnJS = (fn: (...a: unknown[]) => unknown) => fn;
  return { ...m, useSharedValue, withTiming, runOnJS, default: { ...m.default, useSharedValue } };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('expo-apple-authentication', () => {
  const R = require('react');
  const { Pressable: P } = require('react-native');
  return {
    AppleAuthenticationButtonType: { SIGN_IN: 0 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => R.createElement(P, { testID: 'apple-native', onPress, accessibilityRole: 'button' }),
  };
});
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
type MockUser = { id: string; created_at?: string; user_metadata?: Record<string, unknown> } | null;
const mockAuth: {
  user: MockUser;
  signInWithApple: jest.Mock;
  signInWithGoogle: jest.Mock;
  signInWithOtp: jest.Mock;
  verifyEmailOtp: jest.Mock;
  signIn: jest.Mock;
  session: unknown;
} = {
  user: null,
  session: null,
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithOtp: jest.fn(async () => ({ error: null })),
  verifyEmailOtp: jest.fn(async () => ({ error: null })),
  signIn: jest.fn(async () => ({ error: null })),
};
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../../lib/postSocialAuth', () => ({ resolvePostSocialAuth: jest.fn(async () => ({ outcome: 'returning_user' })) }));
jest.mock('../../../lib/consent/metaConsent', () => ({ requestMetaOptIn: jest.fn(async () => ({ granted: true, att: 'authorized' })) }));
jest.mock('../../../lib/notify/marketing', () => ({ setMarketingOptIn: jest.fn(async () => true) }));
let mockRow: Record<string, unknown> | null = null;
jest.mock('../../../core/supabase', () => {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.maybeSingle = async () => ({ data: (q as { table?: string }).table === 'user_nutrition_profiles' ? mockRow : null, error: null });
  q.upsert = async () => ({ error: null });
  const client = {
    from: (t: string) => {
      (q as { table?: string }).table = t;
      return q;
    },
    auth: { updateUser: async () => ({ data: {}, error: null }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
  return { getSupabaseClient: () => client };
});
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => false), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../../lib/consent/store', () => ({ recordHealthConsent: jest.fn(async () => true), acceptPolicies: jest.fn(async () => true) }));
jest.mock('../../plan/client', () => ({ fetchRecipeCatalog: jest.fn(async () => ({ recipes: [] })) }));
jest.mock('../../../lib/banners', () => ({ fetchBannerRows: jest.fn(async () => ({ hero: [], promo: [] })) }));
jest.mock('../../gun/home/useHomeRegion', () => ({ useHomeRegion: () => 'other' }));
const mockRoot: { routeNames: string[]; routes: { name: string; params?: Record<string, unknown> }[] } = { routeNames: [], routes: [] };
jest.mock('../../../navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, reset: jest.fn(), navigate: jest.fn(), getRootState: () => mockRoot },
}));
const mockNavState = { index: 1, routes: [{ name: 'Kayit' }, { name: 'Login' }] };
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav, getState: () => mockNavState, setParams: jest.fn() };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const R = require('react');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, []),
  };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import AuthSheet from '../auth/AuthSheet';
import { EmailScreen, SignupScreen } from '../screens/SignupScreens';

const ROOT = join(__dirname, '../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
type Node = { type: unknown; props: Record<string, unknown>; children: (Node | string)[] | null };
const all = (n: Node | Node[] | null, out: Node[] = []): Node[] => {
  if (!n) return out;
  if (Array.isArray(n)) {
    n.forEach((x) => all(x, out));
    return out;
  }
  out.push(n);
  (n.children ?? []).forEach((c) => typeof c !== 'string' && all(c as Node, out));
  return out;
};
const fills = (n: Node) => all(n).map((x) => x.props.fill).filter((f): f is string => typeof f === 'string');
const textStyleOf = (r: ReturnType<typeof render>, text: string) => flat(r.getByText(text).props.style);

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  await AsyncStorage.clear();
});

// ─── md.0 AuthSheet ─────────────────────────────────────────────────────────────
describe('md.0 AuthSheet — tek font, küçük ölçek, HIG özel Apple düğmesi, renksiz logolar', () => {
  test('tek font: tüm metinler Plus Jakarta Sans (Bricolage yok); başlık 20/700', () => {
    const r = render(wrap(<AuthSheet />));
    const families = all(r.toJSON() as Node)
      .map((n) => flat(n.props.style).fontFamily)
      .filter((f): f is string => typeof f === 'string');
    expect(families.length).toBeGreaterThan(4);
    expect(families.filter((f) => !f.startsWith('PlusJakartaSans_'))).toEqual([]);
    expect(flat(r.getByTestId('auth-sheet-title').props.style)).toMatchObject({ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 });
  });

  test('düğmeler 50 pt · yarıçap 25 · metin 15/600; aralık 10; alt bağlantılar 12', () => {
    const r = render(wrap(<AuthSheet />));
    for (const id of ['auth-apple', 'auth-google', 'auth-email']) {
      expect(flat(r.getByTestId(id).props.style)).toMatchObject({ height: 50, borderRadius: 25 });
    }
    for (const label of ['Apple ile giriş yap', 'Google ile devam et', 'E-posta ile devam et']) {
      expect(textStyleOf(r, label)).toMatchObject({ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 });
      expect(r.getByText(label).props.maxFontSizeMultiplier).toBe(1.3);
      expect(r.getByText(label).props.numberOfLines).toBe(1);
    }
    expect(textStyleOf(r, 'Koşullar').fontSize).toBe(12);
    expect(textStyleOf(r, 'Gizlilik').fontSize).toBe(12);
    expect(src('src/modules/kayit/auth/AuthSheet.tsx')).toMatch(/body: \{ paddingHorizontal: 20, paddingTop: 20, gap: AUTH_BTN\.gap \}/);
    expect(src('src/modules/kayit/ui/parts.tsx')).toMatch(/AUTH_BTN = \{ height: 50, radius: 25, gap: 10, font: FONT\.medium, size: 15, line: 20 \}/);
  });

  test('1,3× yazı: 15 × 1,3 = 19,5 pt metin 50 pt düğmeye sığar (tek satır, kırpılma yok)', () => {
    const r = render(wrap(<AuthSheet />));
    const st = textStyleOf(r, 'Apple ile giriş yap');
    expect((st.lineHeight as number) * 1.3).toBeLessThan(50 - 2 * 8);
    expect(r.getByTestId('auth-sheet-title').props.maxFontSizeMultiplier).toBe(1.3);
  });

  test('Apple: native düğme yok; HIG özel düğme — açık temada düz siyah + beyaz tek renk logo, metin "Apple ile giriş yap"', () => {
    const r = render(wrap(<AuthSheet />));
    expect(r.queryByTestId('apple-native')).toBeNull();
    expect(src('src/modules/kayit/auth/AuthSheet.tsx')).not.toMatch(/from 'expo-apple-authentication'|<AppleAuthentication\./);
    const apple = r.getByTestId('auth-apple');
    expect(flat(apple.props.style).backgroundColor).toBe('#000000');
    expect(textStyleOf(r, 'Apple ile giriş yap').color).toBe('#FFFFFF');
    expect(new Set(fills(r.getByTestId('auth-apple-logo') as unknown as Node))).toEqual(new Set(['#FFFFFF']));
  });

  test('koyu tema: Apple düğmesi beyaz dolgu + siyah logo/metin; EN "Sign in with Apple"', () => {
    const r = render(wrap(<AuthSheet />, 'dark', 'en'));
    expect(flat(r.getByTestId('auth-apple').props.style).backgroundColor).toBe('#FFFFFF');
    expect(textStyleOf(r, 'Sign in with Apple').color).toBe('#000000');
    expect(new Set(fills(r.getByTestId('auth-apple-logo') as unknown as Node))).toEqual(new Set(['#000000']));
  });

  test('Google: tek renk "G" (metin rengi), çok renkli G yok; beyaz yüzey + ince kenar', () => {
    const r = render(wrap(<AuthSheet />));
    const g = fills(r.getByTestId('auth-google-logo') as unknown as Node);
    expect(g.length).toBe(4);
    expect(new Set(g)).toEqual(new Set(['#1F1F1F']));
    expect(g.some((f) => ['#4285F4', '#34A853', '#FBBC05', '#EA4335'].includes(f))).toBe(false);
    expect(flat(r.getByTestId('auth-google').props.style)).toMatchObject({ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0' });
  });

  test('Apple yalnız iOS (geliştirmede vitrin için her platform); giriş mantığı aynı (signInWithApple)', () => {
    const s = src('src/modules/kayit/auth/AuthSheet.tsx');
    expect(s).toMatch(/\{iosApple \|\| __DEV__ \? \(\s*<SocialButton testID="auth-apple" kind="apple"/);
    expect(s).toMatch(/m === 'apple' \? signInWithApple\(\) : signInWithGoogle\(\)/);
  });
});

describe('md.0 K1 · E1 · E2 aynı düzen', () => {
  test('K1: Apple / Google / E-posta 50 pt · 15/600; Google tek renk; aralık 10', () => {
    mockParams = { path: 'a' };
    const r = render(wrap(<SignupScreen />));
    for (const id of ['kayit-apple', 'kayit-google', 'kayit-email']) {
      expect(flat(r.getByTestId(id).props.style)).toMatchObject({ height: 50, borderRadius: 25 });
    }
    expect(textStyleOf(r, 'Google ile devam et')).toMatchObject({ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 });
    expect(new Set(fills(r.getByTestId('kayit-google-logo') as unknown as Node))).toEqual(new Set(['#1F1F1F']));
    expect(src('src/modules/kayit/screens/SignupScreens.tsx')).toMatch(/marginTop: 28, gap: AUTH_BTN\.gap/);
  });

  test('E1 / E2: giriş düğmesi (Kodu gönder / Doğrula) 50 pt · 15/600', () => {
    mockParams = { path: 'a', mode: 'login' };
    const r = render(wrap(<EmailScreen />));
    expect(flat(r.getByTestId('kayit-send-code').props.style)).toMatchObject({ height: 50, borderRadius: 25 });
    const s = src('src/modules/kayit/screens/SignupScreens.tsx');
    expect(s.match(/<KButton size="auth" testID="kayit-(send-code|verify|review-login)"/g)?.length).toBe(3);
  });
});
