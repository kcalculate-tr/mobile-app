// G58-S2 md.2–3 — görüntüleyici + Reels saf kuralları: dokunma, aşağı kaydırma kapatma, Reels kuyruğu,
// sayfa eşiği (140 pt), TEK OYNATICI kuralı (ekrandaki oynar, sonraki önceden yüklenir, diğerleri yok).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REELS_THRESHOLD_PT,
  buildReelsQueue,
  classifyTap,
  doubleTapShouldLike,
  isVideoPost,
  mountedPlayerCount,
  reelShouldPlay,
  reelSlot,
  reelsAtEdge,
  reelsShouldLoadMore,
  reelsSnapIndex,
  viewerCapturesPan,
  viewerImageUrls,
  viewerShouldDismiss,
} from '../reels';
import type { FeedPost } from '../types';

const P = (id: string, kinds: Array<'image' | 'video'>): FeedPost =>
  ({ id, media: kinds.map((k, i) => ({ url: `${id}-${i}`, width: 1, height: 1, kind: k })) }) as unknown as FeedPost;

test('dokunma: 300 ms içinde ikinci dokunuş çift; ilk dokunuş tek', () => {
  assert.equal(classifyTap(1000, 0), 'single');
  assert.equal(classifyTap(1200, 1000), 'double');
  assert.equal(classifyTap(1400, 1000), 'single');
  assert.equal(doubleTapShouldLike(false), true);
  assert.equal(doubleTapShouldLike(true), false, 'çift dokunma beğeniyi geri almaz');
});

test('görüntüleyici: aşağı 120 pt ya da hızlı fiske kapatır; yukarı/yatay kapatmaz', () => {
  assert.equal(viewerShouldDismiss(130, 0.2), true);
  assert.equal(viewerShouldDismiss(40, 1.4), true);
  assert.equal(viewerShouldDismiss(60, 0.3), false);
  assert.equal(viewerShouldDismiss(-200, -2), false);
  assert.equal(viewerShouldDismiss(130, 0.2, 300), false, 'yatay ağırlıklı = sayfa kaydırma');
  assert.equal(viewerCapturesPan(2, 20), true);
  assert.equal(viewerCapturesPan(30, 20), false);
  assert.equal(viewerCapturesPan(0, 5), false);
});

test('görüntüleyici görselleri videoyu dışarıda bırakır', () => {
  assert.deepEqual(viewerImageUrls(P('a', ['image', 'video', 'image'])), ['a-0', 'a-2']);
  assert.deepEqual(viewerImageUrls(null), []);
});

test('Reels kuyruğu: dokunulan video ilk, sonra akıştaki diğer videolar (sıra korunur, tekrar/fotoğraf yok)', () => {
  const feed = [P('f1', ['image']), P('v1', ['video']), P('v2', ['image', 'video']), P('f2', ['image']), P('v3', ['video'])];
  assert.deepEqual(buildReelsQueue(feed, 'v2').map((p) => p.id), ['v2', 'v1', 'v3']);
  assert.deepEqual(buildReelsQueue(feed).map((p) => p.id), ['v1', 'v2', 'v3'], 'başlıktaki giriş ilk videodan açar');
  assert.deepEqual(buildReelsQueue(feed, 'f1').map((p) => p.id), ['v1', 'v2', 'v3'], 'fotoğraf gönderisi başlangıç olamaz');
  assert.deepEqual(buildReelsQueue(feed, 'v9', [P('v9', ['video']), P('v1', ['video'])]).map((p) => p.id), ['v9', 'v1', 'v2', 'v3']);
  assert.deepEqual(buildReelsQueue([P('f', ['image'])]), [], 'video yok → boş hâl');
  assert.equal(isVideoPost(P('x', ['image'])), false);
});

test('sayfa eşiği 140 pt; yukarı = sonraki, aşağı = önceki; uçlarda sınırda kalır; hızlı fiske de çevirir', () => {
  assert.equal(REELS_THRESHOLD_PT, 140);
  assert.equal(reelsSnapIndex(0, 3, -150), 1);
  assert.equal(reelsSnapIndex(1, 3, -100), 1, 'eşik altı geri yaylanır');
  assert.equal(reelsSnapIndex(1, 3, 150), 0);
  assert.equal(reelsSnapIndex(0, 3, 300), 0, 'ilk sayfadan geri gidilmez');
  assert.equal(reelsSnapIndex(2, 3, -300), 2, 'son sayfadan ileri gidilmez');
  assert.equal(reelsSnapIndex(0, 3, -40, -1.2), 1);
  assert.equal(reelsAtEdge(0, 3, 20), true);
  assert.equal(reelsAtEdge(2, 3, -20), true);
  assert.equal(reelsAtEdge(1, 3, -20), false);
});

test('TEK OYNATICI: yalnız ekrandaki oynar, sonraki önceden yüklenir, diğerleri oynatıcısız (bellekten bırakılır)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => reelSlot(i, 2)), ['none', 'none', 'play', 'preload', 'none']);
  for (let active = 0; active < 10; active++) assert.ok(mountedPlayerCount(10, active) <= 2);
  assert.equal(mountedPlayerCount(10, 9), 1, 'son sayfada önceden yüklenecek yok');
  const base = { paused: false, holding: false, focused: true };
  assert.equal(reelShouldPlay('play', base), true);
  assert.equal(reelShouldPlay('preload', base), false, 'önceden yüklenen ÇALMAZ');
  assert.equal(reelShouldPlay('play', { ...base, paused: true }), false, 'dokun = duraklat');
  assert.equal(reelShouldPlay('play', { ...base, holding: true }), false, 'uzun bas = duraklat');
  assert.equal(reelShouldPlay('play', { ...base, focused: false }), false, 'arka planda durur');
});

test('sona yaklaşınca yeni sayfa istenir', () => {
  assert.equal(reelsShouldLoadMore(3, 5, true), true);
  assert.equal(reelsShouldLoadMore(1, 5, true), false);
  assert.equal(reelsShouldLoadMore(4, 5, false), false);
});

// ── Bayrak kapısı + tasarım istisnaları (statik) ──
import fs from 'node:fs';
import path from 'node:path';
const SRC = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');

test('kesfet_video kapalıyken hiçbir Reels girişi yok: başlık simgesi, video dokunuşu, rota', () => {
  const kesfet = read('modules/kesfet/ui/KesfetScreen.tsx');
  assert.match(kesfet, /onReels=\{kesfetVideo \? \(\) => navigation\.navigate\('KesfetReels'\) : undefined\}/);
  assert.match(kesfet, /kesfetVideo \? navigation\.navigate\('KesfetReels', \{ startId: item\.id \}\)/);
  const nav = read('navigation/AppNavigator.tsx');
  assert.match(nav, /\(kesfetVideoEnabled \|\| __DEV__\) && \(\s*<Stack\.Screen name="KesfetReels"/);
});

test('Reels: müzik satırı / dönen plak YOK; "Gönder" sistem paylaşım sayfası', () => {
  const reels = read('modules/kesfet/ui/ReelsScreen.tsx');
  assert.doesNotMatch(reels, /disc|music|track_name|artist/i);
  assert.match(reels, /Share\.share\(/);
});
