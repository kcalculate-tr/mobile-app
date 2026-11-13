// G41-S1 md.1 — ATT yerel modülü yoksa (eski derleme / OTA) paket HİÇ yüklenmez, çökme yok,
// durum 'undetermined' ve soru sorulamaz (Meta iOS'ta kapalı kalır).
/* eslint-disable @typescript-eslint/no-require-imports */
let mockLoaded = 0;
jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }));
jest.mock('expo-tracking-transparency', () => {
  mockLoaded += 1;
  throw new Error("Cannot find native module 'ExpoTrackingTransparency'");
});
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const P = Object.create(actual.Platform);
  Object.defineProperty(P, 'OS', { value: 'ios' });
  return Object.setPrototypeOf({ Platform: P }, actual);
});

import { getAttStatus, requestAttOnce } from '../att';

test('yerel modül yok → paket yüklenmez; okuma undetermined, istek sorulmadı', async () => {
  expect(await getAttStatus()).toBe('undetermined');
  expect(await requestAttOnce()).toEqual({ status: 'undetermined', asked: false });
  expect(mockLoaded).toBe(0);
});
