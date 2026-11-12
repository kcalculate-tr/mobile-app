// G36-S1 md.12 (İlter 12 Kas, G34 SORULAR 6) — Balance akış sonu önizlemesi koç mesajı HARCAMAZ:
// önizleme şablonla gelir ("Şablonla hazırlandı"), altında "Koç'la kişiselleştir" (basınca 1 koç
// mesajı, mevcut meal-plan-generate akışı). Koç yoksa / kota bittiyse şablon + etiket aynı kalır.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-blur', () => ({
  BlurView: (p: Record<string, unknown>) => require('react').createElement('View', { ...p, testID: 'pp-blur' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => k === 'kisisel_plan' || k === 'ogun_plani' }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
let mockTier: 'free' | 'fresh' | 'balance' = 'balance';
jest.mock('../../../lib/subscription/purchases', () => ({
  useTier: () => ({ tier: mockTier, status: 'verified' }),
  purchasePlan: jest.fn(),
  restorePurchases: jest.fn(() => Promise.resolve('none')),
}));
jest.mock('../../../lib/subscription/usePlanCards', () => ({ usePlanCards: () => ({ cards: null, loading: false, failed: true, reload: jest.fn() }) }));
jest.mock('../../plan/client', () => {
  const actual = jest.requireActual('../../plan/client');
  return { ...actual, fetchRecipeCatalog: () => actual.fetchRecipeCatalog(true) };
});
type Outcome = { ok: true; index: number; note: string } | { ok: false; reason: 'quota' | 'error' };
const mockAsk = jest.fn((): Promise<Outcome> => Promise.resolve({ ok: true, index: 1, note: 'Protein dengeli.' }));
jest.mock('../../plan/coach', () => ({ askCoachToRank: () => mockAsk() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import { usePpFlow } from '../store';
import { emptyAnswers } from '../types';
import { computePlan } from '../calc';
import { usePlanStore } from '../../plan/store';
import { PreviewStep } from '../screens/flow/preview';

const flush = async () => {
  for (let i = 0; i < 8; i++) await act(async () => {});
};
const wrap = (el: React.ReactElement, lang: 'tr' | 'en' = 'tr') =>
  render(
    <ThemeProvider forceScheme="light">
      <I18nProvider forceLang={lang}>{el}</I18nProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockTier = 'balance';
  usePlanStore.setState({ userId: null, weeks: {}, catalog: null });
  const answers = { ...emptyAnswers(), consentHealth: true, goal: 'lose' as const, gender: 'female' as const, birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light' as const, targetWeightKg: 65 };
  usePpFlow.getState().begin({ userId: 'u-1', origin: 'profile', known: false, answers, step: 'preview' as never });
  usePpFlow.getState().setResult(computePlan({ goal: 'lose', gender: 'female', birthYear: 1994, heightCm: 168, weightKg: 72, activity: 'light', targetWeightKg: 65, pace: 0.5 }, 2026, '2026-11-12'));
});

test('Balance: önizleme şablonla gelir, koç ÇAĞRILMAZ; "Koç’la kişiselleştir" → 1 koç mesajı → "kcalAI Koç hazırladı"', async () => {
  const r = wrap(<PreviewStep next={jest.fn()} origin="profile" />);
  await flush();
  expect(mockAsk).not.toHaveBeenCalled();
  expect(r.getByTestId('pp-preview-tag').props.children).toBe('Şablonla hazırlandı');
  expect(r.getByText('1 Koç mesajı kullanır')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-preview-coach'));
  });
  await flush();
  expect(mockAsk).toHaveBeenCalledTimes(1);
  expect(r.getByTestId('pp-preview-tag').props.children).toBe('kcalAI Koç hazırladı');
  expect(r.queryByTestId('pp-preview-coach')).toBeNull();
});

test('Balance: kota bitti → şablon kalır, etiket "Şablonla hazırlandı" + uyarı', async () => {
  mockAsk.mockResolvedValueOnce({ ok: false, reason: 'quota' });
  const r = wrap(<PreviewStep next={jest.fn()} origin="profile" />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-preview-coach'));
  });
  await flush();
  expect(r.getByTestId('pp-preview-tag').props.children).toBe('Şablonla hazırlandı');
  expect(r.getByTestId('pp-preview-coach-msg').props.children).toBe('Bugünkü Koç mesajların bitti; plan şablonla hazırlandı.');
  expect(r.getByTestId('pp-preview-coach')).toBeTruthy();
});

test('Balance: Koç yanıt vermedi → şablon etiketi + "Koç şu an yanıt vermedi"', async () => {
  mockAsk.mockResolvedValueOnce({ ok: false, reason: 'error' });
  const r = wrap(<PreviewStep next={jest.fn()} origin="profile" />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('pp-preview-coach'));
  });
  await flush();
  expect(r.getByTestId('pp-preview-tag').props.children).toBe('Şablonla hazırlandı');
  expect(r.getByTestId('pp-preview-coach-msg').props.children).toMatch(/^Koç şu an yanıt vermedi/);
});

test('Fresh: şablon, kişiselleştir düğmesi YOK; EN Balance düğme metni', async () => {
  mockTier = 'fresh';
  const r = wrap(<PreviewStep next={jest.fn()} origin="profile" />);
  await flush();
  expect(r.getByTestId('pp-preview-tag').props.children).toBe('Şablonla hazırlandı');
  expect(r.queryByTestId('pp-preview-coach')).toBeNull();
  r.unmount();
  mockTier = 'balance';
  const en = wrap(<PreviewStep next={jest.fn()} origin="profile" />, 'en');
  await flush();
  expect(en.getByText('Personalize with the Coach')).toBeTruthy();
  expect(en.getByText('Uses 1 Coach message')).toBeTruthy();
  expect(mockAsk).not.toHaveBeenCalled();
});
