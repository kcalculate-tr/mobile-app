// G17-S2 md.5 — seçili sekme: yarı saydam gri hap (Instagram gibi), ikon/etiket
// normal mürekkep; G17-S1'deki opak siyah hap + beyaz ikon geri alındı.
import test from 'node:test';
import assert from 'node:assert/strict';

import { SELECTED_PILL, SELECTED_PILL_MS } from '../selectedPill';

function alpha(rgba: string): number {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba);
  assert.ok(m, `rgba bekleniyordu: ${rgba}`);
  return Number(m[4]);
}

test('açık tema: rgba(10,10,10,0.08) hap, ikon mürekkep #0A0A0A', () => {
  assert.equal(SELECTED_PILL.light.bubble, 'rgba(10,10,10,0.08)');
  assert.equal(SELECTED_PILL.light.activeInk, '#0A0A0A');
});

test('koyu tema: rgba(255,255,255,0.14) hap, ikon mürekkep #F5F5F5', () => {
  assert.equal(SELECTED_PILL.dark.bubble, 'rgba(255,255,255,0.14)');
  assert.equal(SELECTED_PILL.dark.activeInk, '#F5F5F5');
});

test('hap yarı saydam (opak siyah/beyaz değil), beyaz ikon yok (açık tema)', () => {
  for (const k of ['light', 'dark'] as const) {
    const a = alpha(SELECTED_PILL[k].bubble);
    assert.ok(a > 0 && a < 0.2, `${k}: alfa ${a}`);
  }
  assert.notEqual(SELECTED_PILL.light.activeInk.toUpperCase(), '#FFFFFF');
  assert.notEqual(SELECTED_PILL.dark.activeInk.toUpperCase(), '#1C1C1E');
});

test('geçiş 200 ms', () => {
  assert.equal(SELECTED_PILL_MS, 200);
});
