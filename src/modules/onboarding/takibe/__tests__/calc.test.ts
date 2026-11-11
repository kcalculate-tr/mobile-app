// "Takibe başla" saf eşleme + hesaplama testleri (G12-S1 madde 9).
// Çalıştırma: npm run test:unit (tsx --test, Node — RN import YOK).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allowedPaces,
  calorieFloorFor,
  canChooseLose,
  clampPace,
  MAX_PACE,
  PACE_OPTIONS,
  buildProfileInput,
  computeResult,
  daysToFirstKg,
  goalNeedsPace,
  isUnderage,
  toServiceGender,
  toServiceGoal,
  type TbDraftValues,
} from '../calc';
import { calculateMacroTargets } from '../../../../lib/nutrition';

const YEAR = 2026;

const base: TbDraftValues = {
  goal: 'lose',
  pace: 0.5,
  gender: 'female',
  birthYear: 1996,
  heightCm: 170,
  weightKg: 65,
  consent: true,
  activity: 'light',
};

test('goalNeedsPace: yalnız kilo ver / kas yap', () => {
  assert.equal(goalNeedsPace('lose'), true);
  assert.equal(goalNeedsPace('gain'), true);
  assert.equal(goalNeedsPace('maintain'), false);
  assert.equal(goalNeedsPace('regular'), false);
  assert.equal(goalNeedsPace(null), false);
});

test('toServiceGoal: panel hedefi → servis hedefi', () => {
  assert.equal(toServiceGoal('lose'), 'lose_weight');
  assert.equal(toServiceGoal('gain'), 'gain_weight');
  assert.equal(toServiceGoal('maintain'), 'maintain');
  assert.equal(toServiceGoal('regular'), 'maintain'); // "Daha düzenli beslen" = koru
});

test('toServiceGender: belirtmeyen hesapta female', () => {
  assert.equal(toServiceGender('male'), 'male');
  assert.equal(toServiceGender('female'), 'female');
  assert.equal(toServiceGender('unspecified'), 'female');
});

test('isUnderage: 18 sınırı', () => {
  assert.equal(isUnderage(2010, YEAR), true); // 16
  assert.equal(isUnderage(2008, YEAR), false); // 18
  assert.equal(isUnderage(1990, YEAR), false);
  assert.equal(isUnderage(null, YEAR), false);
});

test('buildProfileInput: eksik alan → null', () => {
  assert.equal(buildProfileInput({ ...base, gender: null }, YEAR), null);
  assert.equal(buildProfileInput({ ...base, birthYear: null }, YEAR), null);
  assert.equal(buildProfileInput({ ...base, heightCm: 0 }, YEAR), null);
  assert.equal(buildProfileInput({ ...base, activity: null }, YEAR), null);
});

test('buildProfileInput: tam taslak → servis girdisi (yaş doğru)', () => {
  const input = buildProfileInput(base, YEAR);
  assert.ok(input);
  assert.equal(input!.age, 30); // 2026 - 1996
  assert.equal(input!.gender, 'female');
  assert.equal(input!.goal, 'lose_weight');
  assert.equal(input!.activity, 'light');
});

test('computeResult: MEVCUT servis ile aynı makroları verir', () => {
  const result = computeResult(base, YEAR);
  assert.ok(result);
  const expected = calculateMacroTargets(result!.input);
  assert.deepEqual(result!.macros, expected);
  assert.ok(result!.bmr > 0);
  assert.ok(result!.tdee > result!.bmr); // hareket çarpanı > 1
});

test('daysToFirstKg: tempo arttıkça kısalır', () => {
  assert.equal(daysToFirstKg(0.75), 9);
  assert.equal(daysToFirstKg(0.5), 14);
  assert.equal(daysToFirstKg(0.25), 28);
});

// ── G33-S1 (Tur 26o): hız sınırı 0,75 · %1 kuralı · kalori tabanı · BMI ───────
test('G33 tempo: 1 kg seçeneği yok, üst sınır 0,75', () => {
  assert.deepEqual([...PACE_OPTIONS], [0.25, 0.5, 0.75]);
  assert.equal(MAX_PACE, 0.75);
});

test('G33 tempo: 0,75 yalnız kilonun %1’ini aşmıyorsa', () => {
  assert.deepEqual(allowedPaces(null), [0.25, 0.5, 0.75]);
  assert.deepEqual(allowedPaces(75), [0.25, 0.5, 0.75]);
  assert.deepEqual(allowedPaces(74), [0.25, 0.5]);
  assert.deepEqual(allowedPaces(40), [0.25]);
  assert.equal(clampPace(1, 90), 0.75); // eski 1 kg kaydı
  assert.equal(clampPace(0.75, 60), 0.5);
  assert.equal(clampPace(0.25, 60), 0.25);
});

test('G33 BMI < 18,5: Kilo ver kapalı ve hesap korumaya döner', () => {
  assert.equal(canChooseLose(170, 52), false); // 18,0
  assert.equal(canChooseLose(170, 54), true); // 18,7
  assert.equal(canChooseLose(null, null), true);
  const r = computeResult({ ...base, heightCm: 170, weightKg: 50, goal: 'lose' }, YEAR);
  assert.ok(r);
  assert.equal(r!.input.goal, 'maintain');
});

test('G33 kalori tabanı: kadın 1200, erkek ve belirtmeyen 1500', () => {
  assert.equal(calorieFloorFor('female'), 1200);
  assert.equal(calorieFloorFor('male'), 1500);
  assert.equal(calorieFloorFor('unspecified'), 1500);
  const r = computeResult(
    { ...base, gender: 'unspecified', heightCm: 150, weightKg: 45, birthYear: 1950, activity: 'sedentary', goal: 'lose' },
    YEAR,
  );
  assert.ok(r && r.macros.calories >= 1500);
});
