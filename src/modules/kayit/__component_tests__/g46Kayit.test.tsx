// G46-S1 — Kayıt akışı son düzeltmeler.
//  1. L2 kilo tahmini grafiği: uç nokta (daire) ve çizgi SVG alanının içinde (sağ/üst/alt iç boşluk), kırpma yok.
//  2. T1 aylık sekmesi: "Deneme yok" yazısı/rozeti yok (erişilebilirlik etiketinde de yok); deneme rozeti yalnız yıllıkta.
//  3. T1 kapatma onayı: X → alttan onay sayfası; "Denemeye başla" → seçili planın denemeli ürünüyle satın alma;
//     "Yine de çık" → HA; `paywall_dismiss_confirm` (choice stay|leave); T1 cihaz + hesap bazında bir kez.
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
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
  return { ...m, useSharedValue, default: { ...m.default, useSharedValue } };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: null, signInWithApple: jest.fn(), signInWithGoogle: jest.fn() }) }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
const mockUpdateUser = jest.fn(async (_: unknown) => ({ data: {}, error: null }));
jest.mock('../../../core/supabase', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'maybeSingle', 'order', 'limit']) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
  const client = { from: () => q, auth: { updateUser: (a: unknown) => mockUpdateUser(a) }, functions: { invoke: async () => ({ data: null, error: null }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
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
const mockPurchase = jest.fn(async (_: string) => 'cancelled');
jest.mock('../../../lib/subscription/purchases', () => ({ purchasePlan: (k: string) => mockPurchase(k), restorePurchases: jest.fn(async () => 'none') }));
jest.mock('../../subscription/ui/SubLegalLinks', () => () => null);
jest.mock('../../coach/access', () => ({ useCoachEnabled: () => true }));
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => true), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../../lib/consent/store', () => ({ recordHealthConsent: jest.fn(async () => true), acceptPolicies: jest.fn(async () => true) }));
jest.mock('../../plan/client', () => ({ fetchRecipeCatalog: jest.fn(async () => ({ recipes: [] })) }));
jest.mock('../../../lib/banners', () => ({ fetchBannerRows: jest.fn(async () => ({ hero: [], promo: [] })) }));
jest.mock('../../gun/home/useHomeRegion', () => ({ useHomeRegion: () => 'unknown' }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: undefined }), useFocusEffect: () => {} };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import OfferScreen from '../screens/OfferScreen';
import { ResultScreen } from '../screens/PlanScreens';
import { WEIGHT_CHART } from '../ui/chart';
import { noLig } from '../ui/parts';
import { useKayit } from '../store';
import { emptyKAnswers, type KAnswers } from '../model';
import { computeKayitPlan, planSignature } from '../plan';
import { __sent } from '../events';
import { offerAllowed, markOfferShown } from '../offerOnce';
import { OFFER_META_KEY, OFFER_SHOWN_KEY } from '../storage';
import { tr, en } from '../i18n';
import { EVENTS } from '../../../lib/metrics/events';

const ROOT = join(__dirname, '../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  __sent.length = 0;
  await AsyncStorage.clear();
  useKayit.getState().reset();
});

// ─── md.1 ─────────────────────────────────────────────────────────────────────
describe('md.1 L2 kilo tahmini grafiği', () => {
  const answers: KAnswers = { ...emptyKAnswers(), goal: 'lose', gender: 'female', birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, pace: 0.5, activity: 'light', meals: 4 };
  const setup = () => {
    const s = useKayit.getState();
    s.setPath('a');
    s.patch(answers);
    const plan = computeKayitPlan(answers, { currentYear: 2026, startIso: '2026-11-14' });
    s.setPlan(plan, planSignature(answers));
    s.setCalcDone(true);
  };
  it.each([
    [375, 'light'],
    [430, 'dark'],
  ] as const)('%i pt (%s): uç dairesi + kenar SVG genişliği/yüksekliği içinde, kırpma kapalı', async (screen, scheme) => {
    const spy = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: screen, height: 900, scale: 3, fontScale: 1 });
    setup();
    const r = render(wrap(<ResultScreen />, scheme));
    await flush();
    const svg = r.getByTestId('kayit-weight-chart');
    const end = r.getByTestId('kayit-weight-end');
    const w = Number(svg.props.width ?? svg.props.bbWidth);
    const h = Number(svg.props.height ?? svg.props.bbHeight);
    const cx = Number(end.props.cx);
    const cy = Number(end.props.cy);
    const outer = WEIGHT_CHART.endR + WEIGHT_CHART.endStroke / 2;
    expect(w).toBe(screen - 78);
    expect(cx + outer).toBeLessThanOrEqual(w);
    expect(cy + outer).toBeLessThanOrEqual(h);
    expect(cy - outer).toBeGreaterThanOrEqual(0);
    r.unmount();
    spy.mockRestore();
  });
  it('kaynak: Svg overflow visible + iç boşluklu geometri (sabit "w - 6" yok)', () => {
    const p = src('src/modules/kayit/screens/PlanScreens.tsx');
    expect(p).toMatch(/testID="kayit-weight-chart"[^\n]*overflow: 'visible'/);
    expect(p).not.toMatch(/cx=\{w - 6\}/);
    expect(p).toMatch(/weightChartGeometry\(w, down\)/);
  });
});

