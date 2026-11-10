// G25-S1 md.6 (A9) — hesap silme onayında abonelik uyarısı: "aktif abonelik mağazada sürer, önce
// iptal et" + "Aboneliği yönet" (iOS App Store abonelikleri / Android Play derin bağlantısı), TR/EN.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { translate } from '../../../core/i18n/core';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'deniz@example.com' }, signOut: jest.fn() }),
}));
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => false }));
jest.mock('../../../core/supabase', () => {
  const client = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u-1' } } } }) },
    functions: { invoke: jest.fn(() => Promise.resolve({ data: null, error: null })) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import SettingsSecurityScreen from '../ui/screens/SettingsSecurityScreen';

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => {});
};

test('silme onayı: abonelik uyarısı + Aboneliği yönet (iOS → App Store abonelikleri)', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const r = render(<SettingsSecurityScreen onBack={jest.fn()} />);
  await flush();
  expect(r.queryByTestId('delete-sub-note')).toBeNull();
  fireEvent.press(r.getByText('Hesabı sil'));
  expect(r.getByTestId('delete-sub-note')).toBeTruthy();
  expect(r.getByText(/abonelik App Store’da sürer ve yenilenir\. Önce aboneliğini iptal et\./)).toBeTruthy();
  const manage = r.getByTestId('delete-sub-manage');
  expect(manage.props.accessibilityRole).toBe('link');
  fireEvent.press(manage);
  expect(open).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
  open.mockRestore();
});

test('Android: Google Play metni + Play abonelikler derin bağlantısı', async () => {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
  try {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const r = render(<SettingsSecurityScreen onBack={jest.fn()} />);
    await flush();
    fireEvent.press(r.getByText('Hesabı sil'));
    expect(r.getByText(/Google Play’de sürer/)).toBeTruthy();
    fireEvent.press(r.getByTestId('delete-sub-manage'));
    expect(open).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions?package=com.kcalmobile.app');
    open.mockRestore();
  } finally {
    Object.defineProperty(Platform, 'OS', { get: () => prev, configurable: true });
  }
});

test('EN metinleri', () => {
  expect(translate('en', 'profil.delete_sub_manage')).toBe('Manage subscription');
  expect(translate('en', 'profil.delete_sub_note_ios')).toMatch(/continues and renews in the App Store\. Cancel your subscription first\./);
  expect(translate('en', 'profil.delete_sub_note_android')).toMatch(/Google Play/);
});
