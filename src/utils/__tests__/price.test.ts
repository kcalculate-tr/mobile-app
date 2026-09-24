import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDiscountCorner } from '../price';

// 24.09.2026: indirim, fiyat satırındaki küçük kırmızı metinden (-%10) ürün
// görselinin sağ üst köşesindeki rozete taşındı.

test('yüzde indirimde işaret YOK — rozet zaten indirim olduğunu söylüyor', () => {
  assert.equal(formatDiscountCorner('percent', 10), '%10');
  assert.equal(formatDiscountCorner('percent', 50), '%50');
});

test('tutar indiriminde eksi VAR — işaretsiz sayı fiyatla karışır', () => {
  assert.equal(formatDiscountCorner('fixed', 50), '-50 TL');
});

test('indirim yoksa/geçersizse rozet HİÇ çizilmez', () => {
  assert.equal(formatDiscountCorner('percent', 0), null);
  assert.equal(formatDiscountCorner('percent', -5), null);
  assert.equal(formatDiscountCorner('percent', null), null);
  assert.equal(formatDiscountCorner(null, 10), null);
  assert.equal(formatDiscountCorner(undefined, 10), null);
  assert.equal(formatDiscountCorner('bilinmeyen_tip', 10), null);
  assert.equal(formatDiscountCorner('percent', Number.NaN), null);
});
