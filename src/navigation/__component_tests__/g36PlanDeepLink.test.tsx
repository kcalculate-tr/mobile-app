// G36-S1 md.14 — bildirim dokunuşu uçtan uca: expo-notifications yanıtı (data.url) →
// setupNotificationListeners → resolveNavigation → doğru rota; linking.ts config yolu çözer.
import { getStateFromPath } from '@react-navigation/native';

type Listener = (r: unknown) => void;
let mockResponse: Listener | null = null;
jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: () => ({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: (cb: Listener) => {
    mockResponse = cb;
    return { remove: jest.fn() };
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `kcal://${p.replace(/^\//, '')}` }));
jest.mock('../../lib/dayKey', () => ({ ...jest.requireActual('../../lib/dayKey'), dayKey: () => '2026-11-12' }));

import { setupNotificationListeners } from '../../core/notifications';
import { resolveNavigation } from '../../lib/navigation';
import { linking } from '../linking';

const tap = (data: Record<string, unknown>) =>
  mockResponse?.({ notification: { request: { content: { data } } }, actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' });

const navRef = (routeNames: string[]) => ({
  isReady: () => true,
  navigate: jest.fn(),
  getRootState: () => ({ routeNames }),
});

test('haftalık tartı bildirimi → Haftalık tartı', () => {
  const nav = navRef(['Tabs', 'PersonalPlanCheckin', 'MealPlan', 'PersonalPlanMine']);
  const off = setupNotificationListeners(nav);
  tap({ pp: 'weigh', url: 'kcal://plan/checkin' });
  expect(nav.navigate).toHaveBeenCalledWith('PersonalPlanCheckin', undefined);
  off();
});

test('öğün hatırlatması → Öğün planı (bugün)', () => {
  const nav = navRef(['Tabs', 'PersonalPlanCheckin', 'MealPlan', 'PersonalPlanMine']);
  const off = setupNotificationListeners(nav);
  tap({ pp: 'meal', url: 'kcal://plan/today' });
  expect(nav.navigate).toHaveBeenCalledWith('MealPlan', { date: '2026-11-12', weekStart: '2026-11-09' });
  off();
});

test('öğün planı bayrağı kapalı (rota yok) → Kişisel planım; o da yoksa ana sayfa', () => {
  const nav = navRef(['Tabs', 'PersonalPlanCheckin', 'PersonalPlanMine']);
  resolveNavigation(nav, 'kcal://plan/today');
  expect(nav.navigate).toHaveBeenCalledWith('PersonalPlanMine');
  const bare = navRef(['Tabs']);
  resolveNavigation(bare, 'kcal://plan/checkin');
  expect(bare.navigate).toHaveBeenCalledWith('Home');
});

test('plan dışı url verisi derin bağlantı sayılmaz (eski davranış aynı)', () => {
  const nav = navRef(['Tabs']);
  const off = setupNotificationListeners(nav);
  tap({ url: 'https://example.com' });
  expect(nav.navigate).not.toHaveBeenCalled();
  off();
});

test('linking.ts: kcal://plan/checkin ve plan/today yolları rotaya çözülür', () => {
  const cfg = linking.config as Parameters<typeof getStateFromPath>[1];
  expect(getStateFromPath('plan/checkin', cfg)?.routes[0].name).toBe('PersonalPlanCheckin');
  expect(getStateFromPath('plan/today', cfg)?.routes[0].name).toBe('MealPlan');
  expect(getStateFromPath('plan/mine', cfg)?.routes[0].name).toBe('PersonalPlanMine');
  expect(getStateFromPath('p/abc', cfg)?.routes[0].name).toBe('SharedPost');
});
