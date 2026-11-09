// G21-S1 md.2 — Barkod → Open Food Facts (yeni kabuk, canlı kamera): bulundu → mevcut
// sonuç düzeninin barkod kipi (düzenle + "logla", source=barcode, AI hakkı yok) ·
// bulunamadı / kcal yok → "Ürün bulunamadı" + [Fotoğrafla tara] [Elle ekle] · zaman aşımı →
// Tekrar dene · çevrimdışı → çevrimdışı hâli. EN kaynak satırı.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AiScanClient } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';
import { setTrackSink } from '../../../gun/track/events';
import { clearOrphanResult } from '../orphanResult';
import { useScanQuotaStore } from '../quotaStore';
import { I18nProvider } from '../../../../core/i18n';
import type { BarcodeLookup } from '../barcode/off';

jest.mock('../../../../core/flags', () => ({
  useFeature: (k: string) => k === 'yeni_kabuk',
}));
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
let mockOnline = true;
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {}, fetch: () => Promise.resolve({ isConnected: mockOnline }) },
}));
jest.mock('../../../../lib/consent/aiPhoto', () => ({
  resolveAiPhotoConsent: () => Promise.resolve('ok'),
  setAiPhotoConsent: () => Promise.resolve(),
  hasLocalAiPhotoConsent: () => Promise.resolve(true),
}));
jest.mock('../drainPending', () => ({
  drainPendingScans: () => Promise.resolve(),
  onPendingDrained: () => () => {},
}));
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
const mockSave = jest.fn();
jest.mock('../saveEstimate', () => ({
  saveAiScanEstimate: (...a: unknown[]) => mockSave(...a),
}));
const mockLookup = jest.fn<Promise<BarcodeLookup>, [string, { offline?: boolean }?]>();
jest.mock('../barcode/off', () => {
  const actual = jest.requireActual('../barcode/off');
  return { __esModule: true, ...actual, lookupBarcode: (...a: [string, { offline?: boolean }?]) => mockLookup(...a) };
});
const mockCam: { props: Record<string, unknown> } = { props: {} };
jest.mock('../ui/FinScanCamera', () => {
  const actual = jest.requireActual('../ui/FinScanCamera');
  const R = jest.requireActual('react');
  const { View: V } = jest.requireActual('react-native');
  const CameraView = R.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    mockCam.props = props;
    R.useImperativeHandle(ref, () => ({ takePictureAsync: async () => null, getAvailablePictureSizesAsync: async () => [] }));
    return R.createElement(V, { testID: props.testID });
  });
  const granted = { granted: true, canAskAgain: true, status: 'granted' };
  const cam = {
    CameraView,
    Camera: { getCameraPermissionsAsync: async () => granted, requestCameraPermissionsAsync: async () => granted },
  };
  return { __esModule: true, ...actual, loadExpoCamera: () => cam };
});

// eslint-disable-next-line import/first
import ScanScreen from '../screens/ScanScreen';
// eslint-disable-next-line import/first
import FinBarcodeResult from '../ui/FinBarcodeResult';

const CODE = '4006381333931';
const FOUND: BarcodeLookup = {
  status: 'found',
  cached: false,
  product: {
    code: CODE,
    names: { tr: 'Ayran', en: 'Yogurt drink', generic: 'Ayran' },
    brand: 'Sütaş',
    imageUrl: 'https://images.openfoodfacts.org/x.jpg',
    per100: { kcal: 38, p: 1.7, c: 2.4, f: 2.3 },
    servingGrams: 250,
  },
};

const reserve = jest.fn();
const events: [string, Record<string, unknown>][] = [];

beforeEach(() => {
  events.length = 0;
  setScanEventSink((n, p) => events.push([n, p]));
  setTrackSink((n, p) => events.push([n, p]));
  mockOnline = true;
  mockSave.mockReset();
  mockSave.mockResolvedValue({ id: 'row-b1' });
  mockLookup.mockReset();
  mockNav.goBack.mockClear();
  reserve.mockReset();
  const c: AiScanClient = { reserveScan: reserve, releaseScan: jest.fn(), analyzeImage: jest.fn() };
  setAiScanClient(c);
  clearOrphanResult();
  useScanQuotaStore.getState().clear();
});
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
  setTrackSink(null);
});

