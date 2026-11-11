// G34-S1 — biçimlendirme: TR ondalık virgül, nokta ayracı yok, ay adları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtDate, fmtKg, fmtNum, fmtPace, fmtRange, fmtShort, fmtSigned, weekdayIndex } from '../format';

test('sayılar: TR virgül, binlik ayraç yok', () => {
  assert.equal(fmtNum(1440, 'tr'), '1440');
  assert.equal(fmtNum(12000, 'tr'), '12000');
  assert.equal(fmtKg(71.5, 'tr'), '71,5');
  assert.equal(fmtKg(71.5, 'en'), '71.5');
  assert.equal(fmtKg(72, 'tr'), '72');
  assert.equal(fmtPace(0.25, 'tr'), '0,25');
  assert.equal(fmtPace(0.5, 'tr'), '0,5');
  assert.equal(fmtSigned(-0.3, 'tr'), '−0,3');
  assert.equal(fmtSigned(0.3, 'en'), '+0.3');
});

test('tarihler', () => {
  assert.equal(fmtDate('2027-02-18', 'tr'), '18 Şubat 2027');
  assert.equal(fmtDate('2027-02-18', 'en'), '18 February 2027');
  assert.equal(fmtShort('2026-11-12', 'tr'), '12 Kas');
  assert.equal(fmtRange('2026-11-12', '2026-11-18', 'tr'), '12–18 Kasım');
  assert.equal(fmtRange('2026-10-28', '2026-11-03', 'en'), '28 Oct – 3 Nov');
  assert.equal(weekdayIndex('2026-11-12'), 3); // Perşembe
  assert.equal(fmtDate(null, 'tr'), '–');
});
