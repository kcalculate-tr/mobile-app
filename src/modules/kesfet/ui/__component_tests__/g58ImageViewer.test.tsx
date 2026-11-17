// G58-S2 md.2 — tam ekran görüntüleyicide etkileşimler: sayılar akış kartıyla AYNI store'dan
// (iyimser), çift dokunma beğenir (beğeniyi geri almaz), tek dokunma katmanı gizler, yorum düğmesi
// görüntüleyicinin üstünde CommentsSheet açar, kapatınca görüntüleyici yerinde kalır.
import React from 'react';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ImageViewer } from '../ImageViewer';
import { PostCard } from '../PostCard';
import { CommentsSheet } from '../CommentsSheet';
import { postCardModel } from '../format';
import { useKesfetStore } from '../../store';
import { createMockKesfetClient } from '../../mock';
import { resetKesfetClient, setKesfetClient } from '../../client';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const render = (el: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>);

/** Akış ekranındaki bağlamayla aynı: gönderi store'dan canlı, eylemler store.react. */
function Harness({ postId, withCard = false }: { postId: string; withCard?: boolean }) {
  const post = useKesfetStore((s) => s.posts.find((p) => p.id === postId) ?? null);
  if (!post) return null;
  const like = () => void useKesfetStore.getState().react(post.id, 'like', !post.me.liked);
  const save = () => void useKesfetStore.getState().react(post.id, 'save', !post.me.saved);
  return (
    <>
      {withCard ? (
        <PostCard model={postCardModel(post, Date.now(), 'tr')} onLike={like} onSave={save} onOpenMenu={() => {}} />
      ) : null}
      <ImageViewer
        state={{ urls: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'], index: 0 }}
        onClose={() => {}}
        post={post}
        commentsEnabled
        onLike={like}
        onSave={save}
      />
    </>
  );
}

beforeEach(async () => {
  jest.useFakeTimers();
  setKesfetClient(createMockKesfetClient());
  useKesfetStore.getState().reset();
  await act(async () => {
    await useKesfetStore.getState().load();
  });
});
afterEach(() => {
  resetKesfetClient();
  jest.useRealTimers();
});

const first = () => useKesfetStore.getState().posts[0];

test('beğen düğmesi store üzerinden günceller; görüntüleyici ve akış kartı aynı sayıyı gösterir', async () => {
  const p = first();
  const before = p.stats.likes;
  const liked = p.me.liked;
  const ui = render(<Harness postId={p.id} withCard />);
  expect(ui.getByTestId('kesfet-image-viewer-like-count').props.children).toBe(String(before));
  await act(async () => {
    fireEvent.press(ui.getByTestId('kesfet-image-viewer-like'));
  });
  const after = first();
  expect(after.me.liked).toBe(!liked);
  expect(after.stats.likes).toBe(before + (liked ? -1 : 1));
  expect(ui.getByTestId('kesfet-image-viewer-like-count').props.children).toBe(String(after.stats.likes));
  // Akış kartındaki erişilebilirlik adı aynı sayıyı taşır.
  expect(ui.getAllByLabelText(new RegExp(`Beğen, ${after.stats.likes}$`)).length).toBeGreaterThanOrEqual(2);
});

test('kaydet görüntüleyiciden → store durumu değişir (kartla senkron)', async () => {
  const p = first();
  const ui = render(<Harness postId={p.id} />);
  await act(async () => {
    fireEvent.press(ui.getByTestId('kesfet-image-viewer-save'));
  });
  expect(first().me.saved).toBe(!p.me.saved);
});

test('çift dokunma beğenir; beğenilmişte ikinci çift dokunma beğeniyi GERİ ALMAZ', async () => {
  const p = first();
  if (p.me.liked) await act(async () => useKesfetStore.getState().react(p.id, 'like', false));
  const ui = render(<Harness postId={p.id} />);
  const img = ui.getByTestId('kesfet-image-viewer-image-0');
  await act(async () => {
    fireEvent.press(img);
    fireEvent.press(img);
  });
  expect(first().me.liked).toBe(true);
  const likes = first().stats.likes;
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  await act(async () => {
    fireEvent.press(img);
    fireEvent.press(img);
  });
  expect(first().me.liked).toBe(true);
  expect(first().stats.likes).toBe(likes);
});

test('tek dokunma etkileşim katmanını gizler, ikinci tek dokunma geri getirir; sayaç 1/3', async () => {
  const ui = render(<Harness postId={first().id} />);
  expect(ui.getByTestId('kesfet-image-viewer-overlay')).toBeTruthy();
  expect(ui.getByText('1/3')).toBeTruthy();
  const img = ui.getByTestId('kesfet-image-viewer-image-0');
  fireEvent.press(img);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(ui.queryByTestId('kesfet-image-viewer-overlay')).toBeNull();
  // Kapat düğmesi her zaman erişilebilir kalır.
  expect(ui.getByTestId('kesfet-image-viewer-close')).toBeTruthy();
  fireEvent.press(img);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(ui.getByTestId('kesfet-image-viewer-overlay')).toBeTruthy();
});

test('yorum düğmesi görüntüleyicinin üstünde yorum sayfasını açar; kapatınca görüntüleyici yerinde', async () => {
  const ui = render(<Harness postId={first().id} />);
  expect(ui.queryByTestId('comments-title')).toBeNull();
  await act(async () => {
    fireEvent.press(ui.getByTestId('kesfet-image-viewer-comment'));
  });
  // Yorum sayfası ayrı native Modal (görüntüleyicinin üstünde); test ağacında kardeş olduğu için
  // RNTL onu accessibilityViewIsModal yüzünden "gizli" sayar → includeHiddenElements.
  expect(ui.UNSAFE_getByType(CommentsSheet).props.visible).toBe(true);
  expect(ui.getByTestId('comments-title', { includeHiddenElements: true })).toBeTruthy();
  expect(ui.getByTestId('kesfet-image-viewer')).toBeTruthy();
  await act(async () => {
    fireEvent.press(ui.getAllByLabelText('Kapat', { includeHiddenElements: true }).find((n) => n.props.testID !== 'kesfet-image-viewer-close')!);
  });
  expect(ui.UNSAFE_getByType(CommentsSheet).props.visible).toBe(false);
  expect(ui.getByTestId('kesfet-image-viewer')).toBeTruthy();
  expect(ui.getByTestId('kesfet-image-viewer-overlay')).toBeTruthy();
});

test('post verilmezse (eski çağrı) etkileşim katmanı yok', () => {
  const ui = render(<ImageViewer state={{ urls: ['https://x/1.jpg'], index: 0 }} onClose={() => {}} />);
  expect(ui.queryByTestId('kesfet-image-viewer-overlay')).toBeNull();
  expect(ui.getByTestId('kesfet-image-viewer-close')).toBeTruthy();
});
