// G25-S1 md.3 (A4) — "Yakında" satırları + FinPrMacro "Öğün Aboneliği" sekmesi uzak bayrak
// `yakinda_satirlari` (varsayılan KAPALI → gizli). md.4 (A5) — Macro ödül "Kullan": hedef yoksa gizli,
// varsa kuponu sepete taşır (EkCart couponCode), ≥ 44 pt.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('expo-blur', () => ({
  BlurView: ({ children, ...rest }: { children: React.ReactNode }) => require('react').createElement('View', rest, children),
}));
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'deniz@example.com', user_metadata: { full_name: 'Deniz' } }, signOut: jest.fn() }),
}));
let mockFlags: Record<string, boolean> = {};
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ key: 'r', name: 'ProfileSub', params: {} }),
    useFocusEffect: () => {},
    useIsFocused: () => true,
  };
});

let mockCoupons: { id: string; code: string; description: string | null; end_date: string | null }[] = [];
jest.mock('../../../lib/macros', () => {
  const actual = jest.requireActual('../../../lib/macros');
  return {
    ...actual,
    fetchMacroProfile: () => Promise.resolve(null),
    fetchMacroSettings: () => Promise.resolve(actual.DEFAULT_MACRO_SETTINGS),
    fetchMealRewardCoupons: () => Promise.resolve(mockCoupons),
    fetchMacroTransactions: () => Promise.resolve([]),
  };
});

import ProfileSubSection from '../../subscription/ui/ProfileSubSection';
import FinPrMacroScreen from '../ui/screens/FinPrMacroScreen';
import FinPrProfileScreen from '../ui/screens/FinPrProfileScreen';

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = {};
  mockCoupons = [];
});

test('A4: `yakinda_satirlari` KAPALI → Profil "Yakında" bloğu yok (abonelik satırı yerinde)', () => {
  const r = render(<ProfileSubSection onOpen={jest.fn()} />);
  expect(r.getByText('Abonelik')).toBeTruthy();
  expect(r.queryByText('Yakında')).toBeNull();
  expect(r.queryByText('Egzersiz ve fitness rehberi')).toBeNull();
  expect(r.queryByText('Öğün aboneliği')).toBeNull();
  expect(r.queryByText(/Yakında olan özellikler/)).toBeNull();
});

test('A4: bayrak AÇIK → "Yakında" satırları görünür', () => {
  mockFlags = { yakinda_satirlari: true };
  const r = render(<ProfileSubSection onOpen={jest.fn()} />);
  expect(r.getAllByText('Yakında').length).toBeGreaterThanOrEqual(1);
  expect(r.getByText(/Yakında olan özellikler/)).toBeTruthy();
});

test('A4: FinPrMacro — bayrak kapalıyken sekme seçici ve "Öğün Aboneliği" yok; initialTab=1 bile Macro açar', async () => {
  const r = render(<FinPrMacroScreen onBack={jest.fn()} initialTab={1} />);
  await flush();
  expect(r.queryByTestId('fin-segmented')).toBeNull();
  expect(r.queryByText('Öğün Aboneliği')).toBeNull();
  expect(r.queryByText('Öğün aboneliği çok yakında.')).toBeNull();
  expect(r.getByText('Macro geçmişi')).toBeTruthy();
});

test('A4: FinPrMacro — bayrak açıkken iki sekme', async () => {
  mockFlags = { yakinda_satirlari: true };
  const r = render(<FinPrMacroScreen onBack={jest.fn()} initialTab={1} />);
  await flush();
  expect(r.getByTestId('fin-segmented')).toBeTruthy();
  expect(r.getByText('Öğün aboneliği çok yakında.')).toBeTruthy();
});

test('A4: Profil — "Macro aboneliğim" satırı yalnız bayrak açıkken', () => {
  let r = render(<FinPrProfileScreen />);
  expect(r.queryByText('Macro aboneliğim')).toBeNull();
  r.unmount();
  mockFlags = { yakinda_satirlari: true };
  r = render(<FinPrProfileScreen />);
  expect(r.getByText('Macro aboneliğim')).toBeTruthy();
});

test('A5: ödül "Kullan" — yeni sipariş arayüzü kapalıyken (hedef yok) gizli', async () => {
  mockCoupons = [{ id: 'c1', code: 'MACRO-1', description: 'Ücretsiz öğün', end_date: null }];
  const r = render(<FinPrMacroScreen onBack={jest.fn()} />);
  await flush();
  expect(r.getByText('Ücretsiz öğün')).toBeTruthy();
  expect(r.queryByTestId('macro-reward-use-c1')).toBeNull();
});

test('A5: ödül "Kullan" — hedef varken kuponu sepete taşır, ≥ 44 pt', async () => {
  mockFlags = { yeni_siparis: true };
  mockCoupons = [{ id: 'c1', code: 'MACRO-1', description: 'Ücretsiz öğün', end_date: null }];
  const r = render(<FinPrMacroScreen onBack={jest.fn()} />);
  await flush();
  const btn = r.getByTestId('macro-reward-use-c1');
  const st = StyleSheet.flatten(typeof btn.props.style === 'function' ? btn.props.style({ pressed: false }) : btn.props.style);
  expect(st.height).toBeGreaterThanOrEqual(44);
  fireEvent.press(btn);
  expect(mockNav.navigate).toHaveBeenCalledWith('EkCart', { couponCode: 'MACRO-1' });
});

// G33-S1 md.1 (Tur 26n FinPrProfile): Kcalculate AI grubu TEK kart — Hedefim kartı + İlerleme + Koleksiyon;
// ayrı "kcalAI" bölümü ve "Yakında · Egzersiz" YOK (bayrak açık olsa bile); öğün planı satırları `ogun_plani` arkasında.
test('G33 md.1: Profil — Hedefim kartı grupta, ayrı kcalAI/Yakında bölümü yok; öğün planı satırları bayrakla', () => {
  mockFlags = { yakinda_satirlari: true };
  let r = render(<FinPrProfileScreen />);
  expect(r.getByTestId('profile-goal-card')).toBeTruthy();
  expect(r.getByText('Hedefi düzenle')).toBeTruthy();
  expect(r.queryByTestId('profile-sub-section')).toBeNull();
  expect(r.queryByText('Egzersiz ve fitness rehberi')).toBeNull();
  expect(r.queryByText('Yakında')).toBeNull();
  expect(r.queryByTestId('profile-plan-row')).toBeNull();
  r.unmount();
  mockFlags = { ogun_plani: true };
  r = render(<FinPrProfileScreen />);
  expect(r.getByTestId('profile-plan-row')).toBeTruthy();
  expect(r.getByTestId('profile-shopping-row')).toBeTruthy();
  expect(r.getByText('Öğün planı')).toBeTruthy();
  expect(r.getByText('Alışveriş listesi')).toBeTruthy();
});
