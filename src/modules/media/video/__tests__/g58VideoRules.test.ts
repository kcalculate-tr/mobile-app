// G58-S1 md.3 — `kesfet_video` kuralları: süre/boyut (60 sn / 50 MB) zorunlu, boyut okunamazsa ret,
// desteklenmeyen tür ret, hata → doğru metin, süre etiketi, ızgara (video düşmez), composer kotası,
// akış oynatma kapısı (odak / tam ekran), oynatıcı yalnız görünürde, bayrak görünürlüğü.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ALLOWED_VIDEO_MIME,
  VideoUnsupportedError,
  assertVideoDuration,
  assertVideoMime,
  assertVideoSize,
  assertVideoSizeKnown,
  composerMediaCaps,
  feedPlayablePostId,
  formatVideoDuration,
  gridMedia,
  shouldMountPlayer,
  videoMimeOf,
  videoPickErrorKey,
} from '../rules';
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S, VideoTooLargeError, VideoTooLongError } from '../types';

const ROOT = path.resolve(__dirname, '../../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('sınırlar: 60 sn / 50 MB (mevcut değerler korunur)', () => {
  assert.equal(MAX_VIDEO_DURATION_S, 60);
  assert.equal(MAX_VIDEO_BYTES, 50 * 1024 * 1024);
  assert.doesNotThrow(() => assertVideoDuration(60_000));
  assert.throws(() => assertVideoDuration(60_001), VideoTooLongError);
  assert.doesNotThrow(() => assertVideoSize(MAX_VIDEO_BYTES));
  assert.throws(() => assertVideoSize(MAX_VIDEO_BYTES + 1), VideoTooLargeError);
});

test('boyut okunamadıysa (0) ret — 50 MB kontrolü atlanamaz', () => {
  assert.throws(() => assertVideoSizeKnown(0), VideoUnsupportedError);
  assert.throws(() => assertVideoSizeKnown(NaN), VideoUnsupportedError);
  assert.doesNotThrow(() => assertVideoSizeKnown(1024));
});

test('tür: mp4 / mov kabul; 3gpp / webm ret; bilinmiyorsa uzantıdan', () => {
  assert.deepEqual([...ALLOWED_VIDEO_MIME], ['video/mp4', 'video/quicktime']);
  assert.doesNotThrow(() => assertVideoMime('video/mp4', 'file:///a'));
  assert.doesNotThrow(() => assertVideoMime(null, 'file:///a/b.MOV'));
  assert.throws(() => assertVideoMime('video/3gpp', 'file:///a.3gp'), VideoUnsupportedError);
  assert.throws(() => assertVideoMime('video/webm', 'file:///a.webm'), VideoUnsupportedError);
  assert.equal(videoMimeOf(null, 'file:///x/y.m4v?z=1'), 'video/mp4');
  assert.equal(videoMimeOf(undefined, 'content://media/42'), null);
  assert.doesNotThrow(() => assertVideoMime(null, 'content://media/42')); // depo varsayılanı mp4
});

test('seçim hatası → doğru metin (eskiden hepsi "çok uzun")', () => {
  assert.equal(videoPickErrorKey(new VideoTooLongError(70_000)), 'video_too_long');
  assert.equal(videoPickErrorKey(new VideoTooLargeError(60 * 1024 * 1024)), 'video_too_large');
  assert.equal(videoPickErrorKey(new VideoUnsupportedError('video/webm')), 'video_unsupported');
  assert.equal(videoPickErrorKey(new Error('picker crashed')), 'video_failed');
});

test('süre etiketi: 60 sn → 1:00 (eskiden 0:60)', () => {
  assert.equal(formatVideoDuration(60_000), '1:00');
  assert.equal(formatVideoDuration(42_400), '0:42');
  assert.equal(formatVideoDuration(5_000), '0:05');
});

test('ızgara: video varsa ilk hücre; 4 foto + video gönderisinde video düşmez', () => {
  const m = [{ kind: 'image', id: 1 }, { kind: 'image', id: 2 }, { kind: 'image', id: 3 }, { kind: 'image', id: 4 }, { kind: 'video', id: 5 }];
  assert.deepEqual(gridMedia(m).map((x) => x.id), [5, 1, 2, 3]);
  assert.deepEqual(gridMedia(m.slice(0, 4)).map((x) => x.id), [1, 2, 3, 4]);
  assert.deepEqual(gridMedia([{ kind: 'video', id: 9 }]).map((x) => x.id), [9]);
});

test('composer kotası: video 1 hücre, toplam ≤ 4', () => {
  assert.deepEqual(composerMediaCaps(0, false), { photoSlots: 4, canAddVideo: true, used: 0 });
  assert.deepEqual(composerMediaCaps(3, true), { photoSlots: 0, canAddVideo: false, used: 4 });
  assert.deepEqual(composerMediaCaps(4, false), { photoSlots: 0, canAddVideo: false, used: 4 });
  assert.deepEqual(composerMediaCaps(2, true), { photoSlots: 1, canAddVideo: false, used: 3 });
});

test('akış oynatma kapısı: ekran arkadaysa ya da tam ekran açıksa hiçbir hücre oynamaz', () => {
  assert.equal(feedPlayablePostId('p1', true, null), 'p1');
  assert.equal(feedPlayablePostId('p1', false, null), null);
  assert.equal(feedPlayablePostId('p1', true, 'p1'), null);
  assert.equal(feedPlayablePostId(null, true, null), null);
  assert.equal(shouldMountPlayer(true), true);
  assert.equal(shouldMountPlayer(false), false);
});

test('bayrak kapısı: composer video düğmesi + kılavuz satırı + akış oynatıcısı yalnız kesfet_video açıkken', () => {
  const c = read('src/modules/kesfet/ui/ComposerScreen.tsx');
  assert.match(c, /const videoEnabled = useFeature\('kesfet_video'\)/);
  assert.match(c, /\{videoEnabled \? \(\s*<Pressable\s+onPress=\{\(\) => void addVideo\(\)\}/);
  assert.match(c, /showVideo=\{videoEnabled\}/);
  const g = read('src/modules/kesfet/ui/MediaGrid.tsx');
  assert.match(g, /if \(media\.kind === 'video' && kesfetVideo\)/);
  const reg = read('src/core/flags/registry.ts');
  assert.match(reg, /kesfet_video: false/);
  const k = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  assert.match(k, /isVisible=\{item\.id === playablePostId\}/);
});

test('seçici: iOS 720p dışa aktarım, süre/boyut/tür doğrulaması; yeni paket yok', () => {
  const p = read('src/modules/media/video/pickVideo.ts');
  assert.match(p, /videoMaxDuration: 60/);
  assert.match(p, /videoExportPreset: ImagePicker\.VideoExportPreset\.H264_1280x720/);
  assert.match(p, /assertVideoMime\(/);
  assert.match(p, /assertVideoSizeKnown\(/);
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  assert.ok(!Object.keys(pkg.dependencies).some((d) => /ffmpeg|compressor|video-compress/i.test(d)));
});
