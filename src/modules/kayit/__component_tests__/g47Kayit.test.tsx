// G47-S1 — tek giriş katmanı (AuthSheet), çıkış → onboarding 1, profil kapısı, eski akışların kaldırılması, L2 rıza yeri.
//  (a) onboarding 5 "Giriş yap" → AuthSheet (tam ekran giriş yok)   (b) çıkış → onboarding 1
//  (c) profilsiz hesap Tara/Elle gir/su → kayıt akışı, bitince eyleme dönüş   (d) profilli hesap etkilenmez
//  (e) eski "Takibe başla" + eski karşılama rotaları bayrak açıkken kayıtlı değil   (f) inceleme e-postası şifre alanı
//  (g) bayrak kapalıyken eski davranış. Saf yönlendirici kararları: kayit/__tests__/g47.test.ts.
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
import OnboardingScreen from '../screens/OnboardingScreen';
import { EmailScreen } from '../screens/SignupScreens';
import { ResultScreen } from '../screens/PlanScreens';
import { HomeProfileGateCard } from '../ui/HomeProfileGateCard';
import { initialForEntry } from '../KayitNavigator';
import { useProfileGate } from '../gateFlow';
import { completeGateFlow } from '../gateComplete';
import { setGateRuntime, useKayitFlow, useProfileGateStore } from '../profileGate';
import { useKayit } from '../store';
import { emptyKAnswers } from '../model';
import { tr, en } from '../i18n';
import { navigationRef } from '../../../navigation/navigationRef';
import { resetToSignedOut, signedOutRoute } from '../../../navigation/signOutReset';
import { acceptPolicies } from '../../../lib/consent/store';
import { savePlan } from '../../personalPlan/api';
import { setMarketingOptIn } from '../../../lib/notify/marketing';

const ROOT = join(__dirname, '../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const ref = navigationRef as unknown as { reset: jest.Mock; navigate: jest.Mock };
const ANSWERS = { ...emptyKAnswers(), goal: 'lose' as const, gender: 'female' as const, birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, activity: 'light' as const, diet: 'all' as const, meals: 3, cooking: 'sometimes' as const, struggle: 'evening_snack' as const };

function gateOn(status: 'none' | 'has' | 'unknown', flag = true) {
  setGateRuntime({ flag, kisiselPlan: true, session: true });
  useProfileGateStore.setState({ flag, kisiselPlan: true, session: true, status, userId: 'u1' });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockRow = null;
  mockAuth.user = null;
  mockRoot.routeNames = [];
  mockRoot.routes = [];
  mockNavState.index = 1;
  mockNavState.routes = [{ name: 'Kayit' }, { name: 'Login' }];
  useKayit.getState().reset();
  useKayitFlow.getState().setFlow({ origin: 'onb', returnTo: null, method: null, fresh: false });
  useProfileGateStore.setState({ flag: false, kisiselPlan: false, session: false, status: 'unknown', userId: null });
  await AsyncStorage.clear();
});

