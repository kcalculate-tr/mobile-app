// G28-S1 md.2 — öğün fotoğrafı imzalı URL önbelleği (saf çekirdek).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MEAL_PHOTO_BUCKET,
  MEAL_PHOTO_TTL_S,
  __resetMealPhotoCache,
  hasMealPhotoFailed,
  peekMealPhoto,
  rememberLocalMealPhoto,
  resolveMealPhoto,
  type SignerClient,
} from '../mealPhoto';
import { buildSlots } from '../homeData';

function signer(calls: string[], fail = false): SignerClient {
  return {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, MEAL_PHOTO_BUCKET);
        return {
          async createSignedUrl(path: string, ttl: number) {
            calls.push(path);
            assert.equal(ttl, MEAL_PHOTO_TTL_S);
            return fail ? { data: null, error: { message: 'not found' } } : { data: { signedUrl: `https://s/${path}?t=1` }, error: null };
          },
        };
      },
    },
  };
}

test('aynı yol için tek istek; eşzamanlı istekler birleşir; süre dolana dek önbellekten', async () => {
  __resetMealPhotoCache();
  const calls: string[] = [];
  const c = signer(calls);
  const [a, b] = await Promise.all([resolveMealPhoto(c, 'u1/scans/k.jpg', 0), resolveMealPhoto(c, 'u1/scans/k.jpg', 0)]);
  assert.equal(a, 'https://s/u1/scans/k.jpg?t=1');
  assert.equal(b, a);
  assert.equal(await resolveMealPhoto(c, 'u1/scans/k.jpg', 1000), a);
  assert.deepEqual(calls, ['u1/scans/k.jpg']);
  assert.equal(peekMealPhoto('u1/scans/k.jpg', 1000), a);
  // süre dolmaya 5 dk kala yenilenir
  assert.equal(peekMealPhoto('u1/scans/k.jpg', MEAL_PHOTO_TTL_S * 1000), null);
});

test('yerel foto (sonuç → liste aynı kare) imzalı URL\'den önce gelir, istek atılmaz', async () => {
  __resetMealPhotoCache();
  const calls: string[] = [];
  rememberLocalMealPhoto('u1/scans/x.jpg', 'file:///scan-x.jpg');
  assert.equal(peekMealPhoto('u1/scans/x.jpg'), 'file:///scan-x.jpg');
  assert.equal(await resolveMealPhoto(signer(calls), 'u1/scans/x.jpg'), 'file:///scan-x.jpg');
  assert.deepEqual(calls, []);
});

test('bulunamayan yol bir daha istenmez (satır kase nesnesine düşer); yol yoksa null', async () => {
  __resetMealPhotoCache();
  const calls: string[] = [];
  assert.equal(await resolveMealPhoto(signer(calls, true), 'u1/scans/gone.jpg'), null);
  assert.equal(hasMealPhotoFailed('u1/scans/gone.jpg'), true);
  assert.equal(await resolveMealPhoto(signer(calls, true), 'u1/scans/gone.jpg'), null);
  assert.equal(calls.length, 1);
  assert.equal(await resolveMealPhoto(signer(calls), null), null);
});

test('buildSlots: photo_path satıra photoPath olarak geçer', () => {
  const [, lunch] = buildSlots([
    { id: 'r', source: 'ai_scan', name: 'Kahve', meal_type: 'ogle', calories: 8, protein: 1, carbs: 1, fat: 0, consumed_at: '2026-11-11T09:00:00Z', photo_path: 'u1/scans/k.jpg' },
  ]);
  assert.equal(lunch.items[0].photoPath, 'u1/scans/k.jpg');
});

test('statik md.3: öğün satırı tipografisi FinHomeR3 (ad 15/500 tek satır, kcal 15/500)', () => {
  const src = readFileSync(join(__dirname, '../../../screens/tracker/HomeMealSlots.tsx'), 'utf8');
  assert.match(src, /itemName: \{ fontSize: 15, lineHeight: 21, fontWeight: '500' \}/);
  assert.match(src, /itemKcal: \{ fontSize: 15, lineHeight: 21, fontWeight: '500', flexShrink: 0 \}/);
  assert.match(src, /<AppText numberOfLines=\{1\} style=\{styles\.itemName\}>/);
});
