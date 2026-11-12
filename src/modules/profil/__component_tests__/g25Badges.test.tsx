// G25-S1 md.8 (A11) — FinBadges: örnek "Ad Soyad" satırları yok; üstte gerçek veri (kendi adın +
// mühür + rol) ya da boş hâl; altta rol çipleri ve anlamları.
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
let mockProfile: unknown = null;
jest.mock('../client', () => ({ getProfilClient: () => ({ getPublicProfile: () => Promise.resolve(mockProfile) }) }));

import BadgesScreen, { badgeRoleKey } from '../ui/screens/BadgesScreen';

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => {});
};

test('doğrulanmamış / okunamayan → boş hâl, "Ad Soyad" yok, rol açıklamaları var', async () => {
  mockProfile = null;
  const r = render(<BadgesScreen onBack={jest.fn()} handle="deniz" />);
  await flush();
  expect(r.queryByText('Ad Soyad')).toBeNull();
  expect(r.getByTestId('badges-empty')).toBeTruthy();
  expect(r.getByText('Hesabın henüz doğrulanmadı.')).toBeTruthy();
  for (const k of ['dietitian', 'pt', 'athlete', 'official']) expect(r.getByTestId(`badge-role-${k}`)).toBeTruthy();
  expect(r.getByText('Diploması doğrulanmış diyetisyen.')).toBeTruthy();
});

test('doğrulanmış → kendi adın + mühür + rol çipi (gerçek veri)', async () => {
  mockProfile = { id: 'u1', display_name: 'Deniz Kaya', handle: 'deniz', avatar_url: null, bio: null, role: 'dietitian', verified: true, is_private: false, followers: 0, following: 0, posts: 0, me_following: 'none' };
  const r = render(<BadgesScreen onBack={jest.fn()} handle="deniz" />);
  await flush();
  const me = r.getByTestId('badges-me');
  expect(me.props.accessibilityLabel).toBe('Deniz Kaya, Onaylı, Diyetisyen');
  expect(r.queryByTestId('badges-empty')).toBeNull();
  expect(r.queryByText('Ad Soyad')).toBeNull();
});

test('badgeRoleKey: bilinen roller, bilinmeyen → null', () => {
  expect(badgeRoleKey('dyt')).toBe('dietitian');
  expect(badgeRoleKey('kurum')).toBe('official');
  expect(badgeRoleKey('user')).toBeNull();
  expect(badgeRoleKey(null)).toBeNull();
});
