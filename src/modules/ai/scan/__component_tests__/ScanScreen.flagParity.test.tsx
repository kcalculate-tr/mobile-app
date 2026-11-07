// G17-S2 md.7 — Bayrak parite: `yeni_kabuk` KAPALIYKEN Tara = bugünkü ekran
// (snapshot `night17/fix` tabanındaki ScanScreen ile üretildi; `-u` ile
// GÜNCELLENMEZ, fark = regresyon) ve expo-camera HİÇ yüklenmez (deklanşör sistem
// kamerasını açar). Bayrak AÇIKKEN canlı kamera (FinScanCamera) render olur,
// "Kamerayı aç" kartı yok.
import React from 'react';
import { View } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

let mockNewShell = false;
jest.mock('../../../../core/flags', () => ({
  useFeature: (k: string) => (k === 'yeni_kabuk' ? mockNewShell : false),
}));
jest.mock('@react-navigation/native', () => {
  const nav = { navigate: () => {}, goBack: () => {}, replace: () => {} };
  return { useNavigation: () => nav };
});
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'u1' } };
  return { useAuth: () => auth };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {}, fetch: () => Promise.resolve({ isConnected: true }) },
}));
jest.mock('../drainPending', () => ({
  drainPendingScans: () => Promise.resolve(),
  onPendingDrained: () => () => {},
}));

const mockLoad = jest.fn();
jest.mock('../ui/FinScanCamera', () => {
  const actual = jest.requireActual('../ui/FinScanCamera');
  return { __esModule: true, ...actual, loadExpoCamera: () => mockLoad() };
});

// eslint-disable-next-line import/first
import ScanScreen from '../screens/ScanScreen';

beforeEach(() => {
  mockLoad.mockReset();
});

test('bayrak KAPALI: bugünkü Tara ağacı aynen, expo-camera yüklenmez', () => {
  mockNewShell = false;
  const tree = render(<ScanScreen />);
  expect(mockLoad).not.toHaveBeenCalled();
  expect(tree.queryByTestId('fin-scan-camera')).toBeNull();
  expect(tree.toJSON()).toMatchSnapshot();
});

test('bayrak AÇIK: canlı kamera (FinScanCamera), "Kamerayı aç" kartı yok', async () => {
  mockNewShell = true;
  const CameraView = React.forwardRef<unknown, { testID?: string }>((props, ref) => {
    React.useImperativeHandle(ref, () => ({ getAvailablePictureSizesAsync: async () => [] }));
    return <View testID={props.testID} />;
  });
  const granted = { granted: true, canAskAgain: true, status: 'granted' };
  mockLoad.mockReturnValue({
    CameraView,
    Camera: { getCameraPermissionsAsync: async () => granted, requestCameraPermissionsAsync: async () => granted },
  });
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  expect(mockLoad).toHaveBeenCalled();
  expect(tree.queryByTestId('fin-scan-open-camera')).toBeNull();
  await act(async () => {});
});

test('bayrak AÇIK ama eski derleme (ExpoCamera yok): G17-S1 kartı yedeği, çökme yok', () => {
  mockNewShell = true;
  mockLoad.mockReturnValue(null);
  const tree = render(<ScanScreen />);
  expect(tree.getByTestId('fin-scan-open-camera')).toBeTruthy();
});
