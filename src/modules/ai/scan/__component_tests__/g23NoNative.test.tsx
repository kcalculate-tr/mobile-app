// G23-S1 md.5 — sürüm 1.1.0 kalır (runtimeVersion appVersion). Eski 1.1.0 TestFlight derlemesi
// + OTA: expo-speech-recognition ve react-native-purchases native modülleri YOK → Ses girişi ve
// abonelik girişleri GİZLİ, çökme yok. (expo-system-ui yalnız native yapılandırma; JS içe aktarımı yok.)
import React from 'react';
import { NativeModules } from 'react-native';
import { act, render } from '@testing-library/react-native';

import type { AiScanClient, ScanEstimate } from '../types';
import { setAiScanClient, resetAiScanClient } from '../client';
import { setScanEventSink } from '../scanEvents';

// Bayraklar AÇIK (yeni kabuk + abonelik) — gizlilik bayraktan değil native modülün yokluğundan gelmeli.
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => k === 'yeni_kabuk' || k === 'abonelik' }));
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
jest.mock('../ui/FinScanCamera', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    loadExpoCamera: () => ({}),
    default: (p: { onVoice?: () => void }) =>
      R.createElement(RN.View, { testID: 'cam' }, p.onVoice ? R.createElement(RN.Pressable, { testID: 'cam-voice', onPress: p.onVoice }) : null),
  };
});
// Native modül arayüzü: ExpoSpeechRecognition YOK (requireOptionalNativeModule → null).
jest.mock('expo', () => {
  const actual = jest.requireActual('expo');
  return { ...actual, requireOptionalNativeModule: (name: string) => (name === 'ExpoSpeechRecognition' ? null : actual.requireOptionalNativeModule(name)) };
});

// eslint-disable-next-line import/first
import ScanScreen from '../screens/ScanScreen';
// eslint-disable-next-line import/first
import { loadSpeech } from '../voice/speech';
// eslint-disable-next-line import/first
import { initPurchases, useSubscriptionStore } from '../../../../lib/subscription/purchases';
// eslint-disable-next-line import/first
import { useSubscriptionEnabled } from '../../../../lib/subscription/useSubscriptionBootstrap';

const EST: Omit<ScanEstimate, 'isEstimate'> = {
  name: 'x',
  kcal: 1,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  portion: 1,
  ingredients: [],
  photo_url: null,
};

beforeEach(() => setScanEventSink(() => {}));
afterEach(() => {
  resetAiScanClient();
  setScanEventSink(null);
});

test('konuşma tanıma modülü yok → loadSpeech null, Tara\'da Ses girişi gizli, çökme yok', async () => {
  expect(loadSpeech()).toBeNull();
  const c: AiScanClient = {
    reserveScan: jest.fn(async () => ({ ok: true, remaining: 1, reset_at: new Date(Date.now() + 864e5).toISOString() })),
    releaseScan: jest.fn(async () => undefined),
    analyzeImage: jest.fn(async () => EST),
    analyzeText: jest.fn(async () => EST),
  };
  setAiScanClient(c);
  const tree = render(<ScanScreen />);
  await act(async () => {});
  expect(tree.getByTestId('cam')).toBeTruthy();
  expect(tree.queryByTestId('cam-voice')).toBeNull();
});

test('RevenueCat native modülü yok → initPurchases false, available false, abonelik bayrak açıkken bile kapalı', () => {
  expect((NativeModules as Record<string, unknown>).RNPurchases).toBeUndefined();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test_public';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test_public';
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  let ok = true;
  expect(() => {
    ok = initPurchases();
  }).not.toThrow();
  expect(ok).toBe(false);
  expect(useSubscriptionStore.getState().available).toBe(false);
  let enabled = true;
  function Probe() {
    enabled = useSubscriptionEnabled();
    return null;
  }
  render(<Probe />);
  expect(enabled).toBe(false);
  warn.mockRestore();
  delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
});
