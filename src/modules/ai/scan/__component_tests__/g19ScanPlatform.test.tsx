// G19-S1 md.5 — izinler ve platform: eski derleme (ExpoCamera yok) yedek yolu uçtan uca,
// sistem kamerası izni red → FinScanError "Kameraya erişim kapalı", galeri İZİNSİZ açılır
// (PHPicker / Android Photo Picker), açılamaz + izin reddi → Alert değil toast.
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AiScanClient, ScanEstimate } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';

jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => k === 'yeni_kabuk' }));
jest.mock('@react-navigation/native', () => {
  const nav = { navigate() {}, goBack() {}, replace() {}, setOptions() {} };
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
// G20-S3 md.2: yapay zekâ fotoğraf izni bu testlerde VERİLMİŞ (izin akışı g20s3AiPhoto testinde).
jest.mock('../../../../lib/consent/aiPhoto', () => ({
  resolveAiPhotoConsent: () => Promise.resolve('ok'),
  setAiPhotoConsent: () => Promise.resolve(),
  hasLocalAiPhotoConsent: () => Promise.resolve(true),
}));
jest.mock('../drainPending', () => ({ drainPendingScans: () => Promise.resolve(), onPendingDrained: () => () => {} }));
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
// Eski derleme: ExpoCamera native modülü yok.
jest.mock('../ui/FinScanCamera', () => {
  const actual = jest.requireActual('../ui/FinScanCamera');
  return { __esModule: true, ...actual, loadExpoCamera: () => null };
});
const mockPicker = {
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: (...a: unknown[]) => mockPicker.requestCameraPermissionsAsync(...a),
  launchCameraAsync: (...a: unknown[]) => mockPicker.launchCameraAsync(...a),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPicker.requestMediaLibraryPermissionsAsync(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockPicker.launchImageLibraryAsync(...a),
}));

// eslint-disable-next-line import/first
import ScanScreen from '../screens/ScanScreen';

const EST: Omit<ScanEstimate, 'isEstimate'> = {
  name: 'Mercimek çorbası',
  kcal: 180,
  protein_g: 9,
  carbs_g: 28,
  fat_g: 4,
  portion: 1,
  ingredients: [{ name: 'Mercimek çorbası', grams: 250, kcal: 180 }],
  photo_url: null,
};
const client = (): AiScanClient & { reserveScan: jest.Mock } => ({
  reserveScan: jest.fn(async () => ({ ok: true, remaining: 2, reset_at: new Date(Date.now() + 864e5).toISOString() })),
  releaseScan: jest.fn(async () => undefined),
  analyzeImage: jest.fn(async () => EST),
});

beforeEach(() => {
  Object.values(mockPicker).forEach((f) => f.mockReset());
  setScanEventSink(() => {});
});
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
});

test('eski derleme: sistem kamerası → analiz → sonuç (yedek yol çalışır)', async () => {
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/sys.jpg' }] });
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  expect(tree.getByTestId('fin-scan-open-camera')).toBeTruthy();
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(tree.getAllByText('Mercimek çorbası').length).toBeGreaterThan(0));
  expect(c.reserveScan).toHaveBeenCalledWith({ idempotencyKey: 'u1-file:///cache/sys.jpg' });
});

test('eski derleme: kamera izni reddi → "Kameraya erişim kapalı" (Alert yok)', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  setAiScanClient(client());
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(tree.getByText('Kameraya erişim kapalı')).toBeTruthy());
  expect(alert).not.toHaveBeenCalled();
  expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('galeri: izin İSTENMEDEN açılır (sınırlı erişim sorun değil)', async () => {
  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/g.jpg' }] });
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Galeriden seç'));
  });
  await waitFor(() => expect(c.reserveScan).toHaveBeenCalledTimes(1));
  expect(mockPicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

test('galeri açılamaz + izin reddi → toast, Alert yok, rezervasyon yok', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPicker.launchImageLibraryAsync.mockRejectedValue(new Error('E_NO_PERMISSIONS'));
  mockPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Galeriden seç'));
  });
  await waitFor(() => expect(tree.getByText('Fotoğraflara erişim kapalı. Ayarlar’dan izin verebilirsin.')).toBeTruthy());
  expect(alert).not.toHaveBeenCalled();
  expect(c.reserveScan).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('galeri iptal → hiçbir şey olmaz', async () => {
  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Galeriden seç'));
  });
  expect(c.reserveScan).not.toHaveBeenCalled();
  expect(tree.getByTestId('fin-scan-open-camera')).toBeTruthy();
});
