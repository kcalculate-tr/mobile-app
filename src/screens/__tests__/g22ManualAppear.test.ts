// G22-S1 md.2 (İlter 10 Kas) — "Elle gir" katmanı: aşağıdan KAYMA YOK, BELİRME.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { MANUAL_SCALE_FROM, MANUAL_SCRIM_OPACITY, manualAppearSpec } from '../tracker/manualAppear';

const TK = { base: 300, fast: 200, reduced: 200 };

test('açılış: zemin 0→0,4, katman 0→1, ölçek 0,96→1, base 300 enter; kayma yok', () => {
  const s = manualAppearSpec(true, false, TK);
  assert.deepEqual(s, {
    duration: 300,
    curve: 'enter',
    scrim: { from: 0, to: 0.4 },
    opacity: { from: 0, to: 1 },
    scale: { from: 0.96, to: 1 },
    translateY: 0,
  });
  assert.equal(MANUAL_SCRIM_OPACITY, 0.4);
  assert.equal(MANUAL_SCALE_FROM, 0.96);
});

test('kapanış tersi: fast 200 exit', () => {
  const s = manualAppearSpec(false, false, TK);
  assert.deepEqual([s.duration, s.curve, s.scrim, s.opacity, s.scale], [200, 'exit', { from: 0.4, to: 0 }, { from: 1, to: 0 }, { from: 1, to: 0.96 }]);
});

test('azaltılmış hareket: yalnız opaklık (ölçek yok), 200 ms', () => {
  for (const open of [true, false]) {
    const s = manualAppearSpec(open, true, TK);
    assert.equal(s.scale, null);
    assert.equal(s.duration, 200);
    assert.equal(s.translateY, 0);
  }
});

test('HomeManualMealSheet: Modal kendi kayma animasyonunu kullanmaz (animationType none)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../tracker/HomeManualMealSheet.tsx'), 'utf8');
  assert.match(src, /animationType="none"/);
  assert.doesNotMatch(src, /animationType="slide"/);
  assert.match(src, /useManualAppear\(visible\)/);
});
