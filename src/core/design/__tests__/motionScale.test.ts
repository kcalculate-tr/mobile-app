// G22-S2 md.1 — "hareket +%10 (DAHA FAZLA DEĞİL)" denetimi.
//
// motion.tsx RN/Reanimated çeker; node:test ortamında değerleri kaynaktan okuruz.
// Kural: FinMoTokens bantları ×1,1 (100/200/300/500/900 → 110/220/330/550/990),
// yaylar stiffness ×0,9 + damping ×√0,9 (sönüm oranı ζ korunur → taşma artmaz),
// eğriler FinMoTokens'taki gibi aynen, azaltılmış hareket 200 ms opaklık.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../motion.tsx'), 'utf8');

function block(start: string, end: string): string {
  return SRC.slice(SRC.indexOf(start), SRC.indexOf(end));
}

test('süre bantları FinMoTokens ×1,1 (fazlası değil)', () => {
  const dur = block('export const DURATION', 'export const TIMING');
  const base: Record<string, number> = { instant: 100, fast: 200, base: 300, slow: 500, story: 900 };
  for (const [k, v] of Object.entries(base)) {
    const m = new RegExp(`\\b${k}:\\s*(\\d+),`).exec(dur);
    assert.ok(m, k);
    assert.equal(Number(m![1]), Math.round(v * 1.1), `${k}`);
  }
});

test('sayfa push 300 → 330 (PREMIUM.push ve SCREEN.push DURATION.base okur)', () => {
  assert.match(block('export const PREMIUM', 'export function listEnterDelay'), /push:\s*\{\s*enter:\s*DURATION\.base/);
  assert.match(block('export const SCREEN', 'export const RN_CURVE'), /push:\s*\{\s*duration:\s*DURATION\.base/);
});

test('yaylar ~%10 yumuşak: stiffness ×0,9, sönüm oranı korunur (taşma artmaz)', () => {
  assert.match(SRC, /export const MOTION_SOFTEN = \{ stiffness: 0\.9 \}/);
  const spring = block('export const SPRING', 'export const STAGGER');
  const pairs = [...spring.matchAll(/softSpring\((\d+),\s*(\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  // ai 260/24 · eat 200/28 · bouncy 220/14 · sheet(=ai) 260/24 — FinMoTokens özgün değerleri.
  assert.deepEqual(pairs, [[260, 24], [200, 28], [220, 14], [260, 24]]);
  for (const [k, c] of pairs) {
    const k2 = Math.round(k * 0.9 * 100) / 100;
    const c2 = Math.round(c * Math.sqrt(0.9) * 100) / 100;
    const zeta = c / (2 * Math.sqrt(k));
    const zeta2 = c2 / (2 * Math.sqrt(k2));
    assert.ok(Math.abs(zeta - zeta2) < 0.002, `ζ ${zeta} → ${zeta2}`);
    assert.ok(k2 < k && Math.abs(k2 / k - 0.9) < 0.001);
  }
});

test('eğriler FinMoTokens ile aynen', () => {
  const curve = block('export const CURVE', 'export const MOTION_SOFTEN');
  assert.match(curve, /standard:\s*Easing\.bezier\(0\.2, 0, 0, 1\)/);
  assert.match(curve, /enter:\s*Easing\.bezier\(0\.05, 0\.7, 0\.1, 1\)/);
  assert.match(curve, /exit:\s*Easing\.bezier\(0\.3, 0, 0\.8, 0\.15\)/);
});

test('azaltılmış hareket 200 ms opaklık (Reduce Motion — ölçeklenmez)', () => {
  assert.match(block('export const REDUCED', 'FinMoMap — UYGULAMA'), /duration:\s*200,/);
});

test('bekleme (WAIT) token’ları hareket süresine bağlı', () => {
  const wait = block('export const WAIT', 'export const REDUCED');
  assert.match(wait, /focusAfterMotion:\s*DURATION\.base/);
  assert.match(wait, /firstPaint:\s*DURATION\.story/);
  assert.match(wait, /trailClear:\s*1320/);
});
