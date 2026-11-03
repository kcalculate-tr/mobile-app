import test from 'node:test';
import assert from 'node:assert/strict';

import { inferMealTypeFromHour } from '../mealTypeFromHour';

test('inferMealTypeFromHour: gün dilimleri', () => {
  assert.equal(inferMealTypeFromHour(7), 'breakfast');
  assert.equal(inferMealTypeFromHour(12), 'lunch');
  assert.equal(inferMealTypeFromHour(19), 'dinner');
  assert.equal(inferMealTypeFromHour(2), 'snack');
  assert.equal(inferMealTypeFromHour(23), 'snack');
});