// ─── md.2 ─────────────────────────────────────────────────────────────────────
describe('md.2 T1 aylık sekmesinde deneme rozeti yok', () => {
  it('aylık: "deneme yok" yazısı ve deneme rozeti hiç yok; fiyat ve yasal metin aynı', async () => {
    const r = render(wrap(<OfferScreen vitrinPeriod="monthly" />));
    await flush();
    expect(r.queryByText(/deneme yok/i)).toBeNull();
    expect(r.queryByText(/gün ücretsiz$/)).toBeNull();
    expect(r.queryByTestId('kayit-offer-trial-badge')).toBeNull();
    const bal = r.getByTestId('kayit-plan-balance');
    expect(bal.props.accessibilityLabel).not.toMatch(/deneme/i);
    expect(r.getAllByText('149 TL/ay')).toHaveLength(2);
    expect(r.getByText('149 TL/ay, her ay otomatik yenilenir.')).toBeTruthy();
    expect(r.getByText(noLig(tr.offer.renew))).toBeTruthy();
    expect(r.getByTestId('kayit-offer-buy').props.accessibilityLabel).toBe(tr.offer.cta_sub);
  });
  it('yıllık: deneme rozeti ve deneme koşulu metni yalnız denemeli planda', async () => {
    const r = render(wrap(<OfferScreen vitrinPeriod="yearly" />));
    await flush();
    expect(r.getAllByTestId('kayit-offer-trial-badge')).toHaveLength(2);
    expect(r.getByText('7 gün ücretsiz, sonra 999 TL/yıl. Ücret deneme bitince alınır.')).toBeTruthy();
  });
  it('EN: "no trial" anahtarı kaldırıldı (TR + EN)', async () => {
    expect((tr.offer as Record<string, string>).no_trial).toBeUndefined();
    expect((en.offer as Record<string, string>).no_trial).toBeUndefined();
    const r = render(wrap(<OfferScreen vitrinPeriod="monthly" />, 'light', 'en'));
    await flush();
    expect(r.queryByText(/no trial/i)).toBeNull();
  });
});

