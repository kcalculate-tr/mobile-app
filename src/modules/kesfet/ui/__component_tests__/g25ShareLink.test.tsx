// G25-S1 md.7 (A10) — l.eatkcal.com hazır olana kadar gönderi "Paylaş" ve "Bağlantıyı kopyala"
// uzak bayrak `paylasim_baglanti` (varsayılan KAPALI) ile gizli; Universal Link kodu kalır.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostCard } from '../PostCard';
import { PostMenu } from '../PostMenu';
import { postCardModel } from '../format';
import type { FeedPost } from '../../types';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const noop = () => {};

const POST: FeedPost = {
  id: 'p1',
  author: { id: 'a1', display_name: 'Dyt. Elif', handle: 'dyt.elif', avatar_url: null, role: 'dietitian', verified: true },
  published_at: '2026-11-03T10:00:00.000Z',
  lang: 'tr',
  body: 'Dengeli bir öğün paylaşımı.',
  media: [],
  meal_card: null,
  quote: null,
  thread: null,
  stats: { likes: 3, saves: 1, adds: 0, comments: 0, did_it: 0 },
  me: { liked: false, saved: false, is_author: false },
  post_type: 'ogun',
  status: 'published',
  activity_card: null,
};
const model = postCardModel(POST, Date.parse('2026-11-03T12:00:00.000Z'), 'tr');

test('PostCard: onShare verilmezse Paylaş düğmesi yok; verilirse var', () => {
  const off = render(<PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} />);
  expect(off.queryByLabelText('Paylaş')).toBeNull();
  off.unmount();
  const on = render(<PostCard model={model} onLike={noop} onSave={noop} onShare={noop} onOpenMenu={noop} />);
  expect(on.getByLabelText('Paylaş')).toBeTruthy();
});

test('PostMenu: onCopyLink verilmezse "Bağlantıyı kopyala" yok, Şikayet/Engelle durur', () => {
  const r = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PostMenu visible onClose={noop} authorName="Dyt. Elif" onReport={noop} onBlock={noop} />
    </SafeAreaProvider>,
  );
  expect(r.queryByText('Bağlantıyı kopyala')).toBeNull();
  expect(r.getByText('Şikayet et')).toBeTruthy();
});

test('çağrı yerleri bayrağa bağlı; Universal Link yapılandırması yerinde', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
  const kesfet = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  expect(kesfet).toContain("useFeature('paylasim_baglanti')");
  expect(kesfet).toMatch(/onShare=\{paylasimBaglanti \? \(\) => onShare\(item\) : undefined\}/);
  expect(kesfet).toMatch(/onCopyLink=\{paylasimBaglanti \?/);
  expect(kesfet).toMatch(/onShare=\{paylasimBaglanti \? \(\) => videoPost/);
  const detail = read('src/modules/kesfet/ui/PostDetailScreen.tsx');
  expect(detail).toMatch(/useFeature\('paylasim_baglanti'\)/);
  expect(detail).toMatch(/\{paylasimBaglanti \? \(\s*<IconCount/);
  expect(detail).toMatch(/onCopyLink=\{\s*paylasimBaglanti/);
  const shared = read('src/screens/share/SharedPostScreen.tsx');
  expect(shared).toMatch(/onShare=\{\s*paylasimBaglanti/);
  const linking = read('src/navigation/linking.ts');
  expect(linking).toMatch(/'https:\/\/l\.eatkcal\.com'/);
});
