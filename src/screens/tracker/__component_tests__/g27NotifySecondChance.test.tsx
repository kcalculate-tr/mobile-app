// G27-S1 md.3 (G26 SORULAR 4) — ilk öğün oturumunda başka onay sheet'i açıldığı için
// kaçan bildirim teklifi, SONRAKİ oturumda öğün kaydından sonra BİR kez daha gelir.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockPending: string | null = null;
const mockDismiss = jest.fn(async () => {
  mockPending = null;
});
jest.mock('../../../modules/celebrate', () => {
  const R = require('react');
  const { Text: T, Pressable } = require('react-native');
  return {
    useCelebrations: () => ({ pending: mockPending, evaluate: async () => {}, dismiss: mockDismiss, markSeen: async () => {} }),
    CelebrateOverlay: ({ onDone }: { onDone: () => void }) =>
      R.createElement(Pressable, { testID: 'celebrate-done', onPress: onDone }, R.createElement(T, null, 'kutlama')),
    NotifyPermissionSheet: ({ visible }: { visible: boolean }) => (visible ? R.createElement(T, { testID: 'notify-sheet' }, 'bildirim') : null),
  };
});
let mockCanOffer = true;
jest.mock('../../../core/push/pushPermission', () => ({ canOfferPush: async () => mockCanOffer }));
jest.mock('../../../core/supabase', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'lt']) q[m] = () => q;
  q.limit = async () => ({ data: [{ id: 1 }], error: null });
  return { getSupabaseClient: () => q };
});
jest.mock('../../../modules/profil/streakReminder', () => ({ syncStreakReminder: async () => {} }));
jest.mock('../../../modules/gun/track/mealReminder', () => ({ syncMealReminders: async () => {}, cancelMealReminders: async () => {} }));
jest.mock('../../../modules/gun/track/events', () => ({ trackEvent: () => {} }));
jest.mock('../../../lib/analytics', () => ({ track: () => {} }));

import { HomeCelebrations, NOTIFY_MISSED_KEY } from '../HomeCelebrations';
import { noteConsentSheet, resetConsentSheetSession } from '../../../lib/permissions/sheetSession';

const meal = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Öğün ${i}`, calories: 300, consumed_at: new Date().toISOString(), meal_type: 'lunch' }));

function UI({ count }: { count: number }) {
  return (
    <>
      <Text>ana</Text>
      <HomeCelebrations userId="u1" today={meal(count)} days={[]} todayKey="2026-11-11" todayStartISO="2026-11-11T00:00:00Z" ready />
    </>
  );
}

const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(async () => {
  await AsyncStorage.clear();
  resetConsentSheetSession(true);
  mockPending = null;
  mockCanOffer = true;
});

test('ilk öğün oturumunda onay sheet\'i açıldıysa teklif kaçar; sonraki oturumda öğün kaydında BİR kez daha', async () => {
  // Oturum A: AI izni sheet'i açıldı, ilk öğün kutlaması kapanıyor → teklif ertelenir.
  noteConsentSheet('ai_photo');
  mockPending = 'first';
  const a = render(<UI count={1} />);
  await flush(5000);
  fireEvent.press(a.getByTestId('celebrate-done'));
  await flush();
  expect(a.queryByTestId('notify-sheet')).toBeNull();
  const missed = await AsyncStorage.getItem(NOTIFY_MISSED_KEY);
  expect(missed).toBeTruthy();
  // Aynı oturumda ikinci kayıt → yine yok.
  a.rerender(<UI count={2} />);
  await flush(5000);
  expect(a.queryByTestId('notify-sheet')).toBeNull();
  a.unmount();

  // Oturum B (uygulama yeniden açıldı): açılışta değil, ÖĞÜN KAYDINDAN sonra teklif.
  resetConsentSheetSession(true);
  const b = render(<UI count={2} />);
  await flush(5000);
  expect(b.queryByTestId('notify-sheet')).toBeNull();
  b.rerender(<UI count={3} />);
  await flush(5000);
  expect(b.getByTestId('notify-sheet')).toBeTruthy();
  expect(await AsyncStorage.getItem(NOTIFY_MISSED_KEY)).toBeNull();
  expect(await AsyncStorage.getItem('@kcal_celebrate_notify_offered')).toBe('1');
  b.unmount();

  // Oturum C: bir daha otomatik teklif yok.
  resetConsentSheetSession(true);
  const c = render(<UI count={3} />);
  c.rerender(<UI count={4} />);
  await flush(5000);
  expect(c.queryByTestId('notify-sheet')).toBeNull();
});

test('kaçan teklif yoksa öğün kaydı teklif açmaz; ilk öğün normal akışta hemen teklif edilir', async () => {
  const a = render(<UI count={2} />);
  a.rerender(<UI count={3} />);
  await flush(5000);
  expect(a.queryByTestId('notify-sheet')).toBeNull();
  a.unmount();

  mockPending = 'first';
  const b = render(<UI count={1} />);
  await flush(5000);
  fireEvent.press(b.getByTestId('celebrate-done'));
  await flush();
  expect(b.getByTestId('notify-sheet')).toBeTruthy();
  expect(await AsyncStorage.getItem(NOTIFY_MISSED_KEY)).toBeNull();
});

test('ikinci şansta izin artık sorulamıyorsa hak düşer, teklif yok', async () => {
  await AsyncStorage.setItem(NOTIFY_MISSED_KEY, 'eski-oturum');
  mockCanOffer = false;
  const a = render(<UI count={1} />);
  a.rerender(<UI count={2} />);
  await flush(5000);
  expect(a.queryByTestId('notify-sheet')).toBeNull();
  expect(await AsyncStorage.getItem(NOTIFY_MISSED_KEY)).toBeNull();
});
