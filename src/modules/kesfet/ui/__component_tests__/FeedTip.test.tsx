// G12-S2 — FinFeedTip bileşen testi. Kapat (x) → onDismiss çağrılır + bayrak
// AsyncStorage'a yazılır (bir daha gösterilmez).
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedTip, feedTipSeen, FEED_TIP_SEEN_FLAG } from '../FeedTip';

beforeEach(async () => {
  await AsyncStorage.removeItem(FEED_TIP_SEEN_FLAG);
});

test('başlangıçta görülmedi', async () => {
  expect(await feedTipSeen()).toBe(false);
});

test('kapat (x) → onDismiss çağrılır + bayrak işaretlenir', async () => {
  const onDismiss = jest.fn();
  const { getByLabelText } = render(<FeedTip onDismiss={onDismiss} />);
  fireEvent.press(getByLabelText('Kapat'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(await feedTipSeen()).toBe(true);
});