async function scanBarcode(tree: ReturnType<typeof render>, data = CODE) {
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  fireEvent.press(tree.getByText('Barkod'));
  await act(async () => {
    (mockCam.props.onBarcodeScanned as (r: { type: string; data: string }) => void)({ type: 'ean13', data });
  });
}

test('bulundu → barkod sonucu (ad, marka, 100 g, porsiyon 250 g, kaynak satırı) → düzenle → logla: source=barcode, AI hakkı YOK', async () => {
  mockLookup.mockResolvedValue(FOUND);
  const tree = render(<ScanScreen />);
  await scanBarcode(tree);
  await waitFor(() => expect(tree.getByTestId('fin-barcode-result')).toBeTruthy());
  expect(mockLookup).toHaveBeenCalledWith(CODE, { offline: false });
  expect(tree.getByText('Barkod sonucu')).toBeTruthy();
  expect(tree.getByDisplayValue('Ayran')).toBeTruthy();
  expect(tree.getByText('Sütaş')).toBeTruthy();
  expect(tree.getByText('Veri: Open Food Facts')).toBeTruthy();
  expect(tree.getByTestId('fin-barcode-grams').props.value).toBe('250');
  expect(tree.getByTestId('fin-barcode-total').props.children).toBe('95 kcal, P 4 g, K 6 g, Y 6 g');

  // düzenle: ad + 100 g kcal + gram
  fireEvent.changeText(tree.getByTestId('fin-barcode-name'), 'Ayran 250 ml');
  fireEvent.changeText(tree.getByTestId('fin-barcode-kcal'), '40');
  fireEvent.changeText(tree.getByTestId('fin-barcode-grams'), '200');
  expect(tree.getByTestId('fin-barcode-total').props.children).toBe('80 kcal, P 3 g, K 5 g, Y 5 g');

  await act(async () => {
    fireEvent.press(tree.getByTestId('fin-barcode-log'));
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  const arg = mockSave.mock.calls[0][1] as { source: string; sourceRef: string; estimate: { name: string; kcal: number } };
  expect(arg.source).toBe('barcode');
  expect(arg.sourceRef).toMatch(new RegExp(`^barcode-${CODE}-`));
  expect(arg.estimate).toMatchObject({ name: 'Ayran 250 ml', kcal: 80 });
  expect(reserve).not.toHaveBeenCalled(); // AI hakkı tüketilmez
  const names = events.map((e) => e[0]);
  expect(names).toEqual(['scan_open', 'barcode_scan', 'barcode_found', 'log_add']);
  expect(events.find((e) => e[0] === 'log_add')?.[1]).toMatchObject({ source: 'barcode', kcal: 80 });
  expect(events.find((e) => e[0] === 'barcode_found')?.[1]).toEqual({ cached: false, has_serving: true });
  await waitFor(() => expect(tree.getByText(/loglandı/)).toBeTruthy());

  // kapat → kamera (barkod modunda)
  fireEvent.press(tree.getByLabelText('Kapat'));
  await waitFor(() => expect(tree.getByText('Barkodu çerçeveye hizala')).toBeTruthy());
});

test('bulunamadı → "Ürün bulunamadı" + [Fotoğrafla tara] (foto moduna) + [Elle ekle] (elle giriş)', async () => {
  mockLookup.mockResolvedValue({ status: 'not_found', reason: 'missing' });
  const tree = render(<ScanScreen />);
  await scanBarcode(tree);
  await waitFor(() => expect(tree.getByText('Ürün bulunamadı')).toBeTruthy());
  expect(tree.getByText(/Open Food Facts’te yok/)).toBeTruthy();
  // durum hapı, modal sheet'in (accessibilityViewIsModal) kardeşi → gizli öğe sorgusu
  expect(tree.getByText(`Okunan barkod: ${CODE}`, { includeHiddenElements: true })).toBeTruthy();
  expect(events.find((e) => e[0] === 'barcode_not_found')?.[1]).toEqual({ reason: 'missing' });
  fireEvent.press(tree.getByText('Fotoğrafla tara'));
  await waitFor(() => expect(tree.queryByText('Ürün bulunamadı')).toBeNull());
  expect(tree.getByText('Tabağı tam çerçevele')).toBeTruthy();
  // ikinci tur: Elle ekle
  fireEvent.press(tree.getByText('Barkod'));
  mockLookup.mockResolvedValue({ status: 'not_found', reason: 'missing' });
  await act(async () => {
    (mockCam.props.onBarcodeScanned as (r: { type: string; data: string }) => void)({ type: 'ean8', data: '96385074' });
  });
  await waitFor(() => expect(tree.getByText('Elle ekle')).toBeTruthy());
  fireEvent.press(tree.getByText('Elle ekle'));
  expect(mockNav.goBack).toHaveBeenCalled();
  expect(reserve).not.toHaveBeenCalled();
});

test('kcal eksik → "Ürün bulunamadı" + kalori bilgisi eksik metni', async () => {
  mockLookup.mockResolvedValue({ status: 'not_found', reason: 'no_kcal' });
  const tree = render(<ScanScreen />);
  await scanBarcode(tree);
  await waitFor(() => expect(tree.getByText('Ürün bulunamadı')).toBeTruthy());
  expect(tree.getByText(/kalori bilgisi Open Food Facts’te eksik/)).toBeTruthy();
  expect(tree.getByText('Fotoğrafla tara')).toBeTruthy();
});

test('zaman aşımı → "Ürün bilgisi alınamadı" + Tekrar dene aynı kodla yeniden sorar', async () => {
  mockLookup.mockResolvedValueOnce({ status: 'error', reason: 'timeout' }).mockResolvedValueOnce(FOUND);
  const tree = render(<ScanScreen />);
  await scanBarcode(tree);
  await waitFor(() => expect(tree.getByText('Ürün bilgisi alınamadı')).toBeTruthy());
  expect(events.find((e) => e[0] === 'barcode_not_found')?.[1]).toEqual({ reason: 'timeout' });
  await act(async () => {
    fireEvent.press(tree.getByText('Tekrar dene'));
  });
  await waitFor(() => expect(tree.getByTestId('fin-barcode-result')).toBeTruthy());
  expect(mockLookup).toHaveBeenCalledTimes(2);
  expect(mockLookup.mock.calls[1][0]).toBe(CODE);
});

test('çevrimdışı → mevcut çevrimdışı hâli (hap + başlık) + barkod metni; istek offline ile', async () => {
  mockOnline = false;
  mockLookup.mockResolvedValue({ status: 'error', reason: 'offline' });
  const tree = render(<ScanScreen />);
  await scanBarcode(tree);
  await waitFor(() => expect(tree.getByText('Bağlantı yok')).toBeTruthy());
  expect(mockLookup).toHaveBeenCalledWith(CODE, { offline: true });
  expect(tree.getByText('Çevrimdışı', { includeHiddenElements: true })).toBeTruthy();
  expect(tree.getByText(/bağlantı gerekiyor/)).toBeTruthy();
  expect(events.find((e) => e[0] === 'barcode_scan')?.[1]).toEqual({ offline: true });
});

test('EN: barkod sonucu metinleri ve "Data: Open Food Facts" atfı', () => {
  const tree = render(
    <I18nProvider forceLang="en">
      <FinBarcodeResult
        product={{ code: CODE, name: 'Yogurt drink', brand: null, imageUrl: null, per100: { kcal: 38, p: 1.7, c: 2.4, f: 2.3 }, servingGrams: null }}
        mealType="lunch"
        saving={false}
        saved={false}
        onChangeMealType={() => {}}
        onSave={() => {}}
        onClose={() => {}}
      />
    </I18nProvider>,
  );
  expect(tree.getByText('Barcode result')).toBeTruthy();
  expect(tree.getByText('Per 100 g')).toBeTruthy();
  expect(tree.getByText('Data: Open Food Facts')).toBeTruthy();
  expect(tree.getByTestId('fin-barcode-grams').props.value).toBe('100'); // serving yok → 100 g
});
