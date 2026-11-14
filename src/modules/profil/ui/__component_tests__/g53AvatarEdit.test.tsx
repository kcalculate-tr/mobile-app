// G53-S1 md.2 — Profil fotoğrafı "+" rozeti: yalnız KENDİ profilinde (açık profil + Profil sekmesi başlığı);
// seçenek sayfası (kaldır yalnız foto varsa); seçim → yükleme fonksiyonu çağrılır (taklit), yüklenirken gösterge,
// başarı → yeni foto; hata → eski foto + kısa uyarı.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Image } from 'react-native';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn() };
let mockHandle = 'deniz';
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: { handle: mockHandle } }),
}));
jest.mock('../../../../core/AuthContext', () => {
  const auth = { user: { id: 'me', user_metadata: { full_name: 'Deniz' } } };
  return { useAuth: () => auth };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
const mockPick = jest.fn();
const mockUpload = jest.fn();
const mockSave = jest.fn();
const mockRemove = jest.fn();
jest.mock('../../avatarUpload', () => ({
  pickAvatarImage: (s: string) => mockPick(s),
  uploadAvatarUri: (u: string, uri: string) => mockUpload(u, uri),
  saveAvatarUrl: (url: string) => mockSave(url),
  removeAvatarUrl: (u: string) => mockRemove(u),
  pickAndUploadAvatar: async () => null,
}));

// eslint-disable-next-line import/first
import PublicProfileScreen from '../PublicProfileScreen';
// eslint-disable-next-line import/first
import PublicPreviewScreen from '../screens/PublicPreviewScreen';
// eslint-disable-next-line import/first
import { getProfilClient, resetProfilClient, setProfilClient } from '../../client';
// eslint-disable-next-line import/first
import { useMyProfileStore } from '../../myProfileStore';
// eslint-disable-next-line import/first
import type { PublicProfile } from '../../types';

const OLD = 'https://cdn/avatars/me-old.jpg';
const NEW_LOCAL = 'file:///tmp/kirpilmis.jpg';
const NEW_URL = 'https://cdn/avatars/me.jpg?t=2';

const mk = (over: Partial<PublicProfile>): PublicProfile => ({
  id: 'me',
  display_name: 'Deniz',
  handle: 'deniz',
  avatar_url: OLD,
  bio: null,
  role: 'user',
  verified: false,
  is_private: false,
  followers: 1,
  following: 2,
  posts: 3,
  me_following: 'none',
  ...over,
});

function withProfile(p: PublicProfile) {
  const base = getProfilClient();
  setProfilClient({ ...base, getPublicProfile: async () => ({ ...p }) } as typeof base);
}

const shownUris = (r: ReturnType<typeof render>) =>
  r.UNSAFE_queryAllByType(Image).map((n) => (n.props.source as { uri?: string } | undefined)?.uri).filter(Boolean);

beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue(NEW_LOCAL);
  mockUpload.mockResolvedValue(NEW_URL);
  mockSave.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  useMyProfileStore.setState({ userId: 'me', avatarUrl: OLD, handle: 'deniz', name: 'Deniz' });
});
afterEach(() => resetProfilClient());

test('"+" yalnız KENDİ açık profilimde; başkasının profilinde yok', async () => {
  mockHandle = 'deniz';
  withProfile(mk({}));
  const mine = render(<PublicProfileScreen />);
  await act(async () => {});
  expect(mine.getByTestId('public-avatar-edit-badge')).toBeTruthy();
  expect(mine.getByLabelText('Profil fotoğrafını değiştir')).toBeTruthy();
  mine.unmount();

  mockHandle = 'ayse';
  withProfile(mk({ id: 'u-ayse', handle: 'ayse', display_name: 'Ayşe' }));
  const other = render(<PublicProfileScreen />);
  await act(async () => {});
  expect(other.getByText('Ayşe')).toBeTruthy();
  expect(other.queryByTestId('public-avatar-edit-badge')).toBeNull();
  expect(other.queryByLabelText('Profil fotoğrafını değiştir')).toBeNull();
});

test('rozet: 24 pt lime daire, 44 pt dokunma alanı, zemin renginde kenar', () => {
  const r = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({})} editable />);
  const hit = r.getByTestId('public-avatar-edit-badge');
  const flat = (s: unknown) => Object.assign({}, ...[s].flat(5).filter(Boolean));
  expect(flat(hit.props.style)).toMatchObject({ width: 44, height: 44, position: 'absolute' });
  const badge = hit.findAll((n: { props: { style?: unknown } }) => flat(n.props.style).width === 24)[0];
  expect(flat(badge.props.style)).toMatchObject({ width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: '#B9EF14' });
});

