// G34-S1 md.6/7 — Kişisel plan bileşen testleri: rıza kapısı, VKİ dalı, %1 kuralı, Sonuç
// (gerçek hesap sayıları), Düzenle tabanı + tarih kayması, Nasıl hesapladık?, Hata hâli,
// Hatırlatmalar izin reddi, giriş noktaları bayrak arkasında, check-in önerisi (Uygula / koru),
// bağlamsal paywall (fiyat yoksa hata kartı). Light + Dark + TR + EN.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
const mockFlags: Record<string, boolean> = { kisisel_plan: true, ogun_plani: false, koc: false };
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
let mockOnline = true;
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: mockOnline, isInternetReachable: mockOnline }) } }));
const mockSavePlan = jest.fn();
const mockSaveMeasurement = jest.fn();
jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return {
    ...actual,
    savePlan: (...a: unknown[]) => mockSavePlan(...a),
    saveMeasurement: (...a: unknown[]) => mockSaveMeasurement(...a),
    writeProgress: jest.fn(() => Promise.resolve()),
    clearProgress: jest.fn(() => Promise.resolve()),
    loadPlan: jest.fn(() => Promise.resolve({ saved: null, row: null })),
    loadWeighIns: jest.fn(() => Promise.resolve([])),
    readCachedPlan: jest.fn(() => Promise.resolve(null)),
  };
});
const mockRequestPush = jest.fn();
jest.mock('../../../core/push/pushPermission', () => ({ requestPushPermission: (...a: unknown[]) => mockRequestPush(...a), pushGranted: () => Promise.resolve(false) }));
jest.mock('../reminders', () => ({ syncPlanReminders: jest.fn(() => Promise.resolve(0)), cancelPlanReminders: jest.fn() }));
let mockTier: 'free' | 'fresh' | 'balance' = 'free';
let mockCards: unknown[] | null = null;
const mockPurchase = jest.fn();
jest.mock('../../../lib/subscription/purchases', () => ({
  useTier: () => ({ tier: mockTier, status: 'verified' }),
  purchasePlan: (...a: unknown[]) => mockPurchase(...a),
  restorePurchases: jest.fn(() => Promise.resolve('none')),
}));
jest.mock('../../../lib/subscription/usePlanCards', () => ({ usePlanCards: () => ({ cards: mockCards, loading: false, failed: !mockCards, reload: jest.fn() }) }));
jest.mock('../../subscription/ui/SubLegalLinks', () => () => null);

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import { usePpFlow } from '../store';
import { emptyAnswers, type PpAnswers, type PpSaved } from '../types';
import { computePlan } from '../calc';
import { useMyPlanStore } from '../useMyPlan';
import { GoalStep, TargetStep } from '../screens/flow/questions';
import { IntroStep } from '../screens/flow/entry';
import { CalcStep, HowCalc, ResultStep } from '../screens/flow/result';
import { RemindStep } from '../screens/flow/remind';
import { HomePlanCard, ProfilePlanRow } from '../ui/entries';
import CheckinScreen from '../screens/CheckinScreen';
import PlanPaywallScreen from '../screens/PlanPaywallScreen';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React2 = jest.requireActual('react');
  return {
    ...actual,
    useNavigation: () => mockNav,
    NavigationContext: React2.createContext({ navigate: (...a: unknown[]) => mockNav.navigate(...a), goBack: () => mockNav.goBack() }),
  };
});
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};

const sampleAnswers = (): PpAnswers => ({
  ...emptyAnswers(),
  consentHealth: true,
  goal: 'lose' as const,
  gender: 'female' as const,
  birthYear: 1994,
  heightCm: 168,
  weightKg: 72,
  activity: 'light' as const,
  targetWeightKg: 65,
  pace: 0.5 as const,
  exercise: ['walk' as const],
});

function seedFlow(over: Partial<PpAnswers> = {}, step: 'goal' | 'result' | 'target' = 'goal') {
  usePpFlow.getState().begin({ userId: 'u-1', origin: 'profile', known: false, answers: { ...sampleAnswers(), ...over }, step });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-12T10:00:00'));
  mockTier = 'free';
  mockCards = null;
  mockOnline = true;
  mockFlags.kisisel_plan = true;
  useMyPlanStore.getState().clear();
});

