// G22-S1 md.1 — Ses modu: FinScanVoice hâlleri (TR/EN) + uçtan uca akış (Tara › Ses → dinle →
// canlı döküm → Bitti → metin analizi → FinPhotoR1 source=voice). Ses sunucuya gitmez:
// analiz istemcisine yalnız metin gider.
import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AiScanClient, ScanEstimate } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';
import { I18nProvider } from '../../../../core/i18n';

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
jest.mock('../../../../lib/consent/aiPhoto', () => ({
  resolveAiPhotoConsent: () => Promise.resolve('ok'),
  setAiPhotoConsent: () => Promise.resolve(),
  hasLocalAiPhotoConsent: () => Promise.resolve(true),
}));
jest.mock('../drainPending', () => ({ drainPendingScans: () => Promise.resolve(), onPendingDrained: () => () => {} }));
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
// Canlı kamera yerine basit taslak: yalnız mod çubuğundaki "Ses" düğmesi.
jest.mock('../ui/FinScanCamera', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    loadExpoCamera: () => ({}),
    default: (p: { onVoice?: () => void; quotaPills?: { photo?: { text: string } | null } }) =>
      R.createElement(
        RN.View,
        null,
        p.quotaPills?.photo ? R.createElement(RN.Text, { testID: 'cam-pill' }, p.quotaPills.photo.text) : null,
        p.onVoice ? R.createElement(RN.Pressable, { testID: 'cam-voice', onPress: p.onVoice }, R.createElement(RN.Text, null, 'Ses')) : null,
      ),
  };
});
// Konuşma tanıma taslağı: izin var; dinleme işleyicileri teste açılır.
const mockSpeech: { handlers: any; started: number; stopped: number } = { handlers: null, started: 0, stopped: 0 };
jest.mock('../voice/speech', () => ({
  loadSpeech: () => ({}),
  speechPermission: () => Promise.resolve({ granted: true, canAskAgain: true }),
  requestSpeechPermission: () => Promise.resolve({ granted: true, canAskAgain: true }),
  startListening: (_lang: string, h: unknown) => {
    mockSpeech.handlers = h;
    mockSpeech.started++;
    return () => {};
  },
  stopListening: () => {
    mockSpeech.stopped++;
  },
  abortListening: () => {},
  speechAvailable: () => true,
}));

// eslint-disable-next-line import/first
import ScanScreen from '../screens/ScanScreen';
// eslint-disable-next-line import/first
import FinScanVoice, { type FinScanVoiceProps } from '../voice/FinScanVoice';

const EST: Omit<ScanEstimate, 'isEstimate'> = {
  name: '2 yumurta, 1 dilim ekmek',
  kcal: 218,
  protein_g: 17,
  carbs_g: 14,
  fat_g: 11,
  portion: 1,
  ingredients: [
    { name: '2 yumurta', grams: 100, kcal: 143, protein_g: 13, carbs_g: 1, fat_g: 10 },
    { name: '1 dilim ekmek', grams: 30, kcal: 75, protein_g: 4, carbs_g: 13, fat_g: 1 },
  ],
  photo_url: null,
};

const noop = () => {};
function props(over: Partial<FinScanVoiceProps> = {}): FinScanVoiceProps {
  return {
    phase: 'idle',
    transcript: '',
    pillText: 'Bugün 2/2',
    onClose: noop,
    onMode: noop,
    onMic: noop,
    onDone: noop,
    onCancel: noop,
    onKeyboardSubmit: noop,
    onPermContinue: noop,
    onPermLater: noop,
    onOpenSettings: noop,
    onRetry: noop,
    onOfflineOk: noop,
    onPlans: noop,
    onManual: noop,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeech.handlers = null;
  mockSpeech.started = 0;
  mockSpeech.stopped = 0;
  setScanEventSink(() => {});
});
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
});

