// G61-S1 md.3 — ShareLink (l.eatkcal.com/m|d|x|r|i, /s/<UUID>): anlık görüntü kartı, yok → "Bu içerik artık yok",
// davet kodu cihaza kaydı, hikâye → profil / süresi doldu.
import React from 'react';
import { act, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
let mockParams: { kind: string; id: string } = { kind: 'm', id: 'aB3dE5fG7h' };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) };
});
const mockSnap = jest.fn();
const mockPreview = jest.fn();
jest.mock('../../../lib/share/snapshotApi', () => ({
  getShareSnapshot: (...a: unknown[]) => mockSnap(...a),
  getSharePreview: (...a: unknown[]) => mockPreview(...a),
}));

import ShareLinkScreen from '../ShareLinkScreen';
import { PENDING_INVITE_KEY } from '../../../lib/share/pendingInvite';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = () => rtlRender(<SafeAreaProvider initialMetrics={metrics}><ShareLinkScreen /></SafeAreaProvider>);
async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(async () => {
  mockSnap.mockReset();
  mockPreview.mockReset();
  mockNav.replace.mockClear();
  await AsyncStorage.clear();
});

test('öğün anlık görüntüsü → kart + sahibi', async () => {
  mockParams = { kind: 'm', id: 'aB3dE5fG7h' };
  mockSnap.mockResolvedValue({ id: 'aB3dE5fG7h', kind: 'meal', payload: { name: 'Menemen', kcal: 410, weight: 80 }, createdAt: null, ownerName: 'Ayşe', ownerHandle: 'ayse' });
  const r = render();
  await settle();
  expect(r.getByTestId('share-link-card')).toBeTruthy();
  expect(r.getByText('@ayse')).toBeTruthy();
  expect(r.getByLabelText('Öğün kartı')).toBeTruthy();
});

test('iptal / bulunamadı → "Bu içerik artık yok"', async () => {
  mockParams = { kind: 'd', id: 'aB3dE5fG7h' };
  mockSnap.mockResolvedValue(null);
  const r = render();
  await settle();
  expect(r.getByTestId('share-link-gone')).toBeTruthy();
  expect(r.getByText('Bu içerik artık yok')).toBeTruthy();
});

test('davet /i/<kod> → kod cihaza kaydedilir, davet kartı', async () => {
  mockParams = { kind: 'i', id: 'k7m2qx' };
  const r = render();
  await settle();
  expect(r.getByTestId('share-link-card')).toBeTruthy();
  const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY);
  expect(JSON.parse(raw as string).code).toBe('K7M2QX');
});

test('hikâye: süresi dolmamış → profil; dolmuş → "Hikâye süresi doldu"', async () => {
  const uuid = '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77';
  mockParams = { kind: 's', id: uuid };
  mockPreview.mockResolvedValue({ kind: 'story', expired: false, handle: 'ayse', author_name: 'Ayşe' });
  render();
  await settle();
  expect(mockNav.replace).toHaveBeenCalledWith('PublicProfile', { handle: 'ayse' });
  mockPreview.mockResolvedValue({ kind: 'story', expired: true, handle: 'ayse', author_name: 'Ayşe' });
  const r = render();
  await settle();
  expect(r.getByText('Hikâye süresi doldu')).toBeTruthy();
});

test('saha kodu biçimli /s/ ya da bilinmeyen tür → yok', async () => {
  mockParams = { kind: 's', id: 'IZM01' };
  const r = render();
  await settle();
  expect(r.getByTestId('share-link-gone')).toBeTruthy();
  expect(mockPreview).not.toHaveBeenCalled();
});
