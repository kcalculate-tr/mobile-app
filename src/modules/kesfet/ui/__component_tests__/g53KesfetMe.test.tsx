// G53-S1 md.1 — Keşfet üst çubuğu: kendi profil fotoğrafım (yoksa baş harf) → kendi herkese açık profilim;
// oturum yoksa AuthSheet (`Login`). Erişilebilirlik etiketi "Profilim, paylaşımlarım". md.3 — görsel kılavuzu.
jest.mock('../../media', () => ({
  MAX_PHOTOS: 4,
  pickPhotos: async () => [],
  uploadPhotos: async () => [],
  currentUserId: async () => 'me',
}));
let mockUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = { id: 'me', user_metadata: { full_name: 'Deniz' } };
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { KesfetMeButton, useKesfetMe } from '../KesfetMe';
import { useMyProfileStore } from '../../../profil/myProfileStore';
import { ShareGuideSheet } from '../ShareGuideSheet';
import { ComposerScreen } from '../ComposerScreen';
import { SHARE_GUIDE_SEEN_KEY } from '../../shareGuide';
import { setKesfetClient, resetKesfetClient } from '../../client';
import { createMockKesfetClient } from '../../mock';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const flat = (s: unknown) => Object.assign({}, ...[s].flat(5).filter(Boolean));

function Harness({ nav }: { nav: { navigate: jest.Mock } }) {
  const me = useKesfetMe(nav);
  return <KesfetMeButton {...me} />;
}

beforeEach(() => {
  mockUser = { id: 'me', user_metadata: { full_name: 'Deniz' } };
  useMyProfileStore.setState({ userId: 'me', avatarUrl: 'https://cdn/avatars/me.jpg', handle: 'deniz', name: 'Deniz' });
});

test('avatar 36 pt, dokunma alanı 44 pt, etiket "Profilim, paylaşımlarım"; dokununca kendi PublicProfile', async () => {
  const nav = { navigate: jest.fn() };
  const r = render(<Harness nav={nav} />);
  await act(async () => {});
  const btn = r.getByLabelText('Profilim, paylaşımlarım');
  expect(flat(btn.props.style)).toMatchObject({ width: 44, height: 44 });
  const img = r.UNSAFE_getByType(Image);
  expect(img.props.source).toEqual({ uri: 'https://cdn/avatars/me.jpg' });
  expect(flat(img.props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });
  fireEvent.press(btn);
  expect(nav.navigate).toHaveBeenCalledWith('PublicProfile', { handle: 'deniz' });
});

test('foto yoksa baş harf dairesi', async () => {
  useMyProfileStore.setState({ userId: 'me', avatarUrl: null, handle: 'deniz', name: 'Deniz' });
  const r = render(<Harness nav={{ navigate: jest.fn() }} />);
  await act(async () => {});
  expect(r.getByText('D')).toBeTruthy();
});

test('oturum yok → AuthSheet (Login)', async () => {
  mockUser = null;
  const nav = { navigate: jest.fn() };
  const r = render(<Harness nav={nav} />);
  await act(async () => {});
  fireEvent.press(r.getByTestId('kesfet-header-me'));
  expect(nav.navigate).toHaveBeenCalledWith('Login');
});

test('Profil\'de foto değişince (depo) Keşfet avatarı da güncellenir', async () => {
  const r = render(<Harness nav={{ navigate: jest.fn() }} />);
  await act(async () => {});
  act(() => useMyProfileStore.getState().setAvatar('https://cdn/avatars/me.jpg?t=9'));
  expect(r.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://cdn/avatars/me.jpg?t=9' });
});

test('KesfetScreen başlığı kısayolu bağlıyor (sağda, bildirimden sonra)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../KesfetScreen.tsx'), 'utf8');
  expect(src).toMatch(/const me = useKesfetMe\(navigation\)/);
  expect(src).toMatch(/me=\{me\}/);
  const header = src.slice(src.indexOf('function Header('), src.indexOf('function Tabs('));
  expect(header.indexOf('KesfetMeButton')).toBeGreaterThan(header.indexOf('onNotifications'));
});

// ─── md.3 ──────────────────────────────────────────────────────────────────────
test('görsel kılavuzu koddaki gerçek sınır değerlerini gösteriyor (video açık/kapalı)', () => {
  const r = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShareGuideSheet visible onClose={() => {}} showVideo />
    </SafeAreaProvider>,
  );
  expect(r.getByText('4:5 dikey (1080 × 1350)')).toBeTruthy();
  expect(r.getByText('1:1 kare (1080 × 1080)')).toBeTruthy();
  expect(r.getByText(/180–320 pt/)).toBeTruthy();
  expect(r.getByText('En fazla 4 fotoğraf ve 1 video')).toBeTruthy();
  expect(r.getByText('Fotoğraf en fazla 50 MB. Yüklemeden önce %60 kalitede sıkıştırılır.')).toBeTruthy();
  expect(r.getByText('En fazla 60 sn ve 50 MB, orta kalitede yüklenir.')).toBeTruthy();
  r.unmount();
  const noVideo = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShareGuideSheet visible onClose={() => {}} showVideo={false} />
    </SafeAreaProvider>,
  );
  expect(noVideo.getByText('En fazla 4 fotoğraf')).toBeTruthy();
  expect(noVideo.queryByTestId('share-guide-video')).toBeNull();
});

describe('Composer "i"', () => {
  beforeEach(() => setKesfetClient(createMockKesfetClient()));
  afterEach(() => resetKesfetClient());
  const renderComposer = () =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ComposerScreen navigation={{ goBack: () => {} }} />
      </SafeAreaProvider>,
    );

  test('ilk paylaşım ekranında bir kez kendiliğinden (ipucu satırıyla); sonra yalnız "i" ile', async () => {
    await AsyncStorage.removeItem(SHARE_GUIDE_SEEN_KEY);
    const first = renderComposer();
    await act(async () => {});
    expect(first.getByTestId('share-guide-tip')).toBeTruthy();
    expect(await AsyncStorage.getItem(SHARE_GUIDE_SEEN_KEY)).toBe('1');
    first.unmount();

    const again = renderComposer();
    await act(async () => {});
    expect(again.queryByTestId('share-guide-sheet')).toBeNull();
    const info = again.getByLabelText('Görsel kılavuzu');
    expect(flat(info.props.style)).toMatchObject({ width: 44, height: 44 });
    await act(async () => {
      fireEvent.press(info);
    });
    expect(again.getByText('Önerilen oran ve ölçü')).toBeTruthy();
    expect(again.queryByTestId('share-guide-tip')).toBeNull();
  });
});
