// G21-S1 md.9 — bölüm sekmesi kayma hesabı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_SHIFT_RATIO, indicatorFrame, sectionEnterOffset } from '../sectionSlideMath';

test('sectionEnterOffset: sağdaki sekmeye → sağdan (+), soldakine → soldan (−), aynı → 0', () => {
  assert.equal(sectionEnterOffset(0, 1, 400), 400 * SECTION_SHIFT_RATIO);
  assert.equal(sectionEnterOffset(1, 0, 400), -400 * SECTION_SHIFT_RATIO);
  assert.equal(sectionEnterOffset(1, 1, 400), 0);
  // ölçülmemiş kap → kayma yok (yalnız opaklık)
  assert.equal(sectionEnterOffset(0, 1, 0), 0);
});

test('indicatorFrame: hap (FinSegmented) iç boşluk + aralıkla sütunu doldurur', () => {
  // 361 genişlik, padding 4, gap 4, 2 sütun → sütun (361-8-4)/2 = 174.5
  assert.deepEqual(indicatorFrame(0, 2, 361, { inset: 4, gap: 4 }), { x: 4, width: 174.5 });
  assert.deepEqual(indicatorFrame(1, 2, 361, { inset: 4, gap: 4 }), { x: 4 + 174.5 + 4, width: 174.5 });
});

test('indicatorFrame: alt çizgi (56) sütunun ortasında; sınır dışı indeks kırpılır', () => {
  assert.deepEqual(indicatorFrame(0, 2, 400, { itemWidth: 56 }), { x: 72, width: 56 });
  assert.deepEqual(indicatorFrame(1, 2, 400, { itemWidth: 56 }), { x: 272, width: 56 });
  assert.deepEqual(indicatorFrame(5, 2, 400, { itemWidth: 56 }), { x: 272, width: 56 });
  assert.deepEqual(indicatorFrame(0, 2, 0, { itemWidth: 56 }), { x: 0, width: 0 });
});
