// G42-S1 md.12 — Yeni kayıt akışı bileşen testleri: tekerlek (VoiceOver artır/azalt), cetvel birim dönüşümü
// (cm ↔ ft-in, kg ↔ lb), koşullu atlama P6/P7 (korumak → I1'den P8'e; kas kazanmak → Atla), dinamik halka,
// 7 gün saklama (R1 açılır / süre dolunca P1), kutular işaretsiz varsayılan, bayrak kapalıyken eski akış
// (kısa profil kapısı ve Planını geliştir kartı etkisiz), onboarding 5. ekran segmenti kisisel_plan'a bağlı.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
const mockFlags: Record<string, boolean> = { yeni_kayit: true, kisisel_plan: true, kesfet: true };
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
let mockUser: { id: string } | null = null;
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, signInWithApple: jest.fn(), signInWithGoogle: jest.fn(), signInWithOtp: jest.fn(async () => ({ error: null })), verifyEmailOtp: jest.fn(async () => ({ error: null })), signIn: jest.fn() }),
}));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../../lib/consent/metaConsent', () => ({ requestMetaOptIn: jest.fn(async () => ({ granted: false, att: 'denied' })) }));
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => false), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../personalPlan/ui/entries', () => ({ usePersonalPlanEntry: () => ({ enabled: true, hasPlan: false, loaded: true }), useOpenPersonalPlan: () => jest.fn() }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }), useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, []) };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import QuestionsScreen from '../screens/QuestionsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { SignupScreen } from '../screens/SignupScreens';
import ReturnScreen from '../screens/ReturnScreen';
import { WheelPicker } from '../ui/pickers';
import { PlanImproveSlot } from '../PlanImproveSlot';
import { shouldGateShort, useShortProfileGate } from '../gate';
import { useKayit } from '../store';
import { emptyKAnswers, type KAnswers } from '../model';
import { DRAFT_KEY, readDraft, writeDraft, type KvStore } from '../storage';

const wrap = (el: React.ReactElement, lang: 'tr' | 'en' = 'tr', scheme: 'light' | 'dark' = 'light') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};
const answers = (o: Partial<KAnswers> = {}): KAnswers => ({
  ...emptyKAnswers(),
  goal: 'lose',
  gender: 'female',
  birthYear: 1995,
  heightCm: 170,
  weightKg: 72,
  targetWeightKg: 66,
  activity: 'light',
  diet: 'all',
  ...o,
});
const ringLabel = (r: ReturnType<typeof render>) => r.getByRole('progressbar').props.accessibilityLabel as string;

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockUser = null;
  mockFlags.yeni_kayit = true;
  mockFlags.kisisel_plan = true;
  useKayit.getState().reset();
  await AsyncStorage.clear();
});

