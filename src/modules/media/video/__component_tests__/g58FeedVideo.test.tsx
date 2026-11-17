// G58-S1 md.3 — `kesfet_video`: akışta native oynatıcı YALNIZ görünür hücrede (liste kaydırmada
// tek oynatıcı; görünmez olan sökülür = serbest), görünmeyen hücre kapak + süre, sessiz başlar,
// ses tercihi hücreler arası ortak.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

const mockPlayers: { muted: boolean; loop: boolean; play: jest.Mock; pause: jest.Mock; source: string }[] = [];
const mockReleased: string[] = [];
jest.mock('expo-video', () => {
  const R = require('react');
  return {
    useVideoPlayer: (source: string, setup: (p: unknown) => void) => {
      const ref = R.useRef(null);
      if (!ref.current) {
        const p = { muted: false, loop: false, play: jest.fn(), pause: jest.fn(), source, duration: 42, currentTime: 0 };
        setup(p);
        mockPlayers.push(p);
        ref.current = p;
      }
      R.useEffect(() => () => void mockReleased.push(source), []);
      return ref.current;
    },
    VideoView: () => null,
  };
});
jest.mock('../useAutoplayAllowed', () => ({ useAutoplayAllowed: () => true }));

import { FeedVideo } from '../ui/FeedVideo';
import { useActiveVideoStore } from '../activeVideo';

const labels = { mute: 'Sesi kapat', unmute: 'Sesi aç', fullscreen: 'Tam ekran', play: 'Oynat' };
const List = ({ visible }: { visible: string | null }) => (
  <View>
    {['a', 'b', 'c', 'd', 'e'].map((id) => (
      <FeedVideo key={id} id={id} source={`https://x/${id}.mp4`} posterUri={`https://x/${id}.jpg`} isVisible={visible === id} labels={labels} onOpen={() => {}} durationS={42} />
    ))}
  </View>
);

beforeEach(() => {
  mockPlayers.length = 0;
  mockReleased.length = 0;
  useActiveVideoStore.setState({ activeId: null, muted: true });
});

test('5 videolu listede yalnız görünür hücrede oynatıcı; diğerleri kapak + süre', () => {
  const r = render(<List visible="b" />);
  expect(mockPlayers).toHaveLength(1);
  expect(mockPlayers[0].source).toBe('https://x/b.mp4');
  expect(r.getAllByTestId('feed-video-poster')).toHaveLength(4);
  expect(r.getAllByText('0:42').length).toBeGreaterThanOrEqual(4);
  expect(mockPlayers[0].muted).toBe(true); // sessiz başlar
  expect(mockPlayers[0].play).toHaveBeenCalled();
});

test('kaydırınca eski oynatıcı sökülür (serbest), yenisi açılır — aynı anda tek oynatıcı', () => {
  const r = render(<List visible="a" />);
  r.rerender(<List visible="c" />);
  expect(mockReleased).toEqual(['https://x/a.mp4']);
  expect(mockPlayers.map((p) => p.source)).toEqual(['https://x/a.mp4', 'https://x/c.mp4']);
  r.rerender(<List visible={null} />);
  expect(mockReleased).toEqual(['https://x/a.mp4', 'https://x/c.mp4']);
  expect(r.getAllByTestId('feed-video-poster')).toHaveLength(5);
  expect(useActiveVideoStore.getState().activeId).toBeNull();
});

test('ses aç → sonraki görünür videoda da açık (oturum tercihi)', async () => {
  const r = render(<List visible="a" />);
  await act(async () => {
    fireEvent.press(r.getByLabelText('Sesi aç'));
  });
  expect(useActiveVideoStore.getState().muted).toBe(false);
  r.rerender(<List visible="b" />);
  expect(mockPlayers[1].muted).toBe(false);
  expect(r.getByLabelText('Sesi kapat')).toBeTruthy();
});

test('görünmeyen hücreye dokunmak tam ekranı açar (kapak etiketli)', () => {
  const onOpen = jest.fn();
  const r = render(<FeedVideo id="z" source="https://x/z.mp4" posterUri={null} isVisible={false} labels={labels} onOpen={onOpen} durationS={61} />);
  fireEvent.press(r.getByLabelText('Tam ekran'));
  expect(onOpen).toHaveBeenCalled();
  expect(r.getByText('1:01')).toBeTruthy();
  expect(mockPlayers).toHaveLength(0);
});