afterEach(() => {
  jest.useRealTimers();
});

const wrap = (el: React.ReactElement, lang: 'tr' | 'en' = 'tr', scheme: 'light' | 'dark' = 'light') =>
  render(
    <ThemeProvider forceScheme={scheme}>
      <I18nProvider forceLang={lang}>{el}</I18nProvider>
    </ThemeProvider>,
  );

test('Giriş: açık rıza işaretlenmeden Başla pasif; önceden verildiyse "Onaylandı" ve Başla etkin', async () => {
  usePpFlow.getState().begin({ userId: 'u-1', origin: 'profile', known: false, answers: {}, step: 'intro' });
  const next = jest.fn();
  const r = wrap(<IntroStep next={next} consentDone={false} />);
  await flush();
  fireEvent.press(r.getByTestId('pp-start'));
  expect(next).not.toHaveBeenCalled();
  expect(r.getByText('Başlamak için açık rıza kutusunu işaretle.')).toBeTruthy();
  fireEvent.press(r.getByTestId('pp-consent'));
  fireEvent.press(r.getByTestId('pp-start'));
  expect(next).toHaveBeenCalledTimes(1);
  expect(r.getAllByText('TASLAK').length).toBeGreaterThan(0);
  r.unmount();
  const r2 = wrap(<IntroStep next={next} consentDone />);
  await flush();
  expect(r2.getByText('Onaylandı')).toBeTruthy();
});

test('Hedef: VKİ < 18,5 → "Kilo ver" sunulmaz, nazik açıklama + Öneri rozetleri', async () => {
  seedFlow({ weightKg: 50, heightCm: 170, goal: null });
  const r = wrap(<GoalStep next={jest.fn()} />);
  await flush();
  expect(r.queryByTestId('pp-goal-lose')).toBeNull();
  expect(r.getByTestId('pp-lowbmi')).toBeTruthy();
  expect(r.getAllByText('Öneri').length).toBe(2);
});

test('Hedef: VKİ 18,5 ve üzeri → "Kilo ver" var', async () => {
  seedFlow({ goal: null });
  const r = wrap(<GoalStep next={jest.fn()} />);
  await flush();
  expect(r.getByTestId('pp-goal-lose')).toBeTruthy();
  expect(r.queryByTestId('pp-lowbmi')).toBeNull();
});

test('Hedef kilo: 72 kg için 0,75 kapalı + tek satır neden (en fazla 0,72); hedef tarihi 18 Şubat 2027', async () => {
  seedFlow({}, 'target');
  const r = wrap(<TargetStep next={jest.fn()} />);
  await flush();
  expect(r.getByText(/0,75 kg şu an kapalı/)).toBeTruthy();
  expect(r.getByText(/en fazla 0,72 kg/)).toBeTruthy();
  expect(r.getByTestId('pp-target-date').props.children).toBe('18 Şubat 2027');
});

test('Hedef kilo: 80 kg → 0,75 açık, neden satırı yok', async () => {
  seedFlow({ weightKg: 80, targetWeightKg: 72 }, 'target');
  const r = wrap(<TargetStep next={jest.fn()} />);
  await flush();
  expect(r.queryByText(/şu an kapalı/)).toBeNull();
});

test('Hedef kilo: kalori tabanı → tabanın altına inmez, tarih kayar ve söylenir', async () => {
  seedFlow({ heightCm: 160, weightKg: 80, activity: 'sedentary', targetWeightKg: 68, pace: 0.75 }, 'target');
  const r = wrap(<TargetStep next={jest.fn()} />);
  await flush();
  expect(r.getByTestId('pp-floor-note')).toBeTruthy();
  expect(r.getByText(/1200 kcal altına indirmiyoruz/)).toBeTruthy();
});

test('Hesaplanıyor: bağlantı yok → Hata, cevaplar korunur', async () => {
  mockOnline = false;
  seedFlow();
  const onDone = jest.fn();
  const r = wrap(<CalcStep onDone={onDone} onError={jest.fn()} />);
  await flush();
  expect(r.getByText('Hesaplayamadık')).toBeTruthy();
  expect(r.getByText('Yanıtların kayıtlı')).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
  expect(usePpFlow.getState().answers.weightKg).toBe(72);
});

