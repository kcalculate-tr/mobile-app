// G41-S1 md.3 — bildirim izni önce uygulama içi kartla: "Öğün saatinde hatırlatayım mı?"
//  • "Evet" → sistem penceresi (requestPushPermission('first_meal')) — tek yol.
//  • "Şimdi değil" → sistem penceresi AÇILMAZ; 7 gün sonra öğün kaydında EN FAZLA bir kez daha.
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockPending: string | null = null;
const mockDismiss = jest.fn(async () => {
  mockPending = null;
});
// Kabuk testi: kutlama ve kart taklit; kartın "Şimdi değil" düğmesi onLater + onClose çağırır.
jest.mock('../../../modules/celebrate', () => {
  const R = require('react');
  const { Text: T, Pressable, View } = require('react-native');
  return {
    useCelebrations: () => ({ pending: mockPending, evaluate: async () => {}, dismiss: mockDismiss, markSeen: async () => {} }),
    CelebrateOverlay: ({ onDone }: { onDone: () => void }) =>
      R.createElement(Pressable, { testID: 'celebrate-done', onPress: onDone }, R.createElement(T, null, 'kutlama')),
    NotifyPermissionSheet: ({ visible, onClose, onLater }: { visible: boolean; onClose: () => void; onLater?: () => void }) =>
      visible
        ? R.createElement(
            View,
            { testID: 'notify-sheet' },
            R.createElement(Pressable, {
              testID: 'later',
              onPress: () => {
                onLater?.();
                onClose();
              },
            }),
          )
        : null,
  };
});
let mockCanOffer = true;
const mockRequest = jest.fn(async (_s: string) => 'granted');
jest.mock('../../../core/push/pushPermission', () => ({
  canOfferPush: async () => mockCanOffer,
  requestPushPermission: (s: string) => mockRequest(s),
}));
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
jest.mock('../../../lib/notify/marketing', () => ({ setMarketingOptIn: async () => {} }));

import { HomeCelebrations, NOTIFY_LATER_AT_KEY, NOTIFY_REOFFERED_KEY } from '../HomeCelebrations';
import { resetConsentSheetSession } from '../../../lib/permissions/sheetSession';

const meal = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Öğün ${i}`, calories: 300, consumed_at: new Date().toISOString(), meal_type: 'lunch' }));

function UI({ count }: { count: number }) {
  return (
    <>
      <Text>ana</Text>
      <HomeCelebrations userId="u1" today={meal(count)} days={[]} todayKey="2026-11-13" todayStartISO="2026-11-13T00:00:00Z" ready />
    </>
  );
}

const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  for (let i = 0; i < 10; i++) await act(async () => {});
};
const DAY = 86_400_000;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetConsentSheetSession(true);
  mockPending = null;
  mockCanOffer = true;
  mockRequest.mockClear();
});

test('ilk öğünden sonra kart; "Şimdi değil" → sistem penceresi YOK; 7 gün dolmadan tekrar yok, dolunca BİR kez daha', async () => {
  mockPending = 'first';
  const ui = render(<UI count={1} />);
  await flush(5000);
  fireEvent.press(ui.getByTestId('celebrate-done'));
  await flush();
  expect(ui.getByTestId('notify-sheet')).toBeTruthy();
  fireEvent.press(ui.getByTestId('later'));
  await flush();
  expect(ui.queryByTestId('notify-sheet')).toBeNull();
  expect(mockRequest).not.toHaveBeenCalled();
  const laterAt = Number(await AsyncStorage.getItem(NOTIFY_LATER_AT_KEY));
  expect(Number.isFinite(laterAt)).toBe(true);

  // Aynı gün yeni öğün → kart yok (7 gün dolmadı).
  ui.rerender(<UI count={2} />);
  await flush(5000);
  expect(ui.queryByTestId('notify-sheet')).toBeNull();

  // 8 gün önce ertelenmiş gibi → sonraki öğün kaydında ikinci kart.
  await AsyncStorage.setItem(NOTIFY_LATER_AT_KEY, String(Date.now() - 8 * DAY));
  ui.rerender(<UI count={3} />);
  await flush(5000);
  expect(ui.getByTestId('notify-sheet')).toBeTruthy();
  expect(await AsyncStorage.getItem(NOTIFY_REOFFERED_KEY)).toBe('1');
  fireEvent.press(ui.getByTestId('later'));
  await flush();
  expect(mockRequest).not.toHaveBeenCalled();

  // Üçüncü kez asla (yalnız Ayarlar › Bildirimler).
  await AsyncStorage.setItem(NOTIFY_LATER_AT_KEY, String(Date.now() - 30 * DAY));
  ui.rerender(<UI count={4} />);
  await flush(5000);
  expect(ui.queryByTestId('notify-sheet')).toBeNull();
});

describe('NotifyPermissionSheet — ön kart düğmeleri', () => {
  // Gerçek kart (taklitsiz) — modül kaydı ayrı.
  const real = () => jest.requireActual('../../../modules/celebrate/NotifyPermissionSheet').NotifyPermissionSheet;

  test('"Şimdi değil" sistem penceresini AÇMAZ, onLater çağrılır; "Evet" tek fonksiyonu bir kez çağırır', async () => {
    const Sheet = real();
    const onLater = jest.fn();
    const onClose = jest.fn();
    const ui = render(<Sheet visible onClose={onClose} onLater={onLater} />);
    await flush(1000);
    expect(ui.getByText('Öğün saatinde hatırlatayım mı?')).toBeTruthy();
    await act(async () => fireEvent.press(ui.getByTestId('notify-precard-later')));
    expect(mockRequest).not.toHaveBeenCalled();
    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();

    onLater.mockClear();
    await act(async () => fireEvent.press(ui.getByTestId('notify-precard-yes')));
    await flush();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith('first_meal');
    expect(onLater).not.toHaveBeenCalled();
  });

  test('EN: "Remind you at mealtimes?" + Yes / Not now', async () => {
    const Sheet = real();
    const { I18nProvider } = require('../../../core/i18n');
    const ui = render(
      <I18nProvider forceLang="en">
        <Sheet visible onClose={() => {}} />
      </I18nProvider>,
    );
    await flush(1000);
    expect(ui.getByText('Remind you at mealtimes?')).toBeTruthy();
    expect(ui.getByLabelText('Yes')).toBeTruthy();
    expect(ui.getByLabelText('Not now')).toBeTruthy();
  });
});
