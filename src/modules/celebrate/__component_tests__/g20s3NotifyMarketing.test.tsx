// G20-S3 md.6 (B-11) — ilk bildirim izni sheet'inde pazarlama AYRI onay: kutu
// işaretsiz gelir; yalnız izin verilip kutu işaretlenirse marketing_enabled açılır.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});
let mockStatus: 'granted' | 'denied' = 'granted';
jest.mock('../../../core/notifications', () => ({ requestPushPermissionOnly: () => Promise.resolve(mockStatus) }));
const mockOptIn = jest.fn((_on: boolean) => Promise.resolve(true));
jest.mock('../../../lib/notify/marketing', () => ({ setMarketingOptIn: (on: boolean) => mockOptIn(on) }));
jest.mock('../../onboarding/first/overlayGate', () => ({ useOverlayGate: () => {} }));

import { NotifyPermissionSheet } from '../NotifyPermissionSheet';

const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(() => {
  mockOptIn.mockClear();
  mockStatus = 'granted';
});

test('kutu varsayılan İŞARETSİZ; izin verilse de pazarlama açılmaz', async () => {
  const onResult = jest.fn();
  const ui = render(<NotifyPermissionSheet visible onClose={() => {}} onResult={onResult} />);
  expect(ui.getByText('Kampanya ve fırsat bildirimleri de gelsin')).toBeTruthy();
  expect(ui.getByTestId('notify-marketing-optin').props.accessibilityState).toEqual({ checked: false });
  await act(async () => fireEvent.press(ui.getByLabelText('İzin ver')));
  await flush();
  expect(onResult).toHaveBeenCalledWith('granted');
  expect(mockOptIn).not.toHaveBeenCalled();
});

test('kutu işaretli + izin verildi → pazarlama açık onayı yazılır', async () => {
  const ui = render(<NotifyPermissionSheet visible onClose={() => {}} />);
  fireEvent.press(ui.getByTestId('notify-marketing-optin'));
  expect(ui.getByTestId('notify-marketing-optin').props.accessibilityState).toEqual({ checked: true });
  await act(async () => fireEvent.press(ui.getByLabelText('İzin ver')));
  await flush();
  expect(mockOptIn).toHaveBeenCalledWith(true);
});

test('kutu işaretli ama izin reddedildi → pazarlama yazılmaz', async () => {
  mockStatus = 'denied';
  const ui = render(<NotifyPermissionSheet visible onClose={() => {}} />);
  fireEvent.press(ui.getByTestId('notify-marketing-optin'));
  await act(async () => fireEvent.press(ui.getByLabelText('İzin ver')));
  await flush();
  expect(mockOptIn).not.toHaveBeenCalled();
});
