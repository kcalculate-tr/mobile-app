// G21-S1 md.8 (akış denetimi) — açık profil yüklenemezse / bulunamazsa çıkmaz yok.
// Önce "bulunamadı" ve "yükleniyor" hâllerinde geri düğmesi yoktu (yalnız iOS kenar
// jesti), ağ hatası işlenmemiş ret bırakıyordu.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: { handle: 'yok' } }),
}));
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'u1' } };
  return { useAuth: () => auth };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});

import PublicProfileScreen from '../PublicProfileScreen';
import { resetProfilClient, setProfilClient, getProfilClient } from '../../client';

afterEach(() => {
  resetProfilClient();
  jest.clearAllMocks();
});

function withProfile(impl: () => Promise<unknown>) {
  const base = getProfilClient();
  setProfilClient({ ...base, getPublicProfile: impl } as typeof base);
}

test('ağ hatası → "bulunamadı" + geri düğmesi (goBack)', async () => {
  withProfile(() => Promise.reject(new Error('network')));
  const r = render(<PublicProfileScreen />);
  await act(async () => {});
  fireEvent.press(r.getByTestId('public-profile-back'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

test('yüklenirken de geri düğmesi var; yığın boşsa Tabs', async () => {
  mockNav.canGoBack.mockReturnValueOnce(false);
  withProfile(() => new Promise(() => {}));
  const r = render(<PublicProfileScreen />);
  fireEvent.press(r.getByTestId('public-profile-back'));
  expect(mockNav.navigate).toHaveBeenCalledWith('Tabs');
});
