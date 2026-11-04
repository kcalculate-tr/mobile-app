// "Takibe başla" saf eşleme + hesaplama testleri (G12-S1 madde 9).
// Çalıştırma: npm run test:unit (tsx --test, Node — RN import YOK).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
  assert.equal(daysToFirstKg(1), 7);
  assert.equal(daysToFirstKg(0.5), 14);
  assert.equal(daysToFirstKg(0.25), 28);
});
