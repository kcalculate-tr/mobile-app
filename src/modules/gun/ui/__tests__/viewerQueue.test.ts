import test from 'node:test';
import assert from 'node:assert/strict';

import { buildViewerQueue } from '../viewerQueue';
import type { DayRing } from '../../types';

function ring(id: string): DayRing {
  return { user: { id, display_name: id, avatar_url: null }, progress: 0.5, streak: 0, has_new: false };
}

test('buildViewerQueue: seçilenden başlar, sonrakilere ilerler, geri sarmaz', () => {
  const rings = [ring('me'), ring('a'), ring('b'), ring('c')];
  assert.deepEqual(buildViewerQueue(rings, 'b'), ['b', 'c']);
});

test('buildViewerQueue: ilk halka (ben) seçilince tüm sıra döner', () => {
  const rings = [ring('me'), ring('a'), ring('b')];
  assert.deepEqual(buildViewerQueue(rings, 'me'), ['me', 'a', 'b']);
});

test('buildViewerQueue: bilinmeyen id baştan başlar (düşmez)', () => {
  const rings = [ring('me'), ring('a')];
  assert.deepEqual(buildViewerQueue(rings, 'yok'), ['me', 'a']);
});
