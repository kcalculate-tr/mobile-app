// G17-S2 md.1–4 — FinScanR2 canlı kamera: izin akışı, deklanşör (kalite 0.5 +
// boyut ≤ 1600), FinMoScan analiz katmanı, flaş, barkod okuma (G21-S1: Open Food Facts).
// expo-camera native modülü jest'te yok → sahte modül enjekte edilir (`cam` prop).
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import FinScanCamera, { loadExpoCamera } from '../ui/FinScanCamera';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

type Perm = { granted: boolean; canAskAgain: boolean; status: string };

function fakeCam(opts: { get: Perm; request?: Perm }) {
  const takePictureAsync = jest.fn(async () => ({ uri: 'file:///cache/shot.jpg', width: 1200, height: 1600 }));
  const getAvailablePictureSizesAsync = jest.fn(async () => ['4000x3000', '1600x1200', '1280x960']);
  const lastProps: { current: Record<string, unknown> } = { current: {} };
  const CameraView = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    lastProps.current = props;
    React.useImperativeHandle(ref, () => ({ takePictureAsync, getAvailablePictureSizesAsync }));
    return <View testID={props.testID as string} />;
  });
  const Camera = {
    getCameraPermissionsAsync: jest.fn(async () => opts.get),
    requestCameraPermissionsAsync: jest.fn(async () => opts.request ?? opts.get),
  };
  return {
    cam: { CameraView, Camera } as unknown as typeof import('expo-camera'),
    Camera,
    takePictureAsync,
    lastProps,
  };
}

const GRANTED: Perm = { granted: true, canAskAgain: true, status: 'granted' };
const UNDETERMINED: Perm = { granted: false, canAskAgain: true, status: 'undetermined' };
const DENIED: Perm = { granted: false, canAskAgain: false, status: 'denied' };

function base() {
  return {
    remaining: 2,
    analyzing: false,
    photoUri: null,
    onClose: jest.fn(),
    onCaptured: jest.fn(),
    onGallery: jest.fn(),
    onManual: jest.fn(),
    onPermissionDenied: jest.fn(),
    onPermissionGranted: jest.fn(),
  };
}

async function ready(tree: ReturnType<typeof render>, f: ReturnType<typeof fakeCam>) {
  await waitFor(() => expect(tree.getByTestId('fin-scan-camera')).toBeTruthy());
  await act(async () => {
    (f.lastProps.current.onCameraReady as () => void)();
  });
}

