// G13-S1 m.2 — gerçek ilk-öğün + gün serisi sinyali (SAF).
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeStreak, isFirstMeal } from '../signals';
import { pickCelebration } from '../useCelebrations';

const d = (date: string, kcal: number) => ({ date, kcal });

test('computeStreak: bugün dahil kesintisiz günler', () => {
  const days = [d('2026-11-04', 300), d('2026-11-05', 500), d('2026-11-06', 200)];
  assert.equal(computeStreak(days, '2026-11-06'), 3);
});

test('computeStreak: bugün kayıt yoksa 0', () => {
  assert.equal(computeStreak([d('2026-11-05', 500), d('2026-11-06', 0)], '2026-11-06'), 0);
});

test('computeStreak: boşlukta kırılır', () => {
  const days = [d('2026-11-01', 1), d('2026-11-02', 1), d('2026-11-04', 1), d('2026-11-05', 1), d('2026-11-06', 1)];
  assert.equal(computeStreak(days, '2026-11-06'), 3);
});

test('computeStreak: ay sınırını aşar (7 gün)', () => {
  const days = ['10-27', '10-28', '10-29', '10-30', '10-31', '11-01', '11-02'].map((x) => d(`2026-${x}`, 100));
  assert.equal(computeStreak(days, '2026-11-02'), 7);
});

test('isFirstMeal: bugün kayıt var ve öncesi yok', () => {
  assert.equal(isFirstMeal(1, false), true);
  assert.equal(isFirstMeal(1, true), false);
  assert.equal(isFirstMeal(0, false), false);
});

test('sinyal → kutlama: ömür boyu bir kez (shown haritası)', () => {
  assert.equal(pickCelebration({ isFirstMeal: false, streak: computeStreak([d('2026-11-04', 1), d('2026-11-05', 1), d('2026-11-06', 1)], '2026-11-06'), shown: {} }), 'streak3');
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 3, shown: { streak3: true } }), null);
});