test('seçenek sayfası: foto varken Çek · Galeri · Kaldır; foto yokken kaldır yok', async () => {
  const withPhoto = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({})} editable />);
  fireEvent.press(withPhoto.getByTestId('public-avatar-edit-badge'));
  await act(async () => {});
  expect(withPhoto.getByText('Fotoğraf çek')).toBeTruthy();
  expect(withPhoto.getByText('Galeriden seç')).toBeTruthy();
  expect(withPhoto.getByText('Fotoğrafı kaldır')).toBeTruthy();
  withPhoto.unmount();

  const noPhoto = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({ avatar_url: null })} editable />);
  fireEvent.press(noPhoto.getByTestId('public-avatar-edit-badge'));
  await act(async () => {});
  expect(noPhoto.getByText('Galeriden seç')).toBeTruthy();
  expect(noPhoto.queryByText('Fotoğrafı kaldır')).toBeNull();
});

test('Galeriden seç → kare kırpılmış dosya ANINDA görünür + gösterge → yükleme çağrılır → yeni URL; Keşfet deposu güncellenir', async () => {
  let finish: (v: string) => void = () => {};
  mockUpload.mockImplementation(() => new Promise<string>((res) => (finish = res)));
  const r = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({})} editable />);
  expect(shownUris(r)).toContain(OLD);
  fireEvent.press(r.getByTestId('public-avatar-edit-badge'));
  await act(async () => {});
  fireEvent.press(r.getByText('Galeriden seç'));
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(mockPick).toHaveBeenCalledWith('library');
  expect(mockUpload).toHaveBeenCalledWith('me', NEW_LOCAL);
  expect(shownUris(r)).toContain(NEW_LOCAL);
  expect(r.getByTestId('public-avatar-edit-busy')).toBeTruthy();
  await act(async () => {
    finish(NEW_URL);
  });
  expect(mockSave).toHaveBeenCalledWith(NEW_URL);
  expect(shownUris(r)).toContain(NEW_URL);
  expect(r.queryByTestId('public-avatar-edit-busy')).toBeNull();
  expect(useMyProfileStore.getState().avatarUrl).toBe(NEW_URL);
});

test('yükleme hatası → ESKİ foto geri gelir + kısa uyarı', async () => {
  mockUpload.mockRejectedValue(new Error('ağ'));
  const r = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({})} editable />);
  fireEvent.press(r.getByTestId('public-avatar-edit-badge'));
  await act(async () => {});
  fireEvent.press(r.getByText('Fotoğraf çek'));
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(mockPick).toHaveBeenCalledWith('camera');
  expect(mockUpload).toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
  expect(shownUris(r)).toContain(OLD);
  expect(shownUris(r)).not.toContain(NEW_LOCAL);
  expect(r.getByText('Fotoğraf yüklenemedi. Eski fotoğrafın duruyor.')).toBeTruthy();
  expect(useMyProfileStore.getState().avatarUrl).toBe(OLD);
});

test('Fotoğrafı kaldır → kendi satırına yazılır, baş harf görünür', async () => {
  const r = render(<PublicPreviewScreen onBack={() => {}} vitrinProfile={mk({})} editable />);
  fireEvent.press(r.getByTestId('public-avatar-edit-badge'));
  await act(async () => {});
  await act(async () => {
    fireEvent.press(r.getByText('Fotoğrafı kaldır'));
  });
  expect(mockRemove).toHaveBeenCalledWith('me');
  expect(shownUris(r)).not.toContain(OLD);
  expect(r.getAllByText('D').length).toBeGreaterThan(0);
});

// eslint-disable-next-line import/first
import { ProfileSocialHeader } from '../ProfileSocialHeader';
// eslint-disable-next-line import/first
import { useAvatarEditor } from '../AvatarEditor';

function HeaderHarness() {
  const ed = useAvatarEditor({ current: OLD });
  return (
    <>
      <ProfileSocialHeader name="Deniz" avatarUrl={OLD} onOpenSubscriptions={() => {}} avatarEditor={ed} />
      {ed.overlay}
    </>
  );
}

test('Profil sekmesi başlığı: kendi avatarımda "+" rozeti → seçenek sayfası; rozetsiz kullanım değişmedi', async () => {
  const r = render(<HeaderHarness />);
  await act(async () => {});
  fireEvent.press(r.getByTestId('profile-avatar-edit-badge'));
  await act(async () => {});
  expect(r.getByText('Galeriden seç')).toBeTruthy();
  r.unmount();
  const plain = render(<ProfileSocialHeader name="Deniz" avatarUrl={OLD} onOpenSubscriptions={() => {}} />);
  await act(async () => {});
  expect(plain.queryByTestId('profile-avatar-edit-badge')).toBeNull();
});
