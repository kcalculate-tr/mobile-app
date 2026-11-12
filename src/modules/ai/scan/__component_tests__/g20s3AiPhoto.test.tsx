// G20-S3 md.2 — Tara: ilk taramadan önce yapay zekâ fotoğraf izni (Apple 5.1.2(i)).
// G22-S1 md.5 (G21 SORULAR 2): sheet AÇILIŞTA DEĞİL, yalnız Fotoğraf/Ses AI analizinden önce
// (deklanşör/galeri) açılır; Barkod ve Elle izin istemez. İzin yokken fotoğraf GÖNDERİLMEZ.
// Kabul → izin kaydı (ai_photo, scan) + bekleyen çekim kendiliğinden sürer. Vazgeç → Elle gir.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AiScanClient, ScanEstimate } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';

jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => k === 'yeni_kabuk' }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), setOptions: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'u1' } };
  return { useAuth: () => auth };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {}, fetch: () => Promise.resolve({ isConnected: true }) },
}));
let mockDecision: 'ok' | 'ask' = 'ask';
const mockSetAi = jest.fn((_g: boolean, _s: string) => Promise.resolve());
jest.mock('../../../../lib/consent/aiPhoto', () => ({
  resolveAiPhotoConsent: () => Promise.resolve(mockDecision),
  setAiPhotoConsent: (g: boolean, s: string) => mockSetAi(g, s),
  hasLocalAiPhotoConsent: () => Promise.resolve(mockDecision === 'ok'),
}));
jest.mock('../drainPending', () => ({ drainPendingScans: () => Promise.resolve(), onPendingDrained: () => () => {} }));
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
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
const client = (): AiScanClient & { reserveScan: jest.Mock; analyzeImage: jest.Mock } => ({
  reserveScan: jest.fn(async () => ({ ok: true, remaining: 2, reset_at: new Date(Date.now() + 864e5).toISOString() })),
  releaseScan: jest.fn(async () => undefined),
  analyzeImage: jest.fn(async () => EST),
});
const LEAD = 'Tabak fotoğrafın (ve eklediğin not) ya da sesli girişinin metni, kalori tahmini için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir. Sesli giriş telefonun konuşma tanımasıyla yazıya çevrilir; ses kaydedilmez.';

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(mockPicker).forEach((f) => f.mockReset());
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/p.jpg' }] });
  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/g.jpg' }] });
  setScanEventSink(() => {});
});
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
});

test('izin yok → açılışta sheet YOK; deklanşöre basınca sheet, fotoğraf GÖNDERİLMEZ', async () => {
  mockDecision = 'ask';
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(tree.queryByTestId('consent-sheet-ai_photo')).toBeNull();
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(tree.getByTestId('consent-sheet-ai_photo')).toBeTruthy());
  expect(tree.getByText(LEAD)).toBeTruthy();
  expect(tree.getByText('Fotoğraf ve ses analizi')).toBeTruthy();
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Galeriden seç'));
  });
  expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(mockPicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(c.reserveScan).not.toHaveBeenCalled();
  expect(c.analyzeImage).not.toHaveBeenCalled();
});

test('Kabul et → izin kaydı (ai_photo, scan), sheet kapanır, bekleyen çekim sürer', async () => {
  mockDecision = 'ask';
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(tree.getByTestId('consent-sheet-ai_photo')).toBeTruthy());
  await act(async () => {
    fireEvent.press(tree.getByTestId('consent-sheet-ai_photo-accept'));
  });
  expect(mockSetAi).toHaveBeenCalledWith(true, 'scan');
  // Deklanşöre yeniden basmaya gerek yok — onaydan sonra çekim kendiliğinden sürer.
  await waitFor(() => expect(c.reserveScan).toHaveBeenCalledTimes(1));
  expect(mockPicker.launchCameraAsync).toHaveBeenCalledTimes(1);
  expect(mockNav.goBack).not.toHaveBeenCalled();
});

test('Vazgeç → ret kaydı + Elle gir yolu (Tara kapanır), fotoğraf gönderilmez', async () => {
  mockDecision = 'ask';
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(tree.getByTestId('consent-sheet-ai_photo')).toBeTruthy());
  await act(async () => {
    fireEvent.press(tree.getByTestId('consent-sheet-ai_photo-cancel'));
  });
  expect(mockSetAi).toHaveBeenCalledWith(false, 'scan');
  // G21-S1 md.8 (#D2): Vazgeç → Elle gir → Ana sayfa elle giriş sheet'i açık.
  expect(mockNav.navigate).toHaveBeenCalledWith('Tabs', { screen: 'Tracker', params: { finOpenManual: true } });
  expect(c.reserveScan).not.toHaveBeenCalled();
});

test('izin daha önce verilmiş → sheet YOK, tarama doğrudan', async () => {
  mockDecision = 'ok';
  const c = client();
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Fotoğraf çek'));
  });
  await waitFor(() => expect(c.reserveScan).toHaveBeenCalledTimes(1));
  expect(tree.queryByTestId('consent-sheet-ai_photo')).toBeNull();
});