test('Hesaplanıyor: gerçek zincir 5 satır, ~2,75 sn sonra Sonuç', async () => {
  seedFlow();
  const onDone = jest.fn();
  const r = wrap(<CalcStep onDone={onDone} onError={jest.fn()} />);
  await flush();
  await act(async () => {
    jest.advanceTimersByTime(3500);
  });
  expect(r.getByText('1449 kcal')).toBeTruthy();
  expect(r.getByText('1992 kcal')).toBeTruthy();
  expect(r.getByText('1440 kcal')).toBeTruthy();
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onDone.mock.calls[0][0].calories).toBe(1440);
});

function seedResult() {
  seedFlow({}, 'result');
  const res = computePlan({ goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 65, pace: 0.5 }, 2026, '2026-11-12');
  usePpFlow.getState().setResult(res);
}

test('Sonuç: makrolar ve hedef tarihi gerçek hesaptan; Nasıl hesapladık? ara değerleri', async () => {
  seedResult();
  const r = wrap(<ResultStep onStart={jest.fn()} saving={false} />);
  await flush();
  expect(r.getByText('130 g')).toBeTruthy();
  expect(r.getByText('133 g')).toBeTruthy();
  expect(r.getByText('43 g')).toBeTruthy();
  expect(r.getByTestId('pp-result-date').props.children).toBe('18 Şubat 2027');
  fireEvent.press(r.getByText('Nasıl hesapladık?'));
  await flush();
  expect(r.getByText('1449 kcal')).toBeTruthy();
  expect(r.getByText(/7 kg ÷ 0,5 kg = 14 hafta/)).toBeTruthy();
});

test('G36 md.11: Nasıl hesapladık? kas kazan 0,5 → fazla 550 → 300 kırpmasını tek satırla söyler (TR + EN)', async () => {
  const res = computePlan({ goal: 'gain', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 75, pace: 0.5 }, 2026, '2026-11-12')!;
  const answers = { ...sampleAnswers(), goal: 'gain' as const, targetWeightKg: 75, pace: 0.5 as const };
  const r = wrap(<HowCalc result={res} answers={answers} startIso="2026-11-12" defaultOpen />);
  await flush();
  expect(r.getByText('0,5 kg × 7700 ÷ 7 = 550 → 300')).toBeTruthy();
  expect(r.getByTestId('pp-how-gain-cap').props.children).toBe('Kas kazanırken günlük fazla en çok +300 kcal: 550 yerine 300 kcal, haftada 0,27 kg; hedef tarihi buna göre.');
  expect(r.getByText(/3 kg ÷ 0,27 kg = 12 hafta/)).toBeTruthy();
  expect(r.getByText('2290 kcal')).toBeTruthy();
  r.unmount();
  const en = wrap(<HowCalc result={res} answers={answers} startIso="2026-11-12" defaultOpen />, 'en');
  await flush();
  expect(en.getByTestId('pp-how-gain-cap').props.children).toMatch(/capped at \+300 kcal: 300 instead of 550, 0.27 kg per week/);
  // 0,25: kırpma yok → satır yok.
  en.unmount();
  const res25 = computePlan({ goal: 'gain', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 75, pace: 0.25 }, 2026, '2026-11-12')!;
  const r25 = wrap(<HowCalc result={res25} answers={{ ...answers, pace: 0.25 }} startIso="2026-11-12" defaultOpen />);
  await flush();
  expect(r25.queryByTestId('pp-how-gain-cap')).toBeNull();
});

test('Düzenle: kalori tabana (1200) inince uyarı; tempo 0,72 ve tarih 21 Ocak 2027; Önerilene dön', async () => {
  seedResult();
  const r = wrap(<ResultStep onStart={jest.fn()} saving={false} />);
  await flush();
  fireEvent.press(r.getByTestId('pp-edit'));
  for (let i = 0; i < 30; i++) fireEvent.press(r.getByLabelText('Azalt Kalori'));
  await flush();
  expect(usePpFlow.getState().custom?.calories).toBe(1200);
  expect(r.getByTestId('pp-edit-warn')).toBeTruthy();
  expect(r.getByText(/1200 kcal’nin altına inmiyoruz/)).toBeTruthy();
  fireEvent.press(r.getByTestId('pp-edit-done'));
  await flush();
  expect(r.getByTestId('pp-result-date').props.children).toBe('21 Ocak 2027');
  expect(r.getByText('0,72 kg/hafta')).toBeTruthy();
  fireEvent.press(r.getByTestId('pp-edit'));
  fireEvent.press(r.getByTestId('pp-edit-reset'));
  expect(usePpFlow.getState().custom).toBeNull();
});

