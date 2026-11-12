// G23-S1 md.4 — PublicProfileScreen yüklenirken (yeni kabuk) FinMoLoad iskeleti; dönen gösterge YOK.
// "Takiptesin" → "Takip ediliyor" (tasarım dili).
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';

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
let mockYeni = true;
jest.mock('../../../../core/flags', () => {
  const actual = jest.requireActual('../../../../core/flags');
  return { ...actual, useFeature: (k: string) => (k === 'yeni_kabuk' ? mockYeni : actual.useFeature(k)) };
});

import PublicProfileScreen from '../PublicProfileScreen';
import { getProfilClient, resetProfilClient, setProfilClient } from '../../client';
import { translations } from '../../../../core/i18n/dictionaries';

afterEach(() => {
  resetProfilClient();
  mockYeni = true;
});

function pending() {
  const base = getProfilClient();
  setProfilClient({ ...base, getPublicProfile: () => new Promise(() => {}) } as typeof base);
}

test('yeni kabuk: yükleniyor → iskelet (progressbar + "Yükleniyor"), dönen gösterge yok', async () => {
  pending();
  const r = render(<PublicProfileScreen />);
  await act(async () => {});
  const sk = r.getByTestId('public-profile-skeleton');
  expect(sk.props.accessibilityRole).toBe('progressbar');
  expect(sk.props.accessibilityLabel).toBe('Yükleniyor');
  expect(r.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  expect(r.getByTestId('public-profile-back')).toBeTruthy();
});

test('eski kabuk: yükleniyor göstergesi AYNEN (bayrak kapalı = bugünkü uygulama)', async () => {
  mockYeni = false;
  pending();
  const r = render(<PublicProfileScreen />);
  await act(async () => {});
  expect(r.queryByTestId('public-profile-skeleton')).toBeNull();
  expect(r.UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
});

test('takip etiketi: "Takip ediliyor" (TR) / "Following" (EN); "Takiptesin" yok', () => {
  const tr = translations.tr as { profil: { following: string } };
  const en = translations.en as { profil: { following: string } };
  expect(tr.profil.following).toBe('Takip ediliyor');
  expect(en.profil.following).toBe('Following');
  expect(JSON.stringify(translations.tr)).not.toContain('Takiptesin');
});
