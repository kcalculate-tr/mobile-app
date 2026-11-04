// G12-S2 — FinRules: ilk paylaşımdan önce bir kez Topluluk kuralları.
// media.ts expo-image-picker (native) import eder; testte asla yüklenmez → taklit.
jest.mock('../../media', () => ({
  MAX_PHOTOS: 4,
  pickPhotos: async () => [],
  uploadPhotos: async () => [],
  currentUserId: async () => 'me',
}));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComposerScreen } from '../ComposerScreen';
import { RULES_SEEN_FLAG } from '../RulesSheet';
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

function fillSerbestBody(getByLabelText: ReturnType<typeof render>['getByLabelText'], getByPlaceholderText: ReturnType<typeof render>['getByPlaceholderText']) {
  fireEvent.press(getByLabelText('Serbest'));
  fireEvent.changeText(getByPlaceholderText('Ne paylaşmak istersin?'), 'Merhaba Keşfet');
}

beforeEach(async () => {
  setKesfetClient(createMockKesfetClient());
  await AsyncStorage.removeItem(RULES_SEEN_FLAG);
});
afterEach(() => resetKesfetClient());

test('ilk paylaşım denemesinde Topluluk kuralları (FinRules) gösterilir', async () => {
  const { getByLabelText, getByPlaceholderText, queryByText } = renderComposer();
  fillSerbestBody(getByLabelText, getByPlaceholderText);
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  expect(queryByText('Topluluk kuralları')).toBeTruthy();
});

test('"Anladım, paylaş" → sheet kapanır, paylaşım sürer, bayrak işaretlenir', async () => {
  const { getByLabelText, getByPlaceholderText, queryByText } = renderComposer();
  fillSerbestBody(getByLabelText, getByPlaceholderText);
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  await act(async () => {
    fireEvent.press(getByLabelText('Anladım, paylaş'));
  });
  await waitFor(() => expect(queryByText('Topluluk kuralları')).toBeNull());
  expect(await AsyncStorage.getItem(RULES_SEEN_FLAG)).toBe('1');
});

test('"Vazgeç" → sheet kapanır ama bayrak işaretlenmez, paylaşım sürmez', async () => {
  const { getByLabelText, getByPlaceholderText, queryByText } = renderComposer();
  fillSerbestBody(getByLabelText, getByPlaceholderText);
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  await act(async () => {
    fireEvent.press(getByLabelText('Vazgeç'));
  });
  expect(queryByText('Topluluk kuralları')).toBeNull();
  expect(queryByText('Paylaşılıyor…')).toBeNull();
  expect(await AsyncStorage.getItem(RULES_SEEN_FLAG)).toBeNull();
});

test('bayrak önceden işaretliyse ikinci paylaşımda tekrar gösterilmez', async () => {
  await AsyncStorage.setItem(RULES_SEEN_FLAG, '1');
  const { getByLabelText, getByPlaceholderText, queryByText } = renderComposer();
  fillSerbestBody(getByLabelText, getByPlaceholderText);
  await act(async () => {
    fireEvent.press(getByLabelText('Gönder'));
  });
  expect(queryByText('Topluluk kuralları')).toBeNull();
});
