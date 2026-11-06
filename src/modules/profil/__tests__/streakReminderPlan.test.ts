import test from 'node:test';
import assert from 'node:assert/strict';

import { planReminderDates, HORIZON_DAYS } from '../streakReminderPlan';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m, 0, 0);

test('öğün loglanmadı, 19:30 öncesi → bugün dahil 7 gün, hepsi 19:30', () => {
  const out = planReminderDates(at(6, 10), false);
  assert.equal(out.length, HORIZON_DAYS);
  assert.equal(out[0].getDate(), 6);
  assert.ok(out.every((d) => d.getHours() === 19 && d.getMinutes() === 30));
});

test('bugün öğün loglandı → bugünün bildirimi yok, yarına kurulur', () => {
  const out = planReminderDates(at(6, 10), true);
  assert.equal(out[0].getDate(), 7);
  assert.equal(out.length, HORIZON_DAYS - 1);
});

test('19:30 geçti → bugün yok, yarın var', () => {
  const out = planReminderDates(at(6, 20), false);
  assert.equal(out[0].getDate(), 7);
});

test('ay sonu taşması doğru günü verir', () => {
  const out = planReminderDates(new Date(2026, 10, 29, 8, 0), false);
  assert.equal(out[2].getMonth(), 11);
  assert.equal(out[2].getDate(), 1);
});