test('FinScanVoice hazır: başlık, örnek, mod çubuğu Fotoğraf · Ses · Barkod · Elle, hak hapı', () => {
  const tree = render(<FinScanVoice {...props()} />);
  expect(tree.getByText('Ne yedin? Söyle')).toBeTruthy();
  expect(tree.getByText('Örnek: “1 kase mercimek çorbası ve bir ayran”')).toBeTruthy();
  expect(tree.getByText('Mikrofona dokun ve konuş')).toBeTruthy();
  expect(tree.getByText('Bugün 2/2')).toBeTruthy();
  const order = ['photo', 'voice', 'barcode', 'manual'].map((m) => tree.getByTestId(`voice-mode-${m}`));
  expect(order.map((n) => n.props.accessibilityState.selected)).toEqual([false, true, false, false]);
  expect(tree.getByLabelText('Kaydı başlat')).toBeTruthy();
  expect(tree.getByTestId('voice-keyboard')).toBeTruthy();
});

test('dinliyor: canlı döküm + Bitti; mikrofon "Kaydı durdur"', () => {
  const tree = render(<FinScanVoice {...props({ phase: 'listening', transcript: '2 yumurta, yarım avokado', interim: true, level: 0.6 })} />);
  expect(tree.getByText('Dinliyorum')).toBeTruthy();
  expect(tree.getByTestId('voice-transcript')).toBeTruthy();
  expect(tree.getByText('avokado')).toBeTruthy(); // kesinleşmemiş son kelime ayrı (ikincil renk)
  expect(tree.getByText('Bitince Bitti’ye dokun')).toBeTruthy();
  expect(tree.getByTestId('voice-done')).toBeTruthy();
  expect(tree.getByLabelText('Kaydı durdur')).toBeTruthy();
});

test('analiz: öğe çipleri + İptal, mikrofon kilitli', () => {
  const tree = render(<FinScanVoice {...props({ phase: 'processing', transcript: '2 yumurta, 1 dilim tam buğday ekmek, yarım avokado' })} />);
  expect(tree.getByText('Analiz ediliyor')).toBeTruthy();
  expect(tree.getByText('Öğelere ayırıyoruz')).toBeTruthy();
  for (const c of ['2 yumurta', '1 dilim tam buğday ekmek', 'yarım avokado']) expect(tree.getByText(c)).toBeTruthy();
  expect(tree.getByTestId('voice-cancel')).toBeTruthy();
  expect(tree.getByTestId('voice-mic').props.accessibilityState.disabled).toBe(true);
});

test('sheet hâlleri: izin (iki satır), izin kapalı, duyulmadı (hak düşmedi), çevrimdışı, hak bitti', () => {
  let tree = render(<FinScanVoice {...props({ phase: 'perm' })} />);
  expect(tree.getByText('Sesle eklemek için iki izin')).toBeTruthy();
  expect(tree.getByText('Mikrofon')).toBeTruthy();
  expect(tree.getByText('Konuşma tanıma')).toBeTruthy();
  expect(tree.getByText('Devam et')).toBeTruthy();
  expect(tree.getByText('Şimdi değil')).toBeTruthy();
  tree.unmount();
  tree = render(<FinScanVoice {...props({ phase: 'denied' })} />);
  expect(tree.getByText('Mikrofon izni kapalı')).toBeTruthy();
  expect(tree.getByText('Ayarlar’ı aç')).toBeTruthy();
  expect(tree.getByText('Fotoğraf çek')).toBeTruthy();
  tree.unmount();
  tree = render(<FinScanVoice {...props({ phase: 'empty' })} />);
  expect(tree.getByText('Seni duyamadık')).toBeTruthy();
  expect(tree.getByText('Tarama hakkından düşülmedi')).toBeTruthy();
  tree.unmount();
  tree = render(<FinScanVoice {...props({ phase: 'offline', transcript: '2 yumurta', offlineCount: 1 })} />);
  expect(tree.getByText('Bağlantı yok')).toBeTruthy();
  expect(tree.getByText('1 kayıt bağlanınca loglanacak')).toBeTruthy();
  // Sheet modal (accessibilityViewIsModal) → arkadaki döküm alanı erişilebilirlik ağacında gizli.
  expect(tree.getByText('Telefonunda saklandı', { includeHiddenElements: true })).toBeTruthy();
  expect(tree.getByText('Çevrimdışı', { includeHiddenElements: true })).toBeTruthy();
  tree.unmount();
  const onPlans = jest.fn();
  tree = render(<FinScanVoice {...props({ phase: 'limit', limitCap: 2, plansEnabled: true, onPlans })} />);
  expect(tree.getByText('Bugünkü 2 AI taramanı kullandın')).toBeTruthy();
  fireEvent.press(tree.getByText('Planları gör'));
  expect(onPlans).toHaveBeenCalled();
  tree.unmount();
  tree = render(<FinScanVoice {...props({ phase: 'limit', limitCap: 2, plansEnabled: false })} />);
  expect(tree.queryByText('Planları gör')).toBeNull();
  expect(tree.getByText('Elle gir')).toBeTruthy();
});

