import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARA_BIRIMI, tl, tlFark, tlGruplu } from '../money';

// 24.09.2026: para birimi tutarın SONUNA alındı. Bu testler biçimin geri
// kaymasını (₺ başa dönmesi) ve sayı biçiminin bozulmasını engelliyor.

test('para birimi tutarın SONUNDA', () => {
  assert.equal(tl(585), '585.00 TL');
  assert.equal(tl(0), '0.00 TL');
  assert.doesNotMatch(tl(585), /₺/);
  assert.equal(PARA_BIRIMI, 'TL');
});

test('ondalık sayısı ayarlanabilir', () => {
  assert.equal(tl(585.5, 0), '586 TL');
  assert.equal(tl(585.456, 2), '585.46 TL');
});

test('geçersiz değer çökmez, 0 sayılır', () => {
  assert.equal(tl(Number.NaN), '0.00 TL');
  assert.equal(tl(undefined as unknown as number), '0.00 TL');
});

test('gruplu biçim binlik ayracı kullanır', () => {
  assert.equal(tlGruplu(1250), '1.250 TL');
  assert.equal(tlGruplu(500), '500 TL');
});

test('fark biçimi işaret taşır', () => {
  assert.equal(tlFark(120), '+120 TL');
  assert.equal(tlFark(-120), '-120 TL');
  assert.equal(tlFark(0), '0 TL');
});

test('formatPrice — Final biçimi (G18): tam sayı ondalıksız, kuruş virgülle, ayraç yok', async () => {
  const { formatPrice, formatPriceDelta } = await import('../money');
  assert.equal(formatPrice(285), '285 TL');
  assert.equal(formatPrice(285.5), '285,50 TL');
  assert.equal(formatPrice(1250), '1250 TL');
  assert.equal(formatPrice(0), '0 TL');
  assert.equal(formatPrice(Number.NaN), '0 TL');
  assert.equal(formatPrice(12.999), '13 TL');
  assert.doesNotMatch(formatPrice(12345.5), /[₺.]/);
  assert.equal(formatPriceDelta(150), '+150 TL');
  assert.equal(formatPriceDelta(-20), '-20 TL');
  assert.equal(formatPriceDelta(12.5), '+12,50 TL');
});

test('reformatLegacyTl — mantık metnindeki eski tutarlar Final biçimine', async () => {
  const { reformatLegacyTl } = await import('../money');
  assert.equal(reformatLegacyTl('Minimum sepet: 300.00 TL — Kalan: 50.50 TL'), 'Minimum sepet: 300 TL — Kalan: 50,50 TL');
  assert.equal(reformatLegacyTl('Eşik 1.250 TL'), 'Eşik 1.250 TL');
  assert.equal(reformatLegacyTl('Bu bölgeye teslimat yok'), 'Bu bölgeye teslimat yok');
  assert.equal(reformatLegacyTl('Bu kupon 299.9 TL ve üzeri'), 'Bu kupon 299,90 TL ve üzeri');
  assert.equal(reformatLegacyTl('Bu kupon 300 TL ve üzeri'), 'Bu kupon 300 TL ve üzeri');
});
