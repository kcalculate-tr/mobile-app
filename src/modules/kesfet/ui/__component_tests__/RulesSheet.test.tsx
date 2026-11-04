// G12-S2 — FinRules bileşen testi.
// "Anladım, paylaş" → onAccept çağrılır + bayrak AsyncStorage'a yazılır.
// "Vazgeç" → onClose çağrılır, bayrak YAZILMAZ (bir dahaki denemede yine sorar).
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RulesSheet, rulesSeen, RULES_SEEN_FLAG } from '../RulesSheet';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderSheet(props: Partial<React.ComponentProps<typeof RulesSheet>> = {}) {
  const onAccept = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <RulesSheet visible onAccept={onAccept} onClose={onClose} {...props} />
    </SafeAreaProvider>,
  );
  return { ...utils, onAccept, onClose };
}

beforeEach(async () => {
  await AsyncStorage.removeItem(RULES_SEEN_FLAG);
});

test('başlangıçta görülmedi', async () => {
  expect(await rulesSeen()).toBe(false);
});

test('"Anladım, paylaş" → onAccept çağrılır + bayrak işaretlenir', async () => {
  const { getByLabelText, onAccept, onClose } = renderSheet();
  await act(async () => {
    fireEvent.press(getByLabelText('Anladım, paylaş'));
  });
  await waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
  expect(onClose).not.toHaveBeenCalled();
  expect(await rulesSeen()).toBe(true);
});

test('"Vazgeç" → onClose çağrılır, bayrak işaretlenmez', async () => {
  const { getByLabelText, onAccept, onClose } = renderSheet();
  fireEvent.press(getByLabelText('Vazgeç'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onAccept).not.toHaveBeenCalled();
  expect(await rulesSeen()).toBe(false);
});
