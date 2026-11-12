// G22-S2 md.5 (Tur 26j, FinFollowError) — takip başarısız: iyimser durum GERİ
// alınır (düğme "Takip et"e döner) + kısa uyarı "Takip edilemedi." · Tekrar dene.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: { handle: 'ayse' } }),
}));
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'me' } };
  return { useAuth: () => auth };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});

import PublicProfileScreen from '../PublicProfileScreen';
import { getProfilClient, resetProfilClient, setProfilClient } from '../../client';
import type { PublicProfile } from '../../types';

const profile: PublicProfile = {
  id: 'u-ayse',
  display_name: 'Ayşe',
  handle: 'ayse',
  avatar_url: null,
  bio: null,
  role: 'user',
  verified: false,
  is_private: false,
  followers: 10,
  following: 3,
  posts: 0,
  me_following: 'none',
};

afterEach(() => {
  resetProfilClient();
  jest.clearAllMocks();
});

function withClient(follow: jest.Mock) {
  const base = getProfilClient();
  setProfilClient({ ...base, getPublicProfile: async () => ({ ...profile }), follow } as typeof base);
}

test('takip hatası → "Takip et"e geri döner + "Takip edilemedi." uyarısı', async () => {
  let reject: (e: Error) => void = () => {};
  const follow = jest.fn(() => new Promise((_res, rej) => (reject = rej)));
  withClient(follow);
  const r = render(<PublicProfileScreen />);
  await act(async () => {});
  fireEvent.press(r.getByText('Takip et'));
  expect(follow).toHaveBeenCalledWith({ user: 'u-ayse', on: true });
  await act(async () => {
    reject(new Error('network'));
  });
  expect(r.getByText('Takip edilemedi.')).toBeTruthy();
  expect(r.getByText('Takip et')).toBeTruthy();
  expect(r.queryByText('Takip ediliyor')).toBeNull();
});

test('uyarıdaki Tekrar dene → yeniden takip; başarıda "Takip ediliyor"', async () => {
  const follow = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ state: 'following' });
  withClient(follow);
  const r = render(<PublicProfileScreen />);
  await act(async () => {});
  await act(async () => {
    fireEvent.press(r.getByText('Takip et'));
  });
  expect(r.getByText('Takip edilemedi.')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByText('Tekrar dene'));
  });
  expect(follow).toHaveBeenCalledTimes(2);
  expect(r.queryByText('Takip edilemedi.')).toBeNull();
  expect(r.getByText('Takip ediliyor')).toBeTruthy();
});