test('ilk açılış: izin istenir; verilince canlı görüntü + çerçeve ipucu, "Kamerayı aç" kartı YOK', async () => {
  const f = fakeCam({ get: UNDETERMINED, request: GRANTED });
  const p = base();
  const tree = render(<FinScanCamera cam={f.cam} {...p} />);
  await ready(tree, f);
  expect(f.Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(tree.getByText('Tabağı tam çerçevele')).toBeTruthy();
  expect(tree.getByText('Bugün 2/2 tarama hakkın kaldı')).toBeTruthy(); // G23-S1: yedek tavan 2
  expect(tree.queryByText('Kamerayı aç')).toBeNull();
  expect(tree.queryByTestId('fin-scan-open-camera')).toBeNull();
  expect(p.onPermissionDenied).not.toHaveBeenCalled();
  // çekim boyutu: uzun kenar ≤ 1600 (4:3)
  await waitFor(() => expect(f.lastProps.current.pictureSize).toBe('1600x1200'));
});

test('izin reddedildi (tekrar sorulamaz) → onPermissionDenied, kamera görüntüsü yok', async () => {
  const f = fakeCam({ get: DENIED });
  const p = base();
  const tree = render(<FinScanCamera cam={f.cam} {...p} />);
  await waitFor(() => expect(p.onPermissionDenied).toHaveBeenCalledTimes(1));
  expect(f.Camera.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  expect(tree.queryByTestId('fin-scan-camera')).toBeNull();
});

test('G26-S1: bir kez reddedilen kamera izni (Android tekrar sorabilse de) bir daha İSTENMEZ', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asMod = require('@react-native-async-storage/async-storage');
  const AsyncStorage = asMod.default ?? asMod;
  await AsyncStorage.clear();
  const f = fakeCam({ get: UNDETERMINED, request: { ...UNDETERMINED, status: 'denied' } });
  const p = base();
  const t1 = render(<FinScanCamera cam={f.cam} {...p} />);
  await waitFor(() => expect(p.onPermissionDenied).toHaveBeenCalledTimes(1));
  expect(f.Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  t1.unmount();
  const p2 = base();
  render(<FinScanCamera cam={f.cam} {...p2} />);
  await waitFor(() => expect(p2.onPermissionDenied).toHaveBeenCalledTimes(1));
  expect(f.Camera.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  await AsyncStorage.clear();
});

test('deklanşör: takePictureAsync kalite 0.5 → onCaptured(uri)', async () => {
  const f = fakeCam({ get: GRANTED });
  const p = base();
  const tree = render(<FinScanCamera cam={f.cam} {...p} />);
  await ready(tree, f);
  await act(async () => {
    fireEvent.press(tree.getByTestId('fin-scan-shutter'));
  });
  expect(f.takePictureAsync).toHaveBeenCalledWith(expect.objectContaining({ quality: 0.5 }));
  expect(p.onCaptured).toHaveBeenCalledWith('file:///cache/shot.jpg', { width: 1200, height: 1600 }); // G19-S1: boyut da gider
});

test('analiz sürerken FinMoScan katmanı + "Analiz ediliyor"; önizleme duraklar, deklanşör kilitli', async () => {
  const f = fakeCam({ get: GRANTED });
  const p = { ...base(), analyzing: true, photoUri: 'file:///cache/shot.jpg' };
  const tree = render(<FinScanCamera cam={f.cam} {...p} />);
  await ready(tree, f);
  expect(tree.getByTestId('fin-scan-analyzing')).toBeTruthy();
  expect(tree.getByText('Analiz ediliyor')).toBeTruthy();
  expect(f.lastProps.current.active).toBe(false);
  await act(async () => {
    fireEvent.press(tree.getByTestId('fin-scan-shutter'));
  });
  expect(f.takePictureAsync).not.toHaveBeenCalled();
});

test('flaş: fotoğrafta flash=on, barkodda torch', async () => {
  const f = fakeCam({ get: GRANTED });
  const tree = render(<FinScanCamera cam={f.cam} {...base()} />);
  await ready(tree, f);
  expect(f.lastProps.current.flash).toBe('off');
  fireEvent.press(tree.getByLabelText('Flaş'));
  expect(f.lastProps.current.flash).toBe('on');
  fireEvent.press(tree.getByText('Barkod'));
  expect(f.lastProps.current.enableTorch).toBe(true);
  expect(f.lastProps.current.flash).toBe('off');
});

test('barkod modu (G21-S1 md.2): EAN/UPC tarayıcı; geçerli kod onBarcode\'a gider, bozuk kod yok sayılır; sorgu sürerken "Ürün aranıyor…"', async () => {
  const f = fakeCam({ get: GRANTED });
  const p = base();
  const onBarcode = jest.fn();
  const tree = render(<FinScanCamera cam={f.cam} {...p} onBarcode={onBarcode} />);
  await ready(tree, f);
  expect(f.lastProps.current.barcodeScannerSettings).toBeUndefined();
  fireEvent.press(tree.getByText('Barkod'));
  expect(f.lastProps.current.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] });
  expect(tree.queryByText('Barkod yakında')).toBeNull();
  expect(tree.queryByTestId('fin-scan-barcode-soon')).toBeNull();
  expect(tree.getByText('Barkodu çerçeveye hizala')).toBeTruthy();
  const scan = (data: string) =>
    act(() => {
      (f.lastProps.current.onBarcodeScanned as (r: { type: string; data: string }) => void)({ type: 'ean13', data });
    });
  scan('4006381333932'); // bozuk sağlama
  expect(onBarcode).not.toHaveBeenCalled();
  scan('4006381333931');
  expect(onBarcode).toHaveBeenCalledWith('4006381333931');
  scan('4006381333931'); // aynı kod art arda → tek gönderim
  expect(onBarcode).toHaveBeenCalledTimes(1);
  // sorgu sürüyor → tarayıcı kapalı + hap
  tree.rerender(<FinScanCamera cam={f.cam} {...p} onBarcode={onBarcode} barcodeBusy />);
  expect(tree.getByTestId('fin-scan-barcode-busy')).toBeTruthy();
  expect(tree.getByText('Ürün aranıyor…')).toBeTruthy();
  expect(f.lastProps.current.onBarcodeScanned).toBeUndefined();
  // "Fotoğrafla tara" → modeKey ile foto moduna döner
  tree.rerender(<FinScanCamera cam={f.cam} {...p} onBarcode={onBarcode} initialMode="photo" modeKey={1} />);
  expect(tree.getByText('Tabağı tam çerçevele')).toBeTruthy();
  expect(f.lastProps.current.barcodeScannerSettings).toBeUndefined();
});

test('loadExpoCamera: native modül varsa expo-camera; yoksa null (eski derleme OTA ile çökmez)', () => {
  expect(loadExpoCamera()?.CameraView).toBeTruthy(); // jest-expo native modülü taklit eder
  jest.isolateModules(() => {
    jest.doMock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: () => null }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadExpoCamera: load } = require('../ui/FinScanCamera') as typeof import('../ui/FinScanCamera');
    expect(load()).toBeNull();
  });
});

// G18-S4 md.5 — "Detay ekle" hapı: isteğe bağlı; boşsa deklanşör doğrudan çeker.
test('Detay ekle: hap → tek satır alan (soru + yer tutucu + 160 sınırı); not hapta görünür', async () => {
  const f = fakeCam({ get: GRANTED });
  const p = base();
  function Host() {
    const [note, setNote] = React.useState('');
    return <FinScanCamera cam={f.cam} {...p} note={note} onNoteChange={setNote} />;
  }
  const tree = render(<Host />);
  await ready(tree, f);
  expect(tree.getByText('Detay ekle')).toBeTruthy();
  fireEvent.press(tree.getByTestId('fin-scan-note-pill'));
  expect(tree.getByText('Belirtmek istediğin bir detay var mı?')).toBeTruthy();
  const input = tree.getByTestId('fin-scan-note-input');
  expect(input.props.placeholder).toBe('ör. kıymalı börek, 500 g');
  expect(input.props.maxLength).toBe(160);
  fireEvent.changeText(input, 'kıymalı börek, 500 g');
  fireEvent(input, 'submitEditing');
  expect(tree.queryByTestId('fin-scan-note-field')).toBeNull();
  expect(tree.getByText('kıymalı börek, 500 g')).toBeTruthy();
});

test('Detay ekle: not boşken deklanşör ek adım olmadan doğrudan çeker', async () => {
  const f = fakeCam({ get: GRANTED });
  const p = base();
  const tree = render(<FinScanCamera cam={f.cam} {...p} note="" onNoteChange={jest.fn()} />);
  await ready(tree, f);
  await act(async () => {
    fireEvent.press(tree.getByTestId('fin-scan-shutter'));
  });
  expect(p.onCaptured).toHaveBeenCalledWith('file:///cache/shot.jpg', { width: 1200, height: 1600 }); // G19-S1: boyut da gider
  expect(tree.queryByTestId('fin-scan-note-field')).toBeNull();
});
