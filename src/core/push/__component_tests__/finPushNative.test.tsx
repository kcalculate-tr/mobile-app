// G18-S4 md.3 — FinPush native: kategoriler (aksiyonlar + gizli önizleme) ve aksiyon
// işleyicileri (ertele / sessize al / yanıtla / dokunuş).
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-notifications', () => ({
  setNotificationCategoryAsync: jest.fn(async () => ({})),
  setNotificationChannelAsync: jest.fn(async () => ({})),
  scheduleNotificationAsync: jest.fn(async () => 'id-1'),
  dismissNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => [] as unknown[]),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
const mockN = jest.requireMock('expo-notifications') as Record<string, jest.Mock> & { DEFAULT_ACTION_IDENTIFIER: string };
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  FIN_REMINDER_MUTED_KEY,
  handleFinPushResponse,
  registerFinPushCategories,
  shouldSuppressFinPush,
} from '../finPushNative';
import { translate } from '../../i18n/core';

const t = (k: string) => translate('tr', k);

function response(data: Record<string, unknown>, actionIdentifier: string, userText?: string) {
  return {
    actionIdentifier,
    userText,
    notification: {
      request: { identifier: 'n1', content: { title: 'Öğle öğününü henüz loglamadın', body: 'b', data } },
    },
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('kategoriler: 4 şablon; gizli önizleme "Bildirim", başlık gizli; aksiyon başlıkları TR', async () => {
  await registerFinPushCategories(t);
  const calls = mockN.setNotificationCategoryAsync.mock.calls as unknown as [string, { identifier: string; buttonTitle: string; textInput?: unknown }[], Record<string, unknown>][];
  expect(calls.map((c) => c[0]).sort()).toEqual(['fin_order', 'fin_reminder', 'fin_social', 'fin_streak']);
  for (const [, actions, opts] of calls) {
    expect(actions.length).toBeLessThanOrEqual(2);
    expect(opts).toMatchObject({ previewPlaceholder: 'Bildirim', showTitle: false });
  }
  const byId = Object.fromEntries(calls.map((c) => [c[0], c[1]]));
  expect(byId.fin_order.map((a) => a.buttonTitle)).toEqual(['Siparişi izle']);
  expect(byId.fin_streak).toEqual([]);
  expect(byId.fin_social[0].buttonTitle).toBe('Yanıtla');
  expect(byId.fin_social[0].textInput).toBeTruthy();
  expect(byId.fin_reminder.map((a) => a.buttonTitle)).toEqual(['30 dk ertele', 'Bugün sessize al']);
});

test('"30 dk ertele": bildirim kapanır, aynı hatırlatma 1800 sn sonra yeniden kurulur', async () => {
  const handled = await handleFinPushResponse(response({ fin: 'reminder', meal: 'lunch' }, 'fin_remind_snooze_30'), null);
  expect(handled).toBe(true);
  expect(mockN.dismissNotificationAsync).toHaveBeenCalledWith('n1');
  const arg = (mockN.scheduleNotificationAsync.mock.calls[0] as unknown as [{ content: { categoryIdentifier: string }; trigger: { seconds: number } }])[0];
  expect(arg.trigger.seconds).toBe(1800);
  expect(arg.content.categoryIdentifier).toBe('fin_reminder');
});

test('"Bugün sessize al": gün sonuna kadar hatırlatmalar bastırılır', async () => {
  await handleFinPushResponse(response({ fin: 'reminder', meal: 'lunch' }, 'fin_remind_mute_today'), null);
  expect(await AsyncStorage.getItem(FIN_REMINDER_MUTED_KEY)).toBeTruthy();
  expect(await shouldSuppressFinPush({ fin: 'reminder' })).toBe(true);
  expect(await shouldSuppressFinPush({ fin: 'social' })).toBe(false);
  expect(await shouldSuppressFinPush({ deep_link: 'x' })).toBe(false);
});

test('"Yanıtla": metin yorum RPC\'sine gider, bildirim kapanır', async () => {
  const reply = jest.fn(async () => undefined);
  await handleFinPushResponse(response({ fin: 'social', postId: 'p1', commentId: 'c1' }, 'fin_social_reply', '  teşekkürler '), null, {
    reply,
  });
  expect(reply).toHaveBeenCalledWith({ postId: 'p1', parentId: 'c1', body: 'teşekkürler', key: 'push-reply-n1' });
  expect(mockN.dismissNotificationAsync).toHaveBeenCalled();
});

test('dokunuş / "Siparişi izle": hedef ekran; FinPush olmayan bildirim işlenmez', async () => {
  const nav = { isReady: () => true, navigate: jest.fn() };
  await handleFinPushResponse(response({ fin: 'order_status', orderId: 7 }, 'fin_order_track'), nav);
  expect(nav.navigate).toHaveBeenCalledWith('OrderDetail', { orderId: 7 });
  expect(await handleFinPushResponse(response({ deep_link: 'kcal://orders' }, mockN.DEFAULT_ACTION_IDENTIFIER), nav)).toBe(false);
});
