// G54-S1 md.1 — Kayıt sonu paywall kuralı: aboneliksiz herkese T1 (hesap yaşı/köken fark etmez), aboneliye yok,
// X → onay → "Yine de çık" → dokunulan eylem, satın alma → tebrik → dokunulan eylem.
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
let mockCoach = false;
jest.mock('../../coach/access', () => ({ useCoachEnabled: () => mockCoach }));
jest.mock('../../subscription/ui/SubLegalLinks', () => () => null);
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
const card = (tier: 'balance' | 'fresh', yearly: boolean) => ({
  key: `${tier}_${yearly ? 'yearly' : 'monthly'}`,
  tier,
  yearly,
  productId: `p_${tier}_${yearly}`,
  price: yearly ? 999 : 149,
  currency: 'TRY',
  priceText: yearly ? '999 TL' : '149 TL',
  weeklyText: '',
  monthlyText: yearly ? '83 TL' : null,
  discountPct: yearly ? 44 : null,
  trialDays: yearly ? 7 : null,
  popular: tier === 'balance',
});
const mockCards = [card('balance', true), card('fresh', true), card('balance', false), card('fresh', false)];
jest.mock('../../../lib/subscription/usePlanCards', () => ({ usePlanCards: () => ({ cards: mockCards, loading: false, failed: false, reload: jest.fn() }) }));
const mockPurchase = jest.fn(async (_: string) => 'success');
jest.mock('../../../lib/subscription/purchases', () => ({ ...jest.requireActual('../../../lib/subscription/purchases'), purchasePlan: (k: string) => mockPurchase(k), restorePurchases: jest.fn(async () => 'none') }));
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
import { ResultScreen } from '../screens/PlanScreens';
import QuestionsScreen from '../screens/QuestionsScreen';
import OfferScreen from '../screens/OfferScreen';
import { useKayitFlow, useProfileGateStore } from '../profileGate';
import { useKayit } from '../store';
import { emptyKAnswers } from '../model';
import { navigationRef } from '../../../navigation/navigationRef';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';
import { offerAllowed } from '../offerOnce';
import { OFFER_META_KEY, offerDeviceKey } from '../storage';

const ROOT = join(__dirname, '../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async (n = 8) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};
const ref = navigationRef as unknown as { reset: jest.Mock; navigate: jest.Mock };
const ANSWERS = { ...emptyKAnswers(), goal: 'lose' as const, gender: 'female' as const, birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, activity: 'light' as const, diet: 'all' as const, meals: 3, cooking: 'sometimes' as const, struggle: 'evening_snack' as const };
/** İlter'in cihaz testi: Mayıs 2026'da açılmış ESKİ hesap, profilsiz, abonesiz. */
const OLD_USER = { id: 'u-old', created_at: '2026-05-03T10:00:00Z', user_metadata: {} };
const LIMITS = { ai: { free: 2, fresh: 10, balance: 50 }, barcode: { free: 3, fresh: null, balance: null } };

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockAuth.user = null;
  await AsyncStorage.clear();
  useKayit.getState().reset();
  useSubscriptionStore.setState({ rc: null, server: null, limits: LIMITS as never });
  useKayitFlow.getState().setFlow({ origin: 'onb', returnTo: null, method: null, fresh: false });
  useProfileGateStore.setState({ flag: false, kisiselPlan: false, session: false, status: 'unknown', userId: null });
});

async function saveL2(origin: 'gate' | 'auth' | 'onb', user: typeof OLD_USER = OLD_USER) {
  mockAuth.user = user;
  useKayit.getState().patch(ANSWERS);
  useKayitFlow.getState().setFlow({ origin, method: 'google', fresh: false, returnTo: origin === 'gate' ? { name: 'AiScan' } : null });
  const r = render(wrap(<ResultScreen />));
  await tick(50);
  await act(async () => {
    fireEvent.press(r.getByTestId('kayit-save-plan'));
  });
  await flush();
  return r;
}

