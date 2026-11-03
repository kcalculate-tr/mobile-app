// Video modülü SAF kural testleri (tsx --test). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { assertVideoDuration, assertVideoSize, frameTimestampsMs, storagePathFor } from '../rules';
import { VideoTooLargeError, VideoTooLongError, MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S } from '../types';

test('assertVideoDuration: 60 sn sınırında geçer, üstünde VideoTooLongError', () => {
  assert.doesNotThrow(() => assertVideoDuration(MAX_VIDEO_DURATION_S * 1000));
  assert.throws(() => assertVideoDuration(MAX_VIDEO_DURATION_S * 1000 + 1), VideoTooLongError);
});

test('assertVideoSize: 50 MB sınırında geçer, üstünde VideoTooLargeError', () => {
  assert.doesNotThrow(() => assertVideoSize(MAX_VIDEO_BYTES));
  assert.throws(() => assertVideoSize(MAX_VIDEO_BYTES + 1), VideoTooLargeError);
});

test('frameTimestampsMs: başı < ortası < sonu, hepsi video süresi içinde', () => {
  const durationMs = 20000;
  const [start, middle, end] = frameTimestampsMs(durationMs);
  assert.ok(start >= 0 && start < middle);
  assert.ok(middle < end);
  assert.ok(end < durationMs);
});

test('frameTimestampsMs: çok kısa videoda (500ms) hiçbir zaman damgası süreyi aşmaz', () => {
  const durationMs = 500;
  const [start, middle, end] = frameTimestampsMs(durationMs);
  for (const t of [start, middle, end]) {
    assert.ok(t >= 0 && t < durationMs, `${t} 0..${durationMs} aralığında olmalı`);
  }
});

test('storagePathFor: posts/{uid}/{mediaId}/{fileName} biçimi', () => {
  assert.equal(storagePathFor('user-1', 'media-9', 'video.mp4'), 'posts/user-1/media-9/video.mp4');
});