test('Hatırlatmalar: izin reddedilse de akış tamamlanır', async () => {
  seedFlow();
  mockRequestPush.mockResolvedValueOnce('denied');
  const onDone = jest.fn();
  const r = wrap(<RemindStep onDone={onDone} />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-remind-on'));
  });
  await flush();
  expect(mockRequestPush).toHaveBeenCalledWith('personal_plan');
  expect(onDone).toHaveBeenCalledWith('denied');
});

test('Giriş noktaları: bayrak kapalı → hiçbiri çizilmez; açık + plan yok → Profil satırı + Ana sayfa kartı (× ile kapanır)', async () => {
  mockFlags.kisisel_plan = false;
  const off = wrap(
    <>
      <ProfilePlanRow />
      <HomePlanCard />
    </>,
  );
  await flush();
  expect(off.queryByTestId('pp-entry-profile')).toBeNull();
  expect(off.queryByTestId('pp-entry-home')).toBeNull();
  off.unmount();
  mockFlags.kisisel_plan = true;
  const on = wrap(
    <>
      <ProfilePlanRow />
      <HomePlanCard />
    </>,
  );
  await flush();
  expect(on.getByText('Kişisel planımı oluştur')).toBeTruthy();
  expect(on.getByTestId('pp-entry-home')).toBeTruthy();
  fireEvent.press(on.getByTestId('pp-entry-home-close'));
  await flush();
  expect(on.queryByTestId('pp-entry-home')).toBeNull();
  fireEvent.press(on.getByTestId('pp-entry-profile'));
  expect(mockNav.navigate).toHaveBeenCalledWith('PersonalPlan', { origin: 'profile' });
});

function seedSaved(weighIns: { date: string; weightKg: number }[]) {
  const result = computePlan({ goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 65, pace: 0.5 }, 2026, '2026-11-12')!;
  const { consentHealth: _c, consentAllergy: _a, ...answers } = sampleAnswers();
  void _c;
  void _a;
  const saved: PpSaved = { v: 1, answers, result, custom: null, startedAt: '2026-11-12', startWeightKg: 72, targetDate: result.targetDate, updatedAt: '' };
  useMyPlanStore.setState({ uid: 'u-1', saved, weighIns, loaded: true, loading: false });
  return saved;
}

test('Check-in: hızlı kayıp → öneri kartı (1440 → 1770); kalori kendiliğinden DEĞİŞMEZ, "Uygula" ile değişir', async () => {
  jest.setSystemTime(new Date('2026-12-03T10:00:00'));
  seedSaved([
    { date: '2026-11-12', weightKg: 72 },
    { date: '2026-11-19', weightKg: 71.2 },
    { date: '2026-11-26', weightKg: 70.4 },
  ]);
  mockSaveMeasurement.mockResolvedValue(true);
  mockSavePlan.mockResolvedValue({ ok: true });
  const nav = { goBack: jest.fn(), navigate: jest.fn() } as never;
  const r = wrap(<CheckinScreen navigation={nav} route={{ key: 'c', name: 'PersonalPlanCheckin' } as never} />);
  await flush();
  fireEvent.press(r.getByTestId('pp-ci-weigh'));
  await flush();
  for (let i = 0; i < 8; i++) fireEvent.press(r.getByLabelText('Azalt Bu haftaki kilon'));
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-ci-save'));
  });
  await flush();
  expect(mockSaveMeasurement).toHaveBeenCalledWith('u-1', expect.objectContaining({ date: '2026-12-03', weightKg: 69.6 }));
  expect(r.getByTestId('pp-ci-fast')).toBeTruthy();
  expect(r.getByText(/1770 kcal/)).toBeTruthy();
  // Kalori henüz değişmedi (yalnız tarih + kilo kaydı)
  expect(useMyPlanStore.getState().saved?.custom).toBeNull();
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-ci-apply'));
  });
  await flush();
  expect(useMyPlanStore.getState().saved?.custom?.calories).toBe(1770);
});

