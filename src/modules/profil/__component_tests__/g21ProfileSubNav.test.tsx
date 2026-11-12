// G21-S1 md.9 — Profil alt sayfaları sekme içinde değil, kök yığında `ProfileSub`
// rotasıyla açılır (sağdan kayar); alt sayfa geri = yığından goBack, alt sayfadan
// alt sayfaya (Gizlilik → Güvenlik) üstüne itilir.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});
jest.mock('expo-blur', () => ({
  BlurView: ({ children, ...rest }: any) => require('react').createElement('View', rest, children),
}));
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'deniz@example.com', user_metadata: { full_name: 'Deniz' } }, signOut: jest.fn() }),
}));
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => false }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn() };
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ key: 'r', name: 'ProfileSub', params: mockParams }),
    // odak efektleri (kimlik/makro/koleksiyon okuması) bu testin konusu değil
    useFocusEffect: () => {},
    useIsFocused: () => true,
  };
});

import FinPrProfileScreen from '../ui/screens/FinPrProfileScreen';
import ProfileSubRoute from '../ui/screens/ProfileSubRoute';

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

beforeEach(() => {
  mockNav.navigate.mockClear();
  mockNav.goBack.mockClear();
  mockNav.setOptions.mockClear();
  mockParams = {};
});

test('Profil satırları ProfileSub rotasına gider (sekme içi ekran değişimi yok, tab bar gizlenmez)', () => {
  const ui = render(<FinPrProfileScreen />);
  fireEvent.press(ui.getByText('Kişisel bilgiler'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('ProfileSub', { sub: 'personal' });
  fireEvent.press(ui.getByText('Güvenlik'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('ProfileSub', { sub: 'security' });
  fireEvent.press(ui.getByText('Sözleşmeler'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('ProfileSub', { sub: 'agreements' });
  // kök ekran yerinde kalır; tab bar seçeneği hiç değiştirilmez
  expect(ui.getByText('Kişisel bilgiler')).toBeTruthy();
  expect(mockNav.setOptions).not.toHaveBeenCalledWith(expect.objectContaining({ tabBarStyle: expect.anything() }));
});

test('ProfileSub(privacy): geri = goBack; Güvenlik satırı üstüne yeni ProfileSub iter', async () => {
  mockParams = { sub: 'privacy' };
  const ui = render(<ProfileSubRoute />);
  await flush();
  fireEvent.press(ui.getByLabelText(/Geri|Back/));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

test('ProfileSub: bilinmeyen alt sayfa boş ekran bırakmaz, geri döner', async () => {
  mockParams = { sub: 'yok' };
  render(<ProfileSubRoute />);
  await flush();
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});