test('tekerlek: VoiceOver artır/azalt değeri bir yıl değiştirir; değer metni okunur', () => {
  const onChange = jest.fn();
  const r = render(wrap(<WheelPicker testID="w" values={[1994, 1995, 1996]} value={1995} onChange={onChange} label="Yıl" />));
  const w = r.getByTestId('w');
  expect(w.props.accessibilityRole).toBe('adjustable');
  expect(w.props.accessibilityValue).toEqual({ text: '1995' });
  fireEvent(w, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(onChange).toHaveBeenLastCalledWith(1996);
  fireEvent(w, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(onChange).toHaveBeenLastCalledWith(1994);
});

test('cetvel birim dönüşümü: boy cm → ft-in (170 cm = 5′7″), kilo kg → lb; değer korunur', async () => {
  useKayit.getState().patch(answers());
  mockParams = { vitrinStep: 'height' };
  const r = render(wrap(<QuestionsScreen />));
  await flush();
  expect(r.getByTestId('kayit-height-value', { includeHiddenElements: true }).props.children).toBe('170');
  fireEvent.press(r.getByTestId('kayit-unit-len-imperial'));
  await flush();
  expect(r.getByTestId('kayit-height-value', { includeHiddenElements: true }).props.children).toBe('5′7″');
  expect(useKayit.getState().answers.heightCm).toBe(170);
  // cetvel VoiceOver artırma imperial modda 1 inç → 173 cm
  fireEvent(r.getByTestId('kayit-ruler-height'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(useKayit.getState().answers.heightCm).toBe(173);
  act(() => useKayit.getState().setStep('weight'));
  await flush();
  expect(r.getByTestId('kayit-weight-value', { includeHiddenElements: true }).props.children).toBe('158,7');
});

test('koşullu atlama: korumak → P5 sonrası I1 → P8 (P6/P7 yok); halka 12 üzerinden', async () => {
  useKayit.getState().patch(answers({ goal: 'maintain', targetWeightKg: null }));
  mockParams = { vitrinStep: 'weight' };
  const r = render(wrap(<QuestionsScreen />));
  await flush();
  expect(ringLabel(r)).toBe('Soru 5 / 12');
  fireEvent.press(r.getByTestId('kayit-next'));
  await flush();
  expect(useKayit.getState().step).toBe('i1');
  fireEvent.press(r.getAllByTestId('kayit-next')[0]);
  await flush();
  expect(useKayit.getState().step).toBe('activity');
  expect(ringLabel(r)).toBe('Soru 6 / 12');
});

test('koşullu atlama: kas kazanmakta P6k "Atla" → P8 (P7 yok), halka toplamı bir eksilir (13 → 12)', async () => {
  useKayit.getState().patch(answers({ goal: 'muscle', targetWeightKg: null }));
  mockParams = { vitrinStep: 'target' };
  const r = render(wrap(<QuestionsScreen />));
  await flush();
  expect(ringLabel(r)).toBe('Soru 6 / 13');
  fireEvent.press(r.getByTestId('kayit-skip'));
  await flush();
  expect(useKayit.getState().step).toBe('activity');
  expect(useKayit.getState().answers.targetSkipped).toBe(true);
  expect(ringLabel(r)).toBe('Soru 6 / 12');
});

test('koşullu atlama: kilo almakta P7g iki kademe (Hızlı yok); kilo vermekte üç', async () => {
  useKayit.getState().patch(answers({ goal: 'gain', targetWeightKg: 75 }));
  mockParams = { vitrinStep: 'pace' };
  const r = render(wrap(<QuestionsScreen />));
  await flush();
  expect(r.queryByTestId('kayit-pace-0.25')).toBeTruthy();
  expect(r.queryByTestId('kayit-pace-0.5')).toBeTruthy();
  expect(r.queryByTestId('kayit-pace-0.75')).toBeNull();
  expect(r.getByTestId('kayit-range')).toBeTruthy();
});

test('boş hâl: P1 seçim yokken Devam devre dışı; seçince etkin + halka 1/14', async () => {
  const r = render(wrap(<QuestionsScreen />));
  await flush();
  expect(r.getByTestId('kayit-next').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(r.getByTestId('kayit-goal-lose'));
  await flush();
  expect(r.getByTestId('kayit-next').props.accessibilityState.disabled).toBe(false);
  expect(ringLabel(r)).toBe('Soru 1 / 14');
});

test('K1: iki isteğe bağlı kutu (Meta, pazarlama) işaretsiz gelir; iOS ATT reddinde Meta boş kalır + not', async () => {
  mockParams = { path: 'a' };
  const r = render(wrap(<SignupScreen />));
  await flush();
  expect(r.getByTestId('kayit-meta').props.accessibilityState.checked).toBe(false);
  expect(r.getByTestId('kayit-marketing').props.accessibilityState.checked).toBe(false);
  expect(r.queryByTestId('kayit-age')).toBeNull();
  fireEvent.press(r.getByTestId('kayit-marketing'));
  expect(r.getByTestId('kayit-marketing').props.accessibilityState.checked).toBe(true);
  await act(async () => {
    fireEvent.press(r.getByTestId('kayit-meta'));
  });
  await flush();
  expect(r.getByTestId('kayit-meta').props.accessibilityState.checked).toBe(false);
});

test('K1b (B yolu): 18+ kutusu zorunlu ve işaretsiz; işaretlenene kadar yöntemler devre dışı', async () => {
  mockParams = { path: 'b' };
  const r = render(wrap(<SignupScreen />));
  await flush();
  expect(r.getByTestId('kayit-age').props.accessibilityState.checked).toBe(false);
  expect(r.getByTestId('kayit-email').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(r.getByTestId('kayit-age'));
  expect(r.getByTestId('kayit-email').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(r.getByTestId('kayit-email'));
  expect(mockNav.navigate).toHaveBeenCalledWith('KEmail', expect.objectContaining({ path: 'b', meta: false, marketing: false, age: true }));
});

test('7 gün saklama: R1 kalan günü gösterir; süre dolan taslak okunmaz ve silinir', async () => {
  const kv = AsyncStorage as unknown as KvStore;
  const now = Date.now();
  await writeDraft(kv, { answers: answers(), step: 'signup', start: 'track', plan: { calories: 1850, protein: 130, carbs: 200, fat: 60 } }, now - 2 * 86400000);
  const d = await readDraft(kv, now);
  expect(d).not.toBeNull();
  mockParams = { draft: d };
  const r = render(wrap(<ReturnScreen />));
  await flush();
  expect(r.getByText(/5 gün kaldı/)).toBeTruthy();
  expect(r.getByTestId('kayit-return-kcal').props.children.join('')).toContain('1.850');
  fireEvent.press(r.getByTestId('kayit-return-save'));
  expect(mockNav.navigate).toHaveBeenCalledWith('KSignup', { path: 'a' });
  expect(await readDraft(kv, now + 8 * 86400000)).toBeNull();
  expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
});

test('onboarding 5. ekran: segment kisisel_plan açıkken görünür; kapalıyken gizli ve Devam → K1b (B yolu)', async () => {
  const r = render(wrap(<OnboardingScreen vitrinStep={5} />));
  await flush();
  expect(r.queryByTestId('kayit-seg-a')).toBeTruthy();
  r.unmount();
  mockFlags.kisisel_plan = false;
  const r2 = render(wrap(<OnboardingScreen vitrinStep={5} />));
  await flush();
  expect(r2.queryByTestId('kayit-seg-a')).toBeNull();
  fireEvent.press(r2.getByTestId('kayit-onb-next'));
  expect(mockNav.navigate).toHaveBeenCalledWith('KSignup', { path: 'b' });
  expect(useKayit.getState().path).toBe('b');
});

test('onboarding EN + koyu: 4. ekran geçici metni ve Devam', async () => {
  const r = render(wrap(<OnboardingScreen vitrinStep={4} />, 'en', 'dark'));
  await flush();
  expect(r.getByText('Share, follow and get inspired on Explore.')).toBeTruthy();
  fireEvent.press(r.getByTestId('kayit-onb-next'));
  await flush();
  expect(r.getByText(/all set/)).toBeTruthy();
});

test('bayrak kapalıyken eski akış: kısa profil kapısı etkisiz, Planını geliştir kartı yok', async () => {
  expect(shouldGateShort({ flag: false, pending: true, hasGoal: false })).toBe(false);
  expect(shouldGateShort({ flag: true, pending: true, hasGoal: false })).toBe(true);
  expect(shouldGateShort({ flag: true, pending: true, hasGoal: null })).toBe(false);
  mockFlags.yeni_kayit = false;
  mockUser = { id: 'u-1' };
  let gate: ReturnType<typeof useShortProfileGate> | null = null;
  function Probe() {
    gate = useShortProfileGate();
    return null;
  }
  await AsyncStorage.setItem('@kcal_kayit_short_pending', '1');
  render(wrap(<Probe />));
  await flush();
  const nav = jest.fn();
  expect(gate!(nav)).toBe(false);
  expect(nav).not.toHaveBeenCalled();
  const slot = render(wrap(<PlanImproveSlot />));
  expect(slot.queryByTestId('kayit-plan-improve')).toBeNull();
  mockFlags.yeni_kayit = true;
  const slot2 = render(wrap(<PlanImproveSlot />));
  expect(slot2.queryByTestId('kayit-plan-improve')).toBeTruthy();
});