test('Check-in: tek tartıda artış → "Kilo günden güne oynar", Uygula yok', async () => {
  jest.setSystemTime(new Date('2026-11-19T10:00:00'));
  seedSaved([{ date: '2026-11-12', weightKg: 72 }]);
  mockSaveMeasurement.mockResolvedValue(true);
  mockSavePlan.mockResolvedValue({ ok: true });
  const nav = { goBack: jest.fn(), navigate: jest.fn() } as never;
  const r = wrap(<CheckinScreen navigation={nav} route={{ key: 'c', name: 'PersonalPlanCheckin' } as never} />);
  await flush();
  fireEvent.press(r.getByTestId('pp-ci-weigh'));
  for (let i = 0; i < 3; i++) fireEvent.press(r.getByLabelText('Artır Bu haftaki kilon'));
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-ci-save'));
  });
  await flush();
  expect(r.getByTestId('pp-ci-fluctuation')).toBeTruthy();
  expect(r.queryByTestId('pp-ci-apply')).toBeNull();
  expect(useMyPlanStore.getState().saved?.custom).toBeNull();
});

test('Paywall: fiyat gelmezse hata kartı (yedek fiyat yok); fiyat varsa yıllık seçili + satın al', async () => {
  const nav = { goBack: jest.fn(), navigate: jest.fn() } as never;
  const r = wrap(<PlanPaywallScreen navigation={nav} route={{ key: 'p', name: 'PlanPaywall', params: { from: 'test' } } as never} />);
  await flush();
  expect(r.getByTestId('pp-pw-error')).toBeTruthy();
  r.unmount();
  mockCards = [
    { key: 'fresh_monthly', tier: 'fresh', yearly: false, productId: 'fm', price: 199.99, currency: 'TRY', priceText: '199,99 TL', weeklyText: '', monthlyText: null, discountPct: null, trialDays: null, popular: false },
    { key: 'fresh_yearly', tier: 'fresh', yearly: true, productId: 'fy', price: 999.99, currency: 'TRY', priceText: '999,99 TL', weeklyText: '', monthlyText: '83,33 TL', discountPct: 58, trialDays: 7, popular: false },
    { key: 'balance_monthly', tier: 'balance', yearly: false, productId: 'bm', price: 499.99, currency: 'TRY', priceText: '499,99 TL', weeklyText: '', monthlyText: null, discountPct: null, trialDays: null, popular: false },
    { key: 'balance_yearly', tier: 'balance', yearly: true, productId: 'by', price: 2999.99, currency: 'TRY', priceText: '2999,99 TL', weeklyText: '', monthlyText: '249,99 TL', discountPct: 50, trialDays: 7, popular: true },
  ];
  mockPurchase.mockResolvedValueOnce('success');
  const r2 = wrap(<PlanPaywallScreen navigation={nav} route={{ key: 'p', name: 'PlanPaywall', params: { from: 'test' } } as never} />);
  await flush();
  expect(r2.getByText('999,99 TL/yıl')).toBeTruthy();
  expect(r2.getByText('%58 tasarruf')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r2.getByTestId('pp-pw-buy'));
  });
  await flush();
  expect(mockPurchase).toHaveBeenCalledWith('fresh_yearly');
});

test('Light + Dark + EN: Sonuç ve Hedef aynı kodla çizilir; EN metinler, ondalık nokta', async () => {
  seedResult();
  for (const scheme of ['light', 'dark'] as const) {
    const r = wrap(<ResultStep onStart={jest.fn()} saving={false} />, 'en', scheme);
    await flush();
    expect(r.getByText('Your plan')).toBeTruthy();
    expect(r.getByText('Start plan')).toBeTruthy();
    expect(r.getByTestId('pp-result-date').props.children).toBe('18 February 2027');
    expect(r.getByText('0.5 kg/week')).toBeTruthy();
    r.unmount();
  }
  seedFlow({}, 'target');
  const t = wrap(<TargetStep next={jest.fn()} />, 'en', 'dark');
  await flush();
  expect(t.getByText(/0.75 kg is off for now/)).toBeTruthy();
  expect(t.getByText(/at most 0.72 kg/)).toBeTruthy();
});
