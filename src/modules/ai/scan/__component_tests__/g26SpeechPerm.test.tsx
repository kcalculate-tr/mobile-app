// G26-S1 md.5 — mikrofon + konuşma tanıma: tek istek, reddedilirse bir daha sistem penceresi yok.
/* eslint-disable @typescript-eslint/no-require-imports */
const mockState = { granted: false, canAskAgain: true, answer: false, requests: 0 };

jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    getPermissionsAsync: () => Promise.resolve({ granted: mockState.granted, canAskAgain: mockState.canAskAgain }),
    requestPermissionsAsync: () => {
      mockState.requests += 1;
      mockState.granted = mockState.answer;
      return Promise.resolve({ granted: mockState.answer, canAskAgain: true });
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

beforeEach(async () => {
  Object.assign(mockState, { granted: false, canAskAgain: true, answer: false, requests: 0 });
  await AsyncStorage.clear();
});

test('ret → işaretlenir; ikinci dokunuşta istek YOK, hâl denied (Ayarlar)', async () => {
  const sp = require('../voice/speech') as typeof import('../voice/speech');
  expect(await sp.speechPermission()).toEqual({ granted: false, canAskAgain: true });
  expect(await sp.requestSpeechPermission()).toEqual({ granted: false, canAskAgain: false });
  expect(mockState.requests).toBe(1);
  // Android: işletim sistemi yine sorabilir (canAskAgain true) — biz sormayız.
  expect(await sp.requestSpeechPermission()).toEqual({ granted: false, canAskAgain: false });
  expect(mockState.requests).toBe(1);
  expect(await sp.speechPermission()).toEqual({ granted: false, canAskAgain: false });
});

test('kabul → tek istek (mikrofon + konuşma tanıma birlikte)', async () => {
  mockState.answer = true;
  const sp = require('../voice/speech') as typeof import('../voice/speech');
  expect(await sp.requestSpeechPermission()).toEqual({ granted: true, canAskAgain: true });
  expect(mockState.requests).toBe(1);
  expect(await sp.requestSpeechPermission()).toEqual({ granted: true, canAskAgain: true });
  expect(mockState.requests).toBe(1);
});
