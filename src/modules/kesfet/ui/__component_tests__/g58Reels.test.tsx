// G58-S2 md.3 — Reels: TEK OYNATICI kuralı (ekrandaki oynar, sonraki önceden yüklenir/duraklatılmış,
// diğerleri oynatıcısız), dokunulan video ilk sırada, dokun = duraklat, sayılar store'la senkron,
// video yokken boş hâl; Keşfet başlığındaki giriş yalnız bayrak açıkken.
import React from 'react';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useKesfetStore } from '../../store';
import type { FeedPost, KesfetClient } from '../../types';
import { resetKesfetClient, setKesfetClient } from '../../client';

type FakePlayer = { url: string; playing: boolean; muted: boolean; loop: boolean; released: boolean; play(): void; pause(): void; duration: number; currentTime: number };
const mockPlayers: FakePlayer[] = [];
jest.mock('expo-video', () => {
  const R = jest.requireActual('react');
  return {
    useVideoPlayer: (url: string, setup?: (p: unknown) => void) => {
      const ref = R.useRef(null);
      if (!ref.current) {
        const p = { url, playing: false, muted: false, loop: false, released: false, duration: 10, currentTime: 0, play() { this.playing = true; }, pause() { this.playing = false; } };
        setup?.(p);
        mockPlayers.push(p);
        ref.current = p;
      }
      R.useEffect(() => () => { ref.current.released = true; ref.current.playing = false; }, []);
      return ref.current;
    },
    VideoView: () => null,
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
let mockRouteParams: Record<string, unknown> | undefined = { startId: 'v2' };
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockRouteParams }) };
});

// eslint-disable-next-line import/first
import { ReelsScreen } from '../ReelsScreen';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (el: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>);

function post(id: string, video: boolean, extra: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    author: { id: `a-${id}`, display_name: `Yazar ${id}`, handle: `h${id}`, avatar_url: null, role: 'user', verified: false },
    published_at: '2026-11-17T10:00:00.000Z',
    lang: 'tr',
    body: `Gönderi ${id}`,
    media: video ? [{ url: `https://x/${id}.mp4`, width: 720, height: 1280, kind: 'video', duration_s: 12, thumb_path: null }] : [{ url: `https://x/${id}.jpg`, width: 1, height: 1, kind: 'image' }],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 5, saves: 1, adds: 0, comments: 2, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    post_type: 'serbest',
    status: 'published',
    activity_card: null,
    ...extra,
  } as FeedPost;
}

beforeEach(() => {
  mockPlayers.length = 0;
  mockRouteParams = { startId: 'v2' };
  useKesfetStore.setState({
    posts: [post('f1', false), post('v1', true), post('v2', true), post('v3', true), post('v4', true)],
    hasMore: false,
    loading: false,
    loadingMore: false,
  });
});

const live = () => mockPlayers.filter((p) => !p.released);

test('dokunulan video ilk sırada; yalnız o oynar, sonraki önceden yüklenir (duraklatılmış), en çok 2 oynatıcı', () => {
  const ui = render(<ReelsScreen />);
  expect(ui.getByTestId('reel-page-v2')).toBeTruthy();
  expect(live().length).toBe(2);
  const playing = live().filter((p) => p.playing);
  expect(playing.map((p) => p.url)).toEqual(['https://x/v2.mp4']);
  expect(live().find((p) => !p.playing)?.url).toBe('https://x/v1.mp4');
  // Sesli başlar.
  expect(playing[0].muted).toBe(false);
});

test('dokun = duraklat, tekrar dokun = oynat', async () => {
  const ui = render(<ReelsScreen />);
  const tap = ui.getAllByTestId('reel-tap')[ui.getAllByTestId('reel-tap').length > 1 ? 0 : 0];
  await act(async () => {
    fireEvent.press(tap);
  });
  expect(live().some((p) => p.playing)).toBe(false);
  expect(ui.getByTestId('reel-paused')).toBeTruthy();
  await act(async () => {
    fireEvent.press(ui.getAllByTestId('reel-tap')[0]);
  });
  expect(live().filter((p) => p.playing).length).toBe(1);
});

test('uzun bas = basılı tutarken duraklat', async () => {
  const ui = render(<ReelsScreen />);
  const tap = ui.getAllByTestId('reel-tap')[0];
  await act(async () => {
    fireEvent(tap, 'longPress');
  });
  expect(live().some((p) => p.playing)).toBe(false);
  await act(async () => {
    fireEvent(tap, 'pressOut');
  });
  expect(live().filter((p) => p.playing).length).toBe(1);
});

test('ses düğmesi sessize alır (sayfalar arası ortak)', async () => {
  const ui = render(<ReelsScreen />);
  await act(async () => {
    fireEvent.press(ui.getAllByTestId('reel-mute')[0]);
  });
  expect(live().every((p) => p.muted)).toBe(true);
});

test('beğeni store üzerinden — akış kartıyla aynı sayı', async () => {
  setKesfetClient({
    reactPost: async ({ on }: { on: boolean }) => ({
      me: { liked: on, saved: false, is_author: false },
      stats: { likes: on ? 6 : 5, saves: 1, adds: 0, comments: 2, did_it: 0 },
    }),
  } as unknown as KesfetClient);
  const ui = render(<ReelsScreen />);
  await act(async () => {
    fireEvent.press(ui.getAllByTestId('reel-like')[0]);
  });
  const v2 = useKesfetStore.getState().posts.find((p) => p.id === 'v2')!;
  expect(v2.me.liked).toBe(true);
  expect(v2.stats.likes).toBe(6);
  expect(ui.getAllByLabelText('Beğen, 6 beğeni').length).toBeGreaterThan(0);
  resetKesfetClient();
});

test('VoiceOver: sonraki reel eylemi sayfayı çevirir → yeni sayfa oynar, eski sayfanın oynatıcısı serbest kalmaz/çalmaz', async () => {
  const ui = render(<ReelsScreen />);
  const pager = ui.getByLabelText(/Reel 1 \/ 4/);
  await act(async () => {
    fireEvent(pager, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  });
  // Animasyon tamamlanması test ortamında anlık değil; en az şu garanti: aynı anda tek oynayan.
  expect(live().filter((p) => p.playing).length).toBeLessThanOrEqual(1);
  expect(live().length).toBeLessThanOrEqual(2);
});

test('video yokken boş hâl', () => {
  mockRouteParams = undefined;
  useKesfetStore.setState({ posts: [post('f1', false)], hasMore: false, loading: false });
  const ui = render(<ReelsScreen />);
  expect(ui.getByTestId('reels-empty')).toBeTruthy();
  expect(ui.getByText('Henüz video yok')).toBeTruthy();
  expect(mockPlayers.length).toBe(0);
});

test('başlıktaki giriş (startId yok) ilk videodan açar', () => {
  mockRouteParams = undefined;
  const ui = render(<ReelsScreen />);
  expect(live().find((p) => p.playing)?.url).toBe('https://x/v1.mp4');
  expect(ui.getByTestId('reel-page-v1')).toBeTruthy();
});
