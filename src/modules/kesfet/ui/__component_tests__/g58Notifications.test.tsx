// G58-S1 md.2 — `sosyal_bildirim` bayrak açma turu: bildirim yönlendirme (handle'sız aktör kimlikle),
// okundu işaretleme (yalnız başarılı yüklemede, en yeni satıra kadar), takip isteği sonuçlanmışsa
// satır geri gelmez, okunmamış vurgu korunur, ekran okuyucu etiketi, sayfalama.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
const mockRespond = jest.fn();
jest.mock('../../../profil', () => ({ getProfilClient: () => ({ respondFollowRequest: (a: unknown) => mockRespond(a) }) }));

import NotificationsScreen from '../NotificationsScreen';
import { getKesfetClient, resetKesfetClient, setKesfetClient } from '../../client';
import { useNotificationsStore } from '../../notificationsStore';
import type { SocialNotification } from '../../types';

const now = Date.now();
const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const actor = (id: string, handle: string | null, name: string) => ({ id, handle: handle as string, display_name: name, avatar_url: null, verified: false });
const N = (p: Partial<SocialNotification> & { id: string }): SocialNotification => ({
  actor: actor('a-1', 'deniz', 'Deniz'),
  kind: 'like',
  post_id: null,
  comment_id: null,
  created_at: iso(5),
  read_at: null,
  ...p,
});

let mark: jest.Mock;
function withNotifications(list: jest.Mock) {
  const base = getKesfetClient();
  mark = jest.fn(async () => {});
  setKesfetClient({ ...base, listSocialNotifications: list, markSocialNotificationsRead: mark } as typeof base);
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};

afterEach(() => {
  resetKesfetClient();
  useNotificationsStore.getState().reset();
  jest.clearAllMocks();
});

test('handle’sız aktörün takip bildirimi → PublicProfile kimlikle açılır', async () => {
  const uuid = '7d1f0c7e-3a52-4c1b-9f0e-0a1b2c3d4e5f';
  withNotifications(jest.fn().mockResolvedValue({ items: [N({ id: 'n1', kind: 'follow', actor: actor(uuid, null, 'Ece') })], next_cursor: null, unread: 1 }));
  const r = render(<NotificationsScreen />);
  await flush();
  fireEvent.press(r.getByTestId('notif-row-n1'));
  expect(mockNav.navigate).toHaveBeenCalledWith('PublicProfile', { handle: uuid });
});

test('yorum bildirimi → SharedPost (gönderi + yorum kimliği); beğeni → yalnız gönderi', async () => {
  withNotifications(
    jest.fn().mockResolvedValue({
      items: [N({ id: 'c1', kind: 'comment', post_id: 'p-9', comment_id: 'cm-3', actor: actor('a-2', 'ali', 'Ali') }), N({ id: 'l1', kind: 'like', post_id: 'p-8', created_at: iso(90) })],
      next_cursor: null,
      unread: 0,
    }),
  );
  const r = render(<NotificationsScreen />);
  await flush();
  fireEvent.press(r.getByTestId('notif-row-c1'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('SharedPost', { postId: 'p-9', commentId: 'cm-3' });
  fireEvent.press(r.getByTestId('notif-row-l1'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('SharedPost', { postId: 'p-8' });
});

test('başarılı yükleme → en yeni satırın zamanına kadar okundu; okunmamış vurgusu ve etiketi kalır', async () => {
  const newest = iso(1);
  withNotifications(jest.fn().mockResolvedValue({ items: [N({ id: 'n1', created_at: newest }), N({ id: 'n2', created_at: iso(30), actor: actor('a-3', 'su', 'Su') })], next_cursor: null, unread: 2 }));
  const r = render(<NotificationsScreen />);
  await flush();
  expect(mark).toHaveBeenCalledWith({ until: newest });
  expect(useNotificationsStore.getState().unread).toBe(0);
  // Rozet sıfırlandı ama bu oturumda satır hâlâ "Okunmamış" okunur.
  expect(r.getByTestId('notif-row-n1').props.accessibilityLabel).toMatch(/^Okunmamış, Deniz, /);
});

test('yükleme başarısız → okundu İŞARETLENMEZ (rozet korunur)', async () => {
  useNotificationsStore.setState({ unread: 4 });
  withNotifications(jest.fn().mockRejectedValue(new Error('network')));
  const r = render(<NotificationsScreen />);
  await flush();
  expect(r.getByText('Bildirimler yüklenemedi')).toBeTruthy();
  expect(mark).not.toHaveBeenCalled();
  expect(useNotificationsStore.getState().unread).toBe(4);
});

test('takip isteği: satır gruplanmaz (VoiceOver düğmelere ulaşır); sonuçlanmış istek (istek_yok) geri gelmez', async () => {
  withNotifications(jest.fn().mockResolvedValue({ items: [N({ id: 'fr1', kind: 'follow_request', actor: actor('a-4', 'can', 'Can') })], next_cursor: null, unread: 1 }));
  mockRespond.mockRejectedValueOnce(new Error('istek_yok'));
  const r = render(<NotificationsScreen />);
  await flush();
  expect(r.getByTestId('notif-row-fr1').props.accessible).toBe(false);
  await act(async () => {
    fireEvent.press(r.getByLabelText('Onayla'));
  });
  await flush();
  expect(r.queryByTestId('notif-row-fr1')).toBeNull();
});

test('takip isteği: ağ hatasında satır geri gelir (yeniden denenebilir)', async () => {
  withNotifications(jest.fn().mockResolvedValue({ items: [N({ id: 'fr2', kind: 'follow_request', actor: actor('a-5', 'nur', 'Nur') })], next_cursor: null, unread: 0 }));
  mockRespond.mockRejectedValueOnce(new Error('network'));
  const r = render(<NotificationsScreen />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByLabelText('Onayla'));
  });
  await flush();
  expect(r.getByTestId('notif-row-fr2')).toBeTruthy();
});

test('liste sonuna yaklaşınca sonraki sayfa yüklenir', async () => {
  const list = jest
    .fn()
    .mockResolvedValueOnce({ items: [N({ id: 'n1' })], next_cursor: 'c1', unread: 0 })
    .mockResolvedValueOnce({ items: [N({ id: 'n2', created_at: iso(60 * 24 * 3), actor: actor('a-6', 'efe', 'Efe') })], next_cursor: null, unread: 0 });
  withNotifications(list);
  const r = render(<NotificationsScreen />);
  await flush();
  await act(async () => {
    fireEvent.scroll(r.getByTestId('notif-list'), { nativeEvent: { contentOffset: { y: 500 }, contentSize: { height: 900, width: 400 }, layoutMeasurement: { height: 800, width: 400 } } });
  });
  await flush();
  expect(list).toHaveBeenLastCalledWith({ cursor: 'c1' });
  expect(r.getByTestId('notif-row-n2')).toBeTruthy();
});