describe('G54 md.1 kayıt sonu T1 kuralı (aboneliksiz HERKES, hesap bazında bir kez)', () => {
  test('eski hesap (Mayıs 2026) + profilsiz + abonesiz → Tara kapısından kayıt bitince T1 (dönüş: Tara)', async () => {
    await saveL2('gate');
    expect(mockNav.navigate).toHaveBeenCalledWith('KayitOffer', { returnTo: { name: 'AiScan' } });
    expect(ref.reset).not.toHaveBeenCalled();
  });
  test('köken fark etmez: girişten sonra (auth, yeni olmayan hesap) → T1', async () => {
    await saveL2('auth');
    expect(mockNav.navigate).toHaveBeenCalledWith('KayitOffer', { returnTo: null });
  });
  test('onboarding yolu (oturumsuz L2 → K1 kayıt) da aynı kararı kullanır', async () => {
    await saveL2('onb');
    expect(mockNav.navigate).toHaveBeenCalledWith('KSignup', { path: 'a' });
    expect(src('src/modules/kayit/screens/SignupScreens.tsx')).toMatch(/openOfferIfAllowed\(navigation, \{ userId: user\.id, meta: meta\.current, returnTo: null \}\)/);
  });
  test('aktif abonelik (Fresh deneme dahil) → T1 yok, doğrudan dokunulan eylem (Tara)', async () => {
    useSubscriptionStore.setState({ rc: { tier: 'fresh', productId: 'kcalai_fresh_yearly', expiresAt: '2026-11-21T10:00:00Z', willRenew: true, trial: true, store: 'APP_STORE', managementURL: null } as never });
    await saveL2('gate');
    expect(mockNav.navigate).not.toHaveBeenCalledWith('KayitOffer', expect.anything());
    expect(ref.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    await tick(20);
    expect(ref.navigate).toHaveBeenCalledWith('AiScan', undefined);
  });
  test('sunucu hakkı Balance (RevenueCat yokken) → T1 yok', async () => {
    useSubscriptionStore.setState({ server: { tier: 'balance' } as never });
    expect(await offerAllowed('u-old', {})).toBe(false);
  });
  test('bu hesapta daha önce gösterildiyse (metadata ya da cihaz yedeği) T1 yok; başka hesap etkilenmez', async () => {
    expect(await offerAllowed('u-old', { [OFFER_META_KEY]: '2026-11-10T09:00:00Z' })).toBe(false);
    await AsyncStorage.setItem(offerDeviceKey('u-old'), '2026-11-10T09:00:00Z');
    expect(await offerAllowed('u-old', {})).toBe(false);
    expect(await offerAllowed('u-yeni', {})).toBe(true);
  });
  test('B kısa profil son adımı da kayıt sonu → T1 (dönüş hedefiyle)', async () => {
    mockAuth.user = OLD_USER;
    mockParams = { mode: 'short', origin: 'gate', returnTo: { name: 'AiScan' }, vitrinStep: 'activity', vitrinAnswers: { goal: 'lose', gender: 'female', birthYear: 1995, heightCm: 170, weightKg: 72, activity: 'light' } };
    const r = render(wrap(<QuestionsScreen />));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-next'));
    });
    await flush();
    expect(mockNav.navigate).toHaveBeenCalledWith('KayitOffer', { returnTo: { name: 'AiScan' } });
  });
  test('isFreshAccount karar için kullanılmaz (kaynak)', () => {
    for (const f of ['src/modules/kayit/screens/PlanScreens.tsx', 'src/modules/kayit/screens/SignupScreens.tsx', 'src/modules/kayit/screens/QuestionsScreen.tsx', 'src/modules/kayit/offerOnce.ts']) {
      expect(src(f).replace(/\/\/[^\n]*/g, '')).not.toMatch(/flow\.fresh &&|isFreshAccount\(/);
    }
  });
});