// ─── md.3 ─────────────────────────────────────────────────────────────────────
describe('md.3 T1 kapatma onayı', () => {
  it('X → onay sayfası açılır (doğrudan kapanmaz); metinler TR', async () => {
    const r = render(wrap(<OfferScreen />));
    await flush();
    expect(r.queryByTestId('kayit-offer-confirm')).toBeNull();
    fireEvent.press(r.getByTestId('kayit-offer-close'));
    await flush();
    expect(r.getByTestId('kayit-offer-confirm')).toBeTruthy();
    expect(mockNav.reset).not.toHaveBeenCalled();
    expect(r.getByText('7 gün ücretsiz deneme hakkını bırakıyor musun?')).toBeTruthy();
    expect(r.getByText('Bu teklif yalnız kayıt sonrası gösterilir; bu ekrandan çıkarsan bir daha karşına çıkmaz.')).toBeTruthy();
    expect(r.getByTestId('kayit-offer-confirm-stay').props.accessibilityLabel).toBe('Denemeye başla');
    expect(r.getByText('Yine de çık')).toBeTruthy();
    // HIG: denemeli ürünün süresi + deneme sonrası ücret düğmenin altında.
    expect(r.getByTestId('kayit-offer-confirm-terms')).toHaveTextContent('7 gün ücretsiz, sonra 999 TL/yıl. Ücret deneme bitince alınır.');
  });
  it('"Yine de çık" → HA (Tabs/Tracker) + paywall_dismiss_confirm leave', async () => {
    const r = render(wrap(<OfferScreen />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-offer-close'));
    await flush();
    fireEvent.press(r.getByTestId('kayit-offer-confirm-leave'));
    await flush();
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Tracker' } }] });
    expect(__sent.filter((e) => e.name === 'paywall_dismiss_confirm')).toEqual([{ name: 'paywall_dismiss_confirm', props: { choice: 'leave' } }]);
    expect(mockPurchase).not.toHaveBeenCalled();
  });
  it('"Denemeye başla" → sayfa kapanır, seçili planın denemeli (yıllık) ürünüyle satın alma; aylık sekmede de', async () => {
    const r = render(wrap(<OfferScreen vitrinPeriod="monthly" />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-plan-fresh'));
    fireEvent.press(r.getByTestId('kayit-offer-close'));
    await flush();
    fireEvent.press(r.getByTestId('kayit-offer-confirm-stay'));
    await flush();
    expect(mockPurchase).toHaveBeenCalledWith('fresh_yearly');
    expect(mockNav.reset).not.toHaveBeenCalled();
    expect(__sent.filter((e) => e.name === 'paywall_dismiss_confirm').map((e) => e.props)).toEqual([{ choice: 'stay' }]);
  });
  it('EN metinleri', async () => {
    const r = render(wrap(<OfferScreen vitrinConfirm />, 'dark', 'en'));
    await flush();
    expect(r.getByText('Leave your 7-day free trial?')).toBeTruthy();
    expect(r.getByText(noLig("This offer is only shown after signup. If you leave now, you won't see it again."))).toBeTruthy();
    expect(r.getByText('Start free trial')).toBeTruthy();
    expect(r.getByText('Leave anyway')).toBeTruthy();
  });
  it('metin süre baskısı içermez (App Store 5.6): "süre", "doluyor", "son şans", "expires" yok', () => {
    for (const s of [tr.offer.confirm_title, tr.offer.confirm_body, en.offer.confirm_title, en.offer.confirm_body]) {
      expect(s).not.toMatch(/süre|doluyor|son şans|acele|expir|hurry|last chance|ending/i);
    }
  });
  it('olay sözlükte; prop yalnız choice (sağlık değeri yok)', () => {
    const d = (EVENTS as Record<string, { props: Record<string, unknown> }>).paywall_dismiss_confirm;
    expect(d.props).toEqual({ choice: ['stay', 'leave'] });
    expect(src('supabase/migrations/20261114100100_g46_paywall_dismiss_confirm.sql')).toMatch(/'paywall_dismiss_confirm', 'commerce', 'client'/);
    expect(src('supabase/rollbacks/20261114100100_g46_paywall_dismiss_confirm_rollback.sql')).toMatch(/delete from public\.analytics_event_names/);
  });
});

describe('md.3 T1 teklifi bir kez gösterilir (cihaz + hesap)', () => {
  it('T1 açılınca cihaz + hesap işareti yazılır; sonra kayıt sonrası T1 açılmaz', async () => {
    expect(await offerAllowed('a', {})).toBe(true);
    render(wrap(<OfferScreen />));
    await flush();
    await flush();
    expect(await AsyncStorage.getItem(OFFER_SHOWN_KEY)).toBeTruthy();
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { [OFFER_META_KEY]: expect.any(String) } });
    expect(await offerAllowed('a', {})).toBe(false);
  });
  it('başka cihazda gösterildiyse (hesap işareti) bu cihazda da açılmaz; B yolunda hiç açılmaz', async () => {
    expect(await offerAllowed('a', { [OFFER_META_KEY]: '2026-11-14T09:00:00.000Z' })).toBe(false);
    expect(await offerAllowed('b', {})).toBe(false);
  });
  it('hesap yazımı başarısız olsa da cihaz işareti kalır', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('offline'));
    await markOfferShown(Date.parse('2026-11-14T10:00:00Z'));
    expect(await AsyncStorage.getItem(OFFER_SHOWN_KEY)).toBe('2026-11-14T10:00:00.000Z');
  });
  it('vitrin (__DEV__) işaret yazmaz', async () => {
    render(wrap(<OfferScreen vitrin />));
    await flush();
    expect(await AsyncStorage.getItem(OFFER_SHOWN_KEY)).toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
  it('kayıt sonrası yönlendirme: T1 yalnız offerAllowed true ise; değilse HA (Tracker)', () => {
    const s = src('src/modules/kayit/screens/SignupScreens.tsx');
    expect(s).toMatch(/r\.path === 'a' && \(await offerAllowed\('a', meta\.current\)\)/);
    expect(s).toMatch(/meta\.current = user\?\.user_metadata/);
    expect(s).toMatch(/const tab = r\.path === 'a' \? 'Tracker' : firstTabFor/);
  });
});
