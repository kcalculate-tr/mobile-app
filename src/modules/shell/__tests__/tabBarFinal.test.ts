// G18-S4 md.6 — FinTabBar-rest/mid/min ölçüleri birebir (seçili hap rengi hariç:
// G17-S2 gri hap istisnası, ORTAK #4).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TAB_BAR_R3 } from '../layout';

test('FinTabBar-rest: 393 genişlikte hap 289 × 62, r 31; Tara 62; kenarlar 16; hap–Tara 10', () => {
  const pillW = 393 - 2 * TAB_BAR_R3.SIDE_INSET - TAB_BAR_R3.SCAN_GAP - TAB_BAR_R3.SCAN_SIZE;
  assert.equal(pillW, 289);
  assert.equal(TAB_BAR_R3.PILL_HEIGHT, 62);
  assert.equal(TAB_BAR_R3.PILL_RADIUS, 31);
  assert.equal(TAB_BAR_R3.BUBBLE_PAD, 4);
  assert.equal(TAB_BAR_R3.BUBBLE_RADIUS, 26);
  // sekme genişliği 281/4
  assert.equal((pillW - 2 * TAB_BAR_R3.BUBBLE_PAD) / 4, 281 / 4);
  assert.equal(TAB_BAR_R3.ICON_SIZE, 24);
  assert.equal(TAB_BAR_R3.LABEL_SIZE, 13);
});

test('FinTabBar-min: hap 52 daire + iç 44 / ikon 22; Tara 52, ikon 18', () => {
  assert.equal(TAB_BAR_R3.MINI_SIZE, 52);
  assert.equal(TAB_BAR_R3.MINI_INNER, 44);
  assert.equal(TAB_BAR_R3.MINI_ICON, 22);
  assert.equal(TAB_BAR_R3.SCAN_SIZE_MINI, 52);
  assert.equal(TAB_BAR_R3.SCAN_ICON, 22);
  assert.equal(TAB_BAR_R3.SCAN_ICON_MINI, 18);
});

test('TabBarR3: pasif sekme ikincil renk; rozet pano renkleri; seçili hap gri (istisna)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../TabBarR3.tsx'), 'utf8');
  assert.match(src, /sec: '#6B6B70'/);
  assert.match(src, /sec: '#A1A1A6'/);
  assert.match(src, /dotBg: '#4A6B00'/);
  assert.match(src, /dotBg: palette\.lime/); // G40-S1: tek marka yeşili token'dan
  assert.match(src, /isActive \? g\.activeInk : g\.sec/);
  assert.doesNotMatch(src, /#1C1C1E/, 'Final siyah hap UYGULANMAZ');
  assert.doesNotMatch(src, /\$\{label\} · /, 'nokta ayraçsız erişilebilirlik etiketi');
});