describe('G54 md.1 T1 kapanışı ve tebrik → dokunulan eylem', () => {
  const RET = { name: 'AiScan' };
  beforeEach(() => {
    mockCoach = true;
  });
  afterEach(() => {
    mockCoach = false;
  });
  test('X → onay → "Yine de çık" → T1 kapanır, Tara açılır (Ana sayfa altında)', async () => {
    mockAuth.user = OLD_USER;
    const r = render(wrap(<OfferScreen returnTo={RET} />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-offer-close'));
    await flush();
    expect(r.getByText('7 gün ücretsiz deneme hakkını bırakıyor musun?')).toBeTruthy();
    expect(r.getByText('Bu teklif yalnız kayıt sonrası gösterilir; bu ekrandan çıkarsan bir daha karşına çıkmaz.')).toBeTruthy();
    expect(r.queryByText(/süresi doluyor/)).toBeNull();
    fireEvent.press(r.getByTestId('kayit-offer-confirm-leave'));
    await flush();
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    await tick(30);
    expect(mockNav.navigate).toHaveBeenCalledWith('AiScan', undefined);
  });
  test('T1 açılınca hesap + cihaz yedeği (hesap anahtarıyla) işaretlenir', async () => {
    mockAuth.user = OLD_USER;
    render(wrap(<OfferScreen returnTo={RET} />));
    await flush();
    expect(await AsyncStorage.getItem(offerDeviceKey('u-old'))).toBeTruthy();
  });
  test.each([
    ['light', 'tr'],
    ['dark', 'en'],
  ] as const)('satın alma (mock) başarılı → tebrik (%s/%s) → "Başlayalım" → Tara', async (scheme, lang) => {
    mockAuth.user = OLD_USER;
    const r = render(wrap(<OfferScreen returnTo={RET} />, scheme, lang));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-offer-buy'));
    });
    await flush();
    expect(mockPurchase).toHaveBeenCalledWith('balance_yearly');
    expect(r.getByTestId('kayit-offer-success')).toBeTruthy();
    expect(r.getByTestId('kayit-offer-success-title')).toHaveTextContent(lang === 'tr' ? 'Hoş geldin, Kcalculate AI Balance!' : 'Welcome to Kcalculate AI Balance!');
    // Balance: AI sayısı (app_settings) + Koç + barkod/elle — 3 satır; deneme notu.
    expect(r.getByTestId('kayit-offer-success-right-ai')).toHaveTextContent(lang === 'tr' ? 'Günde 50 AI tarama' : '50 AI scans a day');
    expect(r.getByTestId('kayit-offer-success-right-coach')).toBeTruthy();
    expect(r.getByTestId('kayit-offer-success-right-barcode')).toBeTruthy();
    expect(r.getByTestId('kayit-offer-success-terms')).toHaveTextContent(lang === 'tr' ? /tarihine kadar ücretsiz; istediğin an mağazadan iptal edebilirsin\.$/ : /^Your trial is free until .+; cancel any time in the store\.$/);
    expect(r.queryByTestId('confetti')).toBeNull();
    // Otomatik geçiş yok; kullanıcı dokunur.
    await tick(300);
    expect(mockNav.reset).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('kayit-offer-success-start'));
    await tick(30);
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    expect(mockNav.navigate).toHaveBeenCalledWith('AiScan', undefined);
  });
  test('Fresh tebrik: Koç satırı yok (2 satır)', async () => {
    mockAuth.user = OLD_USER;
    const r = render(wrap(<OfferScreen returnTo={RET} />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-plan-fresh'));
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-offer-buy'));
    });
    await flush();
    expect(r.getByTestId('kayit-offer-success-right-ai')).toHaveTextContent('Günde 10 AI tarama');
    expect(r.queryByTestId('kayit-offer-success-right-coach')).toBeNull();
  });
  test('kök KayitOffer rotası kayıtlı (bayrak açık), tam ekran modal, kaydırarak kapanmaz', () => {
    const nav = src('src/navigation/AppNavigator.tsx');
    expect(nav).toMatch(/yeniKayit \? <Stack\.Screen name="KayitOffer" component=\{KayitOfferRoute as never\} options=\{\{ \.\.\.AI_MODAL, presentation: 'fullScreenModal', gestureEnabled: false \}\} \/> : null/);
  });
});