test('EN: başlık ve dinleme metinleri', () => {
  const tree = render(
    <I18nProvider forceLang="en">
      <FinScanVoice {...props({ phase: 'listening', transcript: '2 eggs', pillText: 'Today 1/2' })} />
    </I18nProvider>,
  );
  expect(tree.getByText('What did you eat? Say it')).toBeTruthy();
  expect(tree.getByText('Listening')).toBeTruthy();
  expect(tree.getByText('Done')).toBeTruthy();
});

test('uçtan uca: Ses → dinle → canlı döküm → Bitti → metin analizi (ses yok) → Sesle eklendi sonucu', async () => {
  const analyzeText = jest.fn(async (_p: { idempotencyKey: string; text: string; lang?: 'tr' | 'en' }) => EST);
  const analyzeImage = jest.fn(async () => EST);
  const c: AiScanClient = {
    reserveScan: jest.fn(async () => ({ ok: true, remaining: 1, reset_at: new Date(Date.now() + 864e5).toISOString(), tier: 'free' as const, limit: 2, unlimited: false })),
    releaseScan: jest.fn(async () => undefined),
    analyzeImage,
    analyzeText,
  };
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('cam-voice'));
  });
  await waitFor(() => expect(tree.getByTestId('fin-scan-voice')).toBeTruthy());
  await act(async () => {
    fireEvent.press(tree.getByTestId('voice-mic'));
  });
  await waitFor(() => expect(mockSpeech.started).toBe(1));
  await act(async () => {
    mockSpeech.handlers.onResult('2 yumurta, 1 dilim ekmek', false);
  });
  expect(tree.getByText('Dinliyorum')).toBeTruthy();
  await act(async () => {
    fireEvent.press(tree.getByTestId('voice-done'));
  });
  expect(mockSpeech.stopped).toBe(1);
  await act(async () => {
    mockSpeech.handlers.onEnd();
  });
  await waitFor(() => expect(analyzeText).toHaveBeenCalledTimes(1));
  expect(analyzeText.mock.calls[0][0]).toMatchObject({ text: '2 yumurta, 1 dilim ekmek', lang: 'tr' });
  expect(analyzeImage).not.toHaveBeenCalled();
  expect(c.reserveScan).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(tree.getByTestId('fin-photo-voice-head')).toBeTruthy());
  expect(tree.getByText('Sesle eklendi')).toBeTruthy();
  expect(tree.getByText('“2 yumurta, 1 dilim ekmek”')).toBeTruthy();
});

test('Bitti boş metinle → "Seni duyamadık", hak ayrılmaz', async () => {
  const c: AiScanClient = {
    reserveScan: jest.fn(async () => ({ ok: true, remaining: 1, reset_at: 'x' })),
    releaseScan: jest.fn(async () => undefined),
    analyzeImage: jest.fn(async () => EST),
    analyzeText: jest.fn(async () => EST),
  };
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {
    fireEvent.press(tree.getByTestId('cam-voice'));
  });
  await act(async () => {
    fireEvent.press(tree.getByTestId('voice-mic'));
  });
  await waitFor(() => expect(mockSpeech.started).toBe(1));
  await act(async () => {
    mockSpeech.handlers.onError('no-speech');
  });
  await waitFor(() => expect(tree.getByText('Seni duyamadık')).toBeTruthy());
  expect(c.reserveScan).not.toHaveBeenCalled();
});

// Kullanılmayan içe aktarma uyarısı olmasın.
void Pressable;
void Text;
