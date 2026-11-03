import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDigits, isSilentEvening } from '../motion';

test('groupDigits: TR binlik ayıracı nokta', () => {
  assert.equal(groupDigits(1840, 'tr'), '1.840');
  assert.equal(groupDigits(2150, 'tr'), '2.150');
  assert.equal(groupDigits(1234567, 'tr'), '1.234.567');
});

test('groupDigits: EN binlik ayıracı virgül', () => {
  assert.equal(groupDigits(1840, 'en'), '1,840');
  assert.equal(groupDigits(1234567, 'en'), '1,234,567');
});

test('groupDigits: üç haneden kısa ayıraçsız', () => {
  assert.equal(groupDigits(0, 'tr'), '0');
  assert.equal(groupDigits(7, 'tr'), '7');
  assert.equal(groupDigits(999, 'en'), '999');
});

test('groupDigits: negatif işaret korunur, ondalık atılır', () => {
  assert.equal(groupDigits(-1840, 'tr'), '-1.840');
  assert.equal(groupDigits(1840.9, 'tr'), '1.840');
});

test('groupDigits: güvenli — NaN/Infinity → 0', () => {
  assert.equal(groupDigits(Number.NaN, 'tr'), '0');
  assert.equal(groupDigits(Number.POSITIVE_INFINITY, 'en'), '0');
});

test('isSilentEvening: boş halka + akşam → sessiz an', () => {
  assert.equal(isSilentEvening(0, 20), true);
  assert.equal(isSilentEvening(0, 18), true);
});

test('isSilentEvening: gündüz ya da dolu halka → an yok', () => {
  assert.equal(isSilentEvening(0, 10), false);
  assert.equal(isSilentEvening(0.4, 21), false);
});
