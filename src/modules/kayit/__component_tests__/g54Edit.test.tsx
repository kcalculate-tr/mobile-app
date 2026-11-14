// G54-S1 md.5 — "Planımı düzenle" tek sayfa özet: satırlar → kayıt bileşeni alttan → Kaydet → özet; "Değişiklikleri
// kaydet" → yeniden hesap → önce→sonra onayı → personal_plan + hedefler kaydedilir; T1 YOK; kaydedilmemiş çıkış onayı.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', user_metadata: {} } }) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
const mockSave = jest.fn(async (_u: string, _p: unknown, _y: number) => ({ ok: true }));
jest.mock('../../personalPlan/api', () => ({
  ...jest.requireActual('../../personalPlan/api'),
  savePlan: (u: string, p: unknown, y: number) => mockSave(u, p, y),
  loadPlan: jest.fn(async () => ({ saved: null, row: null })),
  loadWeighIns: jest.fn(async () => []),
  readCachedPlan: jest.fn(async () => null),
}));
jest.mock('../settings', () => ({ readMuscleSurplus: jest.fn(async () => 250) }));
type Listener = (e: { preventDefault: () => void }) => void;
const mockListeners: Record<string, Listener[]> = {};
const mockNav = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: (ev: string, cb: Listener) => {
    (mockListeners[ev] ??= []).push(cb);
    return () => {
      mockListeners[ev] = (mockListeners[ev] ?? []).filter((x) => x !== cb);
    };
  },
};
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import PlanEditScreen from '../screens/PlanEditScreen';
import { useMyPlanStore } from '../../personalPlan/useMyPlan';
import { computeKayitPlan, toPpSaved } from '../plan';
import { emptyKAnswers, type KAnswers } from '../model';
import { effectiveTargets } from '../../personalPlan/types';
import { noLig } from '../ui/parts';

const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};
const A: KAnswers = { ...emptyKAnswers(), goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 74, targetWeightKg: 66, pace: 0.5, activity: 'light', sportDays: [1], sports: ['walk'], diet: 'all', cuisines: ['ege'], dislikes: ['mushroom'], meals: 4, cooking: 'daily', struggle: 'sweet' };
function prime() {
  const plan = computeKayitPlan(A, { currentYear: new Date().getFullYear(), startIso: '2026-11-01' })!;
  const saved = JSON.parse(JSON.stringify(toPpSaved(A, plan, { startIso: '2026-11-01', nowIso: '2026-11-01T10:00:00Z', start: 'track' })));
  saved.answers.reminders = { ...saved.answers.reminders, weighDay: 5 };
  useMyPlanStore.getState().prime('u-1', saved);
  return { plan, saved };
}

beforeEach(async () => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockListeners)) delete mockListeners[k];
  await AsyncStorage.clear();
  useMyPlanStore.getState().clear();
});

test.each([
  ['light', 'tr'],
  ['dark', 'en'],
] as const)('%s/%s: tek sayfada gruplu satırlar (15) mevcut değerle', async (scheme, lang) => {
  prime();
  const r = render(wrap(<PlanEditScreen />, scheme, lang));
  await flush();
  for (const k of ['goal', 'gender', 'birth', 'height', 'weight', 'target', 'pace', 'activity', 'sport', 'diet', 'cuisines', 'dislikes', 'meals', 'cooking', 'struggle']) expect(r.getByTestId(`kayit-edit-row-${k}`)).toBeTruthy();
  if (lang === 'tr') {
    expect(r.getByTestId('kayit-edit-value-goal')).toHaveTextContent('Kilo vermek');
    expect(r.getByTestId('kayit-edit-value-cuisines')).toHaveTextContent('Ege / zeytinyağlı');
    expect(r.getByTestId('kayit-edit-value-dislikes')).toHaveTextContent('Mantar');
    expect(r.getByTestId('kayit-edit-value-meals')).toHaveTextContent('4');
  }
  expect(r.getByTestId('kayit-edit-save').props.accessibilityState.disabled).toBe(true);
});

test('satır → kayıt bileşeni (değer seçili) → Kaydet → özet güncellenir → Değişiklikleri kaydet → önce→sonra → kayıt; T1 YOK', async () => {
  const { plan } = prime();
  const r = render(wrap(<PlanEditScreen />));
  await flush();
  fireEvent.press(r.getByTestId('kayit-edit-row-goal'));
  await flush();
  expect(r.getByTestId('kayit-edit-sheet')).toBeTruthy();
  expect(r.getByTestId('kayit-goal-lose').props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(r.getByTestId('kayit-goal-maintain'));
  await flush();
  fireEvent.press(r.getByTestId('kayit-edit-sheet-save'));
  await flush();
  expect(r.getByTestId('kayit-edit-value-goal')).toHaveTextContent('Kilomu korumak');
  expect(r.queryByTestId('kayit-edit-row-target')).toBeNull();
  fireEvent.press(r.getByTestId('kayit-edit-save'));
  await flush();
  const after = computeKayitPlan({ ...A, goal: 'maintain' }, { currentYear: new Date().getFullYear(), startIso: '2026-11-01', muscleSurplus: 250 })!;
  expect(r.getByTestId('kayit-edit-confirm-kcal')).toHaveTextContent(noLig(`Günlük hedefin ${plan.calories} → ${after.calories} kcal`));
  await act(async () => {
    fireEvent.press(r.getByTestId('kayit-edit-confirm-ok'));
  });
  await flush();
  expect(mockSave).toHaveBeenCalledTimes(1);
  const saved = mockSave.mock.calls[0][1] as Parameters<typeof effectiveTargets>[0];
  expect(effectiveTargets(saved).calories).toBe(after.calories);
  expect((saved.kayit as { goal: string }).goal).toBe('maintain');
  // Kayıt dışı alanlar korunur (hatırlatma günü).
  expect(saved.answers.reminders.weighDay).toBe(5);
  expect(mockNav.goBack).toHaveBeenCalled();
  expect(mockNav.navigate).not.toHaveBeenCalledWith('KayitOffer', expect.anything());
});

test('satır düzenleyicide Vazgeç → özet değişmez', async () => {
  prime();
  const r = render(wrap(<PlanEditScreen />));
  await flush();
  fireEvent.press(r.getByTestId('kayit-edit-row-meals'));
  await flush();
  fireEvent.press(r.getByTestId('kayit-meals-more'));
  fireEvent.press(r.getByTestId('kayit-edit-sheet-cancel'));
  await flush();
  expect(r.getByTestId('kayit-edit-value-meals')).toHaveTextContent('4');
});

test('kaydedilmemiş değişiklikle çıkış → "Değişiklikler kaydedilmedi" onayı (geri oku + kenar jesti)', async () => {
  prime();
  const r = render(wrap(<PlanEditScreen />));
  await flush();
  fireEvent.press(r.getByTestId('kayit-edit-row-meals'));
  await flush();
  fireEvent.press(r.getByTestId('kayit-meals-more'));
  fireEvent.press(r.getByTestId('kayit-edit-sheet-save'));
  await flush();
  expect(r.getByTestId('kayit-edit-value-meals')).toHaveTextContent('5');
  // Kenar jesti / Android geri: beforeRemove engellenir.
  const prevent = jest.fn();
  act(() => mockListeners.beforeRemove.forEach((cb) => cb({ preventDefault: prevent })));
  await flush();
  expect(prevent).toHaveBeenCalled();
  expect(r.getByText('Değişiklikler kaydedilmedi')).toBeTruthy();
  fireEvent.press(r.getByTestId('kayit-edit-unsaved-leave'));
  await flush();
  expect(mockNav.goBack).toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
