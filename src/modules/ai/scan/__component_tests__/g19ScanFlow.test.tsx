// G19-S1 md.1 — Tara uçtan uca akış (yeni kabuk, canlı kamera): yarış / yeniden deneme /
// kapatılan analiz / kayıt hatası / ölçüm olayları. Native yok: expo-camera sahte modül,
// analiz istemcisi setAiScanClient ile enjekte, kayıt saveEstimate taklidi.
import React from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AiScanClient, ScanEstimate } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';
import { clearOrphanResult } from '../orphanResult';
import { useScanQuotaStore } from '../quotaStore';

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
let mockNetFetch: () => Promise<{ isConnected: boolean | null }> = () => Promise.resolve({ isConnected: true });
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {}, fetch: () => mockNetFetch() },
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

let mockShot = 0;
const mockTakePicture = jest.fn(async () => ({ uri: `file:///cache/shot${++mockShot}.jpg` }));
jest.mock('../ui/FinScanCamera', () => {
  const actual = jest.requireActual('../ui/FinScanCamera');
  const R = jest.requireActual('react');
  const { View: V } = jest.requireActual('react-native');
  const CameraView = R.forwardRef((props: { testID?: string }, ref: unknown) => {
    R.useImperativeHandle(ref, () => ({
      takePictureAsync: () => mockTakePicture(),
      getAvailablePictureSizesAsync: async () => [],
    }));
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

const EST: Omit<ScanEstimate, 'isEstimate'> = {
  name: 'Pilav, Ayran',
  kcal: 280,
  protein_g: 8,
  carbs_g: 51,
  fat_g: 6,
  portion: 1,
  ingredients: [
    { name: 'Pilav', grams: 150, kcal: 210, protein_g: 4, carbs_g: 45, fat_g: 3 },
    { name: 'Ayran', grams: 200, kcal: 70, protein_g: 4, carbs_g: 6, fat_g: 3 },
  ],
  photo_url: null,
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function client(analyze: jest.Mock): AiScanClient & { reserveScan: jest.Mock; releaseScan: jest.Mock } {
  return {
    reserveScan: jest.fn(async () => ({ ok: true, remaining: 2, reset_at: new Date(Date.now() + 864e5).toISOString() })),
    releaseScan: jest.fn(async () => undefined),
    analyzeImage: analyze,
  };
}

const events: [string, Record<string, unknown>][] = [];

beforeEach(() => {
  mockShot = 0;
  events.length = 0;
  setScanEventSink((n, p) => events.push([n, p]));
  mockNetFetch = () => Promise.resolve({ isConnected: true });
  mockSave.mockReset();
  mockSave.mockResolvedValue({ id: 'row-1' });
  mockTakePicture.mockClear();
  mockNav.goBack.mockClear();
  clearOrphanResult();
  useScanQuotaStore.getState().clear();
});
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
});

async function shutter(tree: ReturnType<typeof render>) {
  await act(async () => {
    fireEvent.press(tree.getByTestId('fin-scan-shutter'));
  });
}

test('çift dokunma: analiz başlamadan ikinci deklanşör İKİNCİ rezervasyon açmaz', async () => {
  const net = deferred<{ isConnected: boolean }>();
  mockNetFetch = () => net.promise;
  const c = client(jest.fn(async () => EST));
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await shutter(tree); // NetInfo beklenirken ikinci çekim
  expect(mockTakePicture).toHaveBeenCalledTimes(2);
  await act(async () => net.resolve({ isConnected: true }));
  await waitFor(() => expect(tree.getByText('Pilav')).toBeTruthy());
  expect(c.reserveScan).toHaveBeenCalledTimes(1);
  expect(events.map((e) => e[0])).toEqual(['scan_open', 'scan_start', 'scan_success']);
  expect(events[2][1]).toEqual({ n_items: 2, kcal: 280 });
});

test('analiz başarısız → "Tekrar dene" AYNI fotoğrafı AYNI anahtarla yeniden analiz eder', async () => {
  const analyze = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(EST);
  const c = client(analyze);
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Analiz tamamlanamadı')).toBeTruthy());
  expect(c.releaseScan).toHaveBeenCalledTimes(1); // hak iade
  await act(async () => {
    fireEvent.press(tree.getByText('Tekrar dene'));
  });
  await waitFor(() => expect(tree.getByText('Pilav')).toBeTruthy());
  expect(mockTakePicture).toHaveBeenCalledTimes(1); // yeniden çekim YOK
  const keys = c.reserveScan.mock.calls.map((a) => (a[0] as { idempotencyKey: string }).idempotencyKey);
  expect(keys).toEqual(['u1-file:///cache/shot1.jpg', 'u1-file:///cache/shot1.jpg']);
  const starts = events.filter((e) => e[0] === 'scan_start').map((e) => e[1].retry);
  expect(starts).toEqual([false, true]);
  expect(events.some((e) => e[0] === 'scan_failed' && e[1].reason === 'unknown')).toBe(true);
});

test('analiz sürerken kapatılırsa sonuç kaybolmaz: Tara yeniden açılınca sonuç ekranı', async () => {
  const pending = deferred<typeof EST>();
  const c = client(jest.fn(() => pending.promise));
  setAiScanClient(c);
  const first = render(<ScanScreen />);
  await waitFor(() => expect(first.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(first);
  first.unmount(); // X / arka plan
  await act(async () => pending.resolve(EST));
  const again = render(<ScanScreen />);
  await waitFor(() => expect(again.getByText('Pilav')).toBeTruthy());
  expect(c.reserveScan).toHaveBeenCalledTimes(1);
});

test('logla: kayıt hatası artık görünür (toast) ve yeniden denenince tek kayıt + log_meal olayı', async () => {
  setAiScanClient(client(jest.fn(async () => EST)));
  mockSave.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce({ id: 'row-9' });
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Pilav')).toBeTruthy());
  const logla = () => tree.getAllByText(/logla$/i)[0];
  await act(async () => {
    fireEvent.press(logla());
  });
  await waitFor(() => expect(tree.getByText('Loglanamadı. Bağlantını kontrol edip yeniden dene.')).toBeTruthy());
  await act(async () => {
    fireEvent.press(logla());
  });
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
  // İki deneme de AYNI source_ref (DB UNIQUE → çift kayıt imkânsız).
  const refs = mockSave.mock.calls.map((a) => (a[1] as { sourceRef: string }).sourceRef);
  expect(refs[0]).toBe(refs[1]);
  const log = events.find((e) => e[0] === 'log_meal');
  expect(log?.[1]).toMatchObject({ source: 'scan', n_items: 2, kcal: 280, edited: false });
});

test('öğe silinip loglanınca kayda düzeltilmiş toplam ve ad gider', async () => {
  setAiScanClient(client(jest.fn(async () => EST)));
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Ayran')).toBeTruthy());
  expect(tree.getByText('210 kcal')).toBeTruthy(); // satır kcal (önceden 0 kcal)
  await act(async () => {
    fireEvent.press(tree.getByLabelText('Ayran kaldır'));
  });
  await act(async () => {
    fireEvent.press(tree.getAllByText(/logla$/i)[0]);
  });
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  const saved = (mockSave.mock.calls[0][1] as { estimate: typeof EST }).estimate;
  expect(saved.kcal).toBe(210);
  expect(saved.name).toBe('Pilav');
  expect(events.find((e) => e[0] === 'log_meal')?.[1]).toMatchObject({ edited: true, n_items: 1, kcal: 210 });
});

test('çevrimdışı: rezervasyon YOK, kuyruğa alınır (dil ile), FinErrOffline', async () => {
  mockNetFetch = () => Promise.resolve({ isConnected: false });
  const c = client(jest.fn(async () => EST));
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Bağlantı yok')).toBeTruthy());
  expect(c.reserveScan).not.toHaveBeenCalled();
  const { getPendingScanQueue, clearPendingScanPhoto } = jest.requireActual('../offlineQueue');
  const q = await getPendingScanQueue();
  expect(q).toHaveLength(1);
  expect(q[0].lang).toBe('tr');
  expect(events.find((e) => e[0] === 'scan_start')?.[1]).toMatchObject({ offline: true });
  await clearPendingScanPhoto();
});

test('NetInfo isConnected=null (bilinmiyor) çevrimdışı SAYILMAZ → analiz yapılır', async () => {
  mockNetFetch = () => Promise.resolve({ isConnected: null });
  const c = client(jest.fn(async () => EST));
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Pilav')).toBeTruthy());
  expect(c.reserveScan).toHaveBeenCalledTimes(1);
});

test('kota bitti → FinErrLimit + scan_limit olayı, analiz yok', async () => {
  const c = client(jest.fn(async () => EST));
  c.reserveScan.mockResolvedValue({ ok: false, remaining: 0, reset_at: new Date(Date.now() + 864e5).toISOString() });
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await shutter(tree);
  await waitFor(() => expect(tree.getByText('Bugünkü 3 taramanı kullandın')).toBeTruthy());
  expect(c.analyzeImage).not.toHaveBeenCalled();
  expect(events.some((e) => e[0] === 'scan_limit')).toBe(true);
});