// ─── (a) tek giriş katmanı ─────────────────────────────────────────────────────
describe('(a) AuthSheet', () => {
  test('onboarding 5 "Giriş yap" → kök `Login`; bayrak açıkken `Login` = saydam modal AuthSheet (tam ekran sayfa yok)', () => {
    const r = render(wrap(<OnboardingScreen vitrinStep={5} />));
    fireEvent.press(r.getByTestId('kayit-onb-login'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Login');
    const nav = src('src/navigation/AppNavigator.tsx');
    expect(nav).toMatch(/\{yeniKayit \? \(\s*<Stack\.Screen name="Login" component=\{AuthSheet\} options=\{\{ presentation: 'transparentModal'/);
    // Eski tam ekran giriş (LoginGate → LoginV2 / UnifiedLogin) yalnız bayrak kapalı dalda.
    expect(nav).toMatch(/\) : \(\s*<Stack\.Screen name="Login" component=\{UnifiedLoginLazy\} \/>\s*\)\}/);
  });

  test('içerik: kısa başlık, Apple (iOS native düğme), Google, "E-posta ile devam et", Koşullar · Gizlilik; modal erişilebilirlik', () => {
    const r = render(wrap(<AuthSheet />));
    expect(r.getByTestId('auth-sheet-title').props.children).toBe('Hesabına giriş yap');
    expect(r.getByTestId('apple-native')).toBeTruthy();
    expect(r.getByTestId('auth-google').props.accessibilityLabel).toBe('Google ile devam et');
    expect(r.getByTestId('auth-email').props.accessibilityLabel).toBe('E-posta ile devam et');
    expect(r.getByTestId('auth-terms')).toBeTruthy();
    expect(r.getByTestId('auth-privacy')).toBeTruthy();
    expect(r.getByTestId('auth-sheet').props.accessibilityViewIsModal).toBe(true);
    expect(r.queryByText(/Devam etmek için giriş yap/)).toBeNull();
    // Düğme ölçüleri K1 ile aynı (56 pt, yarıçap 28); kapat ≥ 44 pt.
    expect(flat(r.getByTestId('auth-email').props.style)).toMatchObject({ height: 56, borderRadius: 28 });
    expect(flat(r.getByTestId('auth-sheet-close').props.style)).toMatchObject({ width: 44, height: 44 });
    const en = render(wrap(<AuthSheet />, 'dark', 'en'));
    expect(en.getByTestId('auth-sheet-title').props.children).toBe('Log in to your account');
  });

  test('kapat: X / karartma → geri; E-posta → AuthEmail (E1, giriş kipi)', () => {
    const r = render(wrap(<AuthSheet />));
    fireEvent.press(r.getByTestId('auth-sheet-close'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    const r2 = render(wrap(<AuthSheet />));
    fireEvent.press(r2.getByTestId('auth-sheet-scrim', { includeHiddenElements: true }));
    expect(mockNav.goBack).toHaveBeenCalledTimes(2);
    const r3 = render(wrap(<AuthSheet />));
    fireEvent.press(r3.getByTestId('auth-email'));
    expect(mockNav.replace).toHaveBeenCalledWith('AuthEmail', { mode: 'login', redirectTo: undefined });
  });

  test('Google ile giriş, profil YOK → kök: Ana sayfa + kayıt akışı (P1, K1 atlanır; köken auth)', async () => {
    mockAuth.signInWithGoogle.mockImplementation(async () => {
      mockAuth.user = { id: 'u9', created_at: new Date().toISOString() };
      return { error: null };
    });
    setGateRuntime({ flag: true, kisiselPlan: true, session: false });
    const r = render(wrap(<AuthSheet />));
    await act(async () => {
      fireEvent.press(r.getByTestId('auth-google'));
    });
    r.rerender(wrap(<AuthSheet />));
    await flush();
    expect(ref.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Tabs', params: { screen: 'Tracker' } },
        { name: 'Kayit', params: { entry: 'auth', returnTo: null } },
      ],
    });
    expect(useKayitFlow.getState()).toMatchObject({ origin: 'auth', method: 'google', fresh: true });
    expect(initialForEntry('auth')).toEqual({ name: 'KQuestions', params: { path: 'a' } });
  });

  test('Google ile giriş, profil VAR → Ana sayfa', async () => {
    mockRow = { target_calories: 1900 };
    mockAuth.signInWithGoogle.mockImplementation(async () => {
      mockAuth.user = { id: 'u8', created_at: '2025-01-01T00:00:00Z' };
      return { error: null };
    });
    const r = render(wrap(<AuthSheet />));
    await act(async () => {
      fireEvent.press(r.getByTestId('auth-google'));
    });
    r.rerender(wrap(<AuthSheet />));
    await flush();
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
  });

  test('sipariş akışından (redirectTo Checkout) → o ekran; uygulama içi ekranın üstünden → katman kapanır', async () => {
    mockAuth.signInWithGoogle.mockImplementation(async () => {
      mockAuth.user = { id: 'u7' };
      return { error: null };
    });
    mockParams = { redirectTo: 'Checkout' };
    const r = render(wrap(<AuthSheet />));
    await act(async () => {
      fireEvent.press(r.getByTestId('auth-google'));
    });
    r.rerender(wrap(<AuthSheet />));
    await flush();
    expect(mockNav.replace).toHaveBeenCalledWith('Checkout');
    expect(ref.reset).not.toHaveBeenCalled();
  });
});

// ─── (f) inceleme e-postası ────────────────────────────────────────────────────
describe('(f) E1 giriş kipi — inceleme adresi şifre alanı AYNEN', () => {
  test('inceleme adresi → şifre alanı + "Şifreyle giriş"; normal adres → kod gönder', async () => {
    mockParams = { mode: 'login' };
    const r = render(wrap(<EmailScreen />));
    expect(r.getByTestId('auth-e1')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('kayit-email-input'), 'ali@ornek.com');
    expect(r.queryByTestId('kayit-review-password')).toBeNull();
    expect(r.getByTestId('kayit-send-code')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('kayit-email-input'), 'Apple@inceleme.eatkcal.com ');
    fireEvent.changeText(r.getByTestId('kayit-review-password'), 'x-test-pw');
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-review-login'));
    });
    expect(mockAuth.signIn).toHaveBeenCalledWith('apple@inceleme.eatkcal.com', 'x-test-pw');
  });
});

// ─── (b) çıkış → onboarding 1 ──────────────────────────────────────────────────
describe('(b) oturum kapanınca onboarding 1', () => {
  test('bayrak açık (kökte Kayit kayıtlı) → Kayit · signedOut; aynı sıfırlama iki kez yapılmaz', () => {
    mockRoot.routeNames = ['Kayit', 'Tabs', 'Login'];
    mockRoot.routes = [{ name: 'Tabs' }];
    resetToSignedOut(true);
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Kayit', params: { entry: 'signedOut' } }] });
    mockRoot.routes = [{ name: 'Kayit', params: { entry: 'signedOut' } }];
    resetToSignedOut(true);
    expect(ref.reset).toHaveBeenCalledTimes(1);
    expect(initialForEntry('signedOut')).toEqual({ name: 'KOnb' });
  });

  test('oturum dinleyicisi (çıkış / hesap silme / süre dolması) + onboarding kaldığı yer silinir (ekran dosyası G42 ile aynı)', () => {
    const nav = src('src/navigation/AppNavigator.tsx');
    expect(nav).toMatch(/if \(had && !session && yeniKayit\) resetToSignedOut\(yeniOnboarding\);/);
    const kn = src('src/modules/kayit/KayitNavigator.tsx');
    expect(kn).toMatch(/p\.entry === 'signedOut'\) \{\s*void kv\.removeItem\(ONB_KEY\)/);
  });

  test('(g) bayrak kapalı → bugünkü hedefler (Onboarding / WelcomeGate)', () => {
    mockRoot.routeNames = ['WelcomeGate', 'Onboarding', 'Tabs'];
    mockRoot.routes = [{ name: 'Tabs' }];
    resetToSignedOut(false);
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WelcomeGate' }] });
    expect(signedOutRoute(true)).toBe('Onboarding');
    expect(signedOutRoute(false)).toBe('WelcomeGate');
    expect(signedOutRoute(true, true)).toBe('Kayit');
  });
});

// ─── (c)/(d) profil kapısı ─────────────────────────────────────────────────────
function GateHarness({ onReady }: { onReady: (g: ReturnType<typeof useProfileGate>) => void }) {
  const g = useProfileGate((n, p) => mockNav.navigate(n, p));
  onReady(g);
  return (
    <Pressable testID="water" onPress={() => g.require({ name: 'Tabs', params: { screen: 'Tracker', params: { finAddWater: true } } })}>
      <Text>{g.blocked ? 'blocked' : 'open'}</Text>
    </Pressable>
  );
}

describe('(c)/(d) profil kapısı', () => {
  test('(c) profilsiz: su/Elle gir → doğrudan kayıt akışı (uyarı sayfası yok); dönüş hedefi dokunulan eylem', async () => {
    mockAuth.user = { id: 'u1' };
    gateOn('none');
    let g: ReturnType<typeof useProfileGate> | null = null;
    const r = render(wrap(<GateHarness onReady={(x) => (g = x)} />));
    await flush();
    expect(r.getByText('blocked')).toBeTruthy();
    fireEvent.press(r.getByTestId('water'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Kayit', { entry: 'gate', returnTo: { name: 'Tabs', params: { screen: 'Tracker', params: { finAddWater: true } } } });
    expect(g!.require({ name: 'Tabs', params: { screen: 'Tracker', params: { finOpenManual: 'lunch' } } })).toBe(true);
  });

  test('(c) akış bitince Tara açılır (Ana sayfa + AiScan)', async () => {
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    completeGateFlow({ name: 'AiScan' });
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    expect(ref.navigate).toHaveBeenCalledWith('AiScan', undefined);
    raf.mockRestore();
  });

  test('(c) Ana sayfa kartı: "Planını oluştur" + lime "Başla" → kayıt akışı', () => {
    const onStart = jest.fn();
    const r = render(wrap(<HomeProfileGateCard onStart={onStart} />));
    expect(r.getByText('Planını oluştur')).toBeTruthy();
    expect(r.getByText('Günlük kalori hedefin ve takibin için 1 dakika')).toBeTruthy();
    const b = r.getByTestId('home-profile-gate-start');
    expect(b.props.accessibilityLabel).toBe('Başla');
    fireEvent.press(b);
    expect(onStart).toHaveBeenCalled();
    const tracker = src('src/screens/TrackerScreen.tsx');
    expect(tracker).toMatch(/yeniKabuk && profileGate\.blocked \? <HomeProfileGateCard onStart=\{\(\) => profileGate\.require\(null\)\} \/> : null/);
    expect(tracker).toMatch(/yeniKabuk && !profileGate\.blocked \? \(\s*<TrackerDayHeader/);
    // Elle gir, su, öğün kaydı kapıdan geçer.
    expect(tracker).toMatch(/const openMealFormFor = \(slot: SlotKey\) => \{\s*if \(profileGate\.require/);
    expect(tracker).toMatch(/const handleWaterAdd = \(\) => \{\s*if \(profileGate\.require/);
    expect(tracker).toMatch(/const logToSlot = \(slot: SlotKey, portion = 1\) => \{\s*if \(profileGate\.require\(aiTarama \? \{ name: 'AiScan' \}/);
  });

  test('(d) profilli hesap ve bilinmeyen durum etkilenmez', async () => {
    mockAuth.user = { id: 'u1' };
    mockRow = { target_calories: 2000 };
    gateOn('has');
    const r = render(wrap(<GateHarness onReady={() => undefined} />));
    await flush();
    expect(r.getByText('open')).toBeTruthy();
    fireEvent.press(r.getByTestId('water'));
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  test('(g) bayrak kapalı → kapı hiç kapanmaz', async () => {
    mockAuth.user = { id: 'u1' };
    gateOn('none', false);
    const r = render(wrap(<GateHarness onReady={() => undefined} />));
    await flush();
    expect(r.getByText('open')).toBeTruthy();
  });
});

// ─── (e) eski rotalar ──────────────────────────────────────────────────────────
describe('(e) eski "Takibe başla" ve eski karşılama bayrak açıkken kayıtlı değil', () => {
  test('AppNavigator: TakibeBasla / WelcomeGate / Onboarding yalnız !yeniKayit dalında; yönlendirici kökte', () => {
    const nav = src('src/navigation/AppNavigator.tsx');
    expect(nav).toMatch(/\{!yeniKayit \? <Stack\.Screen name="TakibeBasla" component=\{TakibeBaslaNavigator\} \/> : null\}/);
    expect(nav).toMatch(/\{!yeniKayit \? \(\s*<Stack\.Screen\s+name="WelcomeGate"/);
    expect(nav).toMatch(/\{!yeniKayit \? \(\s*<Stack\.Screen\s+name="Onboarding"/);
    expect(nav).toMatch(/UNSTABLE_router=\{gateRouterOverride\}/);
  });
});

// ─── md.1 L2 isteğe bağlı kutular + md.6 rıza yeri ─────────────────────────────
describe('L2 (oturum açıkken) ve rıza metni yeri', () => {
  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await flush();
  };
  async function renderL2(origin: 'auth' | 'gate', fresh = false) {
    mockAuth.user = { id: 'u5', created_at: new Date().toISOString(), user_metadata: {} };
    useKayit.getState().patch(ANSWERS);
    useKayitFlow.getState().setFlow({ origin, method: 'google', fresh, returnTo: origin === 'gate' ? { name: 'AiScan' } : null });
    const r = render(wrap(<ResultScreen />));
    await tick(50);
    return r;
  }

  test('md.6: düğme önce, rıza metni ALTINDA (11 pt, 8 pt aralık, ortalı, bağlantı aynı satırda)', async () => {
    const r = await renderL2('gate');
    const footer = r.getByTestId('kayit-result-footer');
    const ids = footer.findAll((n: { props: { testID?: string } }) => n.props.testID === 'kayit-save-plan' || n.props.testID === 'kayit-health-consent').map((n: { props: { testID?: string } }) => n.props.testID);
    expect(ids.indexOf('kayit-save-plan')).toBeLessThan(ids.indexOf('kayit-health-consent'));
    expect(flat(r.getByTestId('kayit-health-consent').props.style)).toMatchObject({ fontSize: 11, lineHeight: 14, marginTop: 8, textAlign: 'center' });
    expect(String(r.getByTestId('kayit-consent-link').props.children)).toContain(' ');
    expect(src('src/modules/kayit/screens/QuestionsScreen.tsx')).toMatch(/<KButton testID="kayit-next"[^\n]*\/>\s*\{needsConsent \? <HealthConsentNote \/> : null\}/);
  });

  test('profil kapısından (gate): kutu yok, rıza yazılmaz (hesap zaten kayıtlı), plan kaydedilir → dokunulan eyleme dönüş', async () => {
    const r = await renderL2('gate');
    expect(r.queryByTestId('kayit-l2-meta')).toBeNull();
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-save-plan'));
    });
    await flush();
    expect(savePlan).toHaveBeenCalled();
    expect(acceptPolicies).not.toHaveBeenCalled();
    expect(useProfileGateStore.getState().status).toBe('has');
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    await tick(20);
    expect(ref.navigate).toHaveBeenCalledWith('AiScan', undefined);
  });

  test('girişten (auth): isteğe bağlı Meta + pazarlama kutuları işaretsiz, düğmenin üstünde; işaretlenince yazılır; ilk kayıtta T1', async () => {
    const r = await renderL2('auth', true);
    const meta = r.getByTestId('kayit-l2-meta');
    const mkt = r.getByTestId('kayit-l2-marketing');
    expect(meta.props.accessibilityState).toMatchObject({ checked: false });
    expect(mkt.props.accessibilityState).toMatchObject({ checked: false });
    const footer = r.getByTestId('kayit-result-footer');
    const ids = footer.findAll((n: { props: { testID?: string } }) => ['kayit-l2-meta', 'kayit-save-plan', 'kayit-health-consent'].includes(n.props.testID ?? '')).map((n: { props: { testID?: string } }) => n.props.testID);
    expect(ids.filter((x: string | undefined, i: number) => ids.indexOf(x) === i)).toEqual(['kayit-l2-meta', 'kayit-save-plan', 'kayit-health-consent']);
    await act(async () => {
      fireEvent.press(meta);
    });
    await act(async () => {
      fireEvent.press(mkt);
    });
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-save-plan'));
    });
    await flush();
    expect(acceptPolicies).toHaveBeenCalledWith(expect.objectContaining({ source: 'signup_social', adOn: true }));
    expect(setMarketingOptIn).toHaveBeenCalledWith(true);
    expect(mockNav.navigate).toHaveBeenCalledWith('KOffer');
  });
});

test('metinler TR + EN eksiksiz', () => {
  for (const L of [tr, en]) {
    const a = (L as unknown as { auth: Record<string, string>; gate: Record<string, string>; plan: Record<string, string> });
    for (const k of ['title', 'close', 'terms', 'privacy', 'offline_sub']) expect(a.auth[k]).toBeTruthy();
    for (const k of ['title', 'sub', 'cta']) expect(a.gate[k]).toBeTruthy();
    expect(a.plan.save_error).toBeTruthy();
  }
  expect(tr.gate.title).toBe('Planını oluştur');
  expect(tr.auth.title).toBe('Hesabına giriş yap');
  expect(en.auth.title).toBe('Log in to your account');
});
