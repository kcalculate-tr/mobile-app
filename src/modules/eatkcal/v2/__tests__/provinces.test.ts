import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IZMIR, PROVINCES_TR, filterProvinces, gateTarget, orderedProvinces } from '../model/provinces';

test('81 il, tekrar yok, İzmir başta', () => {
  assert.equal(PROVINCES_TR.length, 81);
  assert.equal(new Set(PROVINCES_TR).size, 81);
  const o = orderedProvinces();
  assert.equal(o[0], IZMIR);
  assert.equal(o.length, 81);
  assert.equal(o[1], 'Adana');
});

test('Türkçe arama (İ/ı)', () => {
  const o = orderedProvinces();
  assert.deepEqual(filterProvinces(o, 'izm'), ['İzmir']);
  assert.ok(filterProvinces(o, 'IĞDIR').includes('Iğdır'));
  assert.ok(filterProvinces(o, 'istan').includes('İstanbul'));
  assert.equal(filterProvinces(o, 'zzz').length, 0);
  assert.equal(filterProvinces(o, '  ').length, 81);
});

test('hedef: İzmir sipariş, diğerleri bekleme listesi, seçimsiz pasif', () => {
  assert.equal(gateTarget('TR', null), null);
  assert.equal(gateTarget('TR', 'İzmir'), 'order');
  assert.equal(gateTarget('TR', 'Ankara'), 'waitlist');
  assert.equal(gateTarget('OTHER', null), 'waitlist');
});
