// G11-S3 bileşen testi — composer "Ürün ara" gizleme.
// RPC canlıda yoksa (search_products → { available:false }) ilk aramadan sonra
// "Ürün ara" düğmesi gizlenir. Varsa düğme görünür.
//
// media.ts expo-image-picker (native) import eder; testte asla yüklenmez → taklit.
jest.mock('../../media', () => ({
  MAX_PHOTOS: 4,
  pickPhotos: async () => [],
  uploadPhotos: async () => [],
  currentUserId: async () => 'me',
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ComposerScreen } from '../ComposerScreen';
import { setKesfetClient, resetKesfetClient } from '../../client';
import { createMockKesfetClient } from '../../mock';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderComposer() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ComposerScreen navigation={{ goBack: () => {} }} />
    </SafeAreaProvider>,
  );
}

afterEach(() => resetKesfetClient());

// 250 ms debounce + mikro-görev kuyruğunu akıt (küresel sahte zamanlayıcı açık).
async function flushSearch() {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
}

test('RPC varsa "Ürün ara" düğmesi görünür (öğün türü)', () => {
  setKesfetClient(createMockKesfetClient());
  const { getByText } = renderComposer();
  expect(getByText('Ürün ara')).toBeTruthy();
});

test('RPC yoksa ilk aramadan sonra "Ürün ara" gizlenir', async () => {
  setKesfetClient(createMockKesfetClient({ productSearchUnavailable: true }));
  const { getByText, queryByText, getByPlaceholderText } = renderComposer();
  fireEvent.press(getByText('Ürün ara'));
  fireEvent.changeText(getByPlaceholderText('Ürün adı…'), 'avokado');
  await flushSearch();
  expect(queryByText('Ürün ara')).toBeNull();
});
