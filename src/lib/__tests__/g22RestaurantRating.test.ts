// G22-S1 md.6 — restoran puanı (son 3 ay): eşleme, yarım yıldız, "Yeni" eşiği, önbellek, RPC yok.
import test from 'node:test';
import assert from 'node:assert/strict';

import { clearRestaurantRatingCache, fetchRestaurantRating, formatRating, mapRatingRow, roundHalfStar } from '../restaurantRating';
import { translations } from '../../core/i18n/dictionaries';

test('yarım yıldız yuvarlama (istemcide)', () => {
  assert.equal(roundHalfStar(4.24), 4);
  assert.equal(roundHalfStar(4.25), 4.5);
  assert.equal(roundHalfStar(4.74), 4.5);
  assert.equal(roundHalfStar(4.75), 5);
  assert.equal(roundHalfStar(7), 5);
  assert.equal(roundHalfStar(null), 0);
  assert.equal(formatRating(4.3, 'tr'), '4,5');
  assert.equal(formatRating(4.3, 'en'), '4.5');
  assert.equal(formatRating(4.9, 'tr'), '5');
});

test('RPC satırı → model; <10 değerlendirme Yeni; alt boyutlar null', () => {
  const r = mapRatingRow([{ branch_id: null, average: '4.80', review_count: 23, is_new: false, taste: null, delivery: null, calorie_fit: null }]);
  assert.deepEqual(r, { average: 4.8, count: 23, isNew: false, taste: null, delivery: null, calorieFit: null });
  const n = mapRatingRow({ average: 5, review_count: 3, is_new: true });
  assert.equal(n?.isNew, true);
  const zero = mapRatingRow({ average: null, review_count: 0 });
  assert.deepEqual([zero?.average, zero?.isNew], [null, true]);
  assert.equal(mapRatingRow([]), null);
});

test('fetch: 10 dk önbellek; RPC yok/hata → null (satır çizilmez)', async () => {
  clearRestaurantRatingCache();
  let calls = 0;
  const rpc = async () => {
    calls++;
    return { data: [{ average: 4.5, review_count: 12, is_new: false }], error: null };
  };
  const a = await fetchRestaurantRating(null, rpc, 0);
  const b = await fetchRestaurantRating(null, rpc, 60_000);
  assert.equal(calls, 1);
  assert.equal(a?.count, 12);
  assert.equal(b?.average, 4.5);
  await fetchRestaurantRating(null, rpc, 11 * 60_000);
  assert.equal(calls, 2);
  clearRestaurantRatingCache();
  assert.equal(await fetchRestaurantRating('b1', async () => ({ data: null, error: { message: 'missing' } })), null);
  clearRestaurantRatingCache();
  assert.equal(await fetchRestaurantRating('b2', async () => {
    throw new Error('net');
  }), null);
});

test('metinler TR+EN: "son 3 ay · N değerlendirme" ve "Yeni"', () => {
  const tr = (translations.tr as any).eatkcal.v2.reviews;
  const en = (translations.en as any).eatkcal.v2.reviews;
  assert.equal(tr.last3m.replace('%{n}', '23'), 'son 3 ay, 23 değerlendirme');
  assert.equal(tr.is_new, 'Yeni');
  assert.equal(en.last3m.replace('%{n}', '23'), 'last 3 months, 23 reviews');
  assert.equal(en.is_new, 'New');
});
