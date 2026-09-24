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
