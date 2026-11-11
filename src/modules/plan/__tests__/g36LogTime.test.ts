// G36-S1 md.4 — Logla tüketim zamanı: bugün "şimdi"; geçmiş gün o günün tarihi + yuva saati
// (kişisel plan saatleri, yoksa 08:00 / 13:00 / 16:00 / 19:30), İstanbul sabit UTC+3.
import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SLOT_TIME, planConsumedAt, slotTime } from '../logTime';

const NOW = new Date('2026-11-11T09:42:00.000Z');

test('bugün → şimdi', () => {
  assert.equal(planConsumedAt('2026-11-11', 'dinner', '2026-11-11', null, NOW), NOW);
});

test('gelecek gün (güvenli taraf) → şimdi', () => {
  assert.equal(planConsumedAt('2026-11-12', 'lunch', '2026-11-11', null, NOW), NOW);
});

test('geçmiş gün varsayılan saatler (İstanbul → UTC)', () => {
  assert.deepEqual(DEFAULT_SLOT_TIME, { breakfast: '08:00', lunch: '13:00', snack: '16:00', dinner: '19:30' });
  assert.equal(planConsumedAt('2026-11-10', 'breakfast', '2026-11-11', null, NOW).toISOString(), '2026-11-10T05:00:00.000Z');
  assert.equal(planConsumedAt('2026-11-10', 'lunch', '2026-11-11', null, NOW).toISOString(), '2026-11-10T10:00:00.000Z');
  assert.equal(planConsumedAt('2026-11-10', 'snack', '2026-11-11', null, NOW).toISOString(), '2026-11-10T13:00:00.000Z');
  assert.equal(planConsumedAt('2026-11-10', 'dinner', '2026-11-11', null, NOW).toISOString(), '2026-11-10T16:30:00.000Z');
});

test('kişisel plan saatleri kullanılır; bozuk saat varsayılana düşer', () => {
  const times = { breakfast: '07:15', lunch: '25:00', snack: 'x', dinner: '20:45' };
  assert.equal(slotTime('breakfast', times), '07:15');
  assert.equal(slotTime('lunch', times), '13:00');
  assert.equal(slotTime('snack', times), '16:00');
  assert.equal(planConsumedAt('2026-11-09', 'dinner', '2026-11-11', times, NOW).toISOString(), '2026-11-09T17:45:00.000Z');
  assert.equal(planConsumedAt('2026-11-09', 'breakfast', '2026-11-11', times, NOW).toISOString(), '2026-11-09T04:15:00.000Z');
});

test('İstanbul günü korunur: 00:30 kahvaltı aynı güne düşer', () => {
  const at = planConsumedAt('2026-11-01', 'breakfast', '2026-11-11', { breakfast: '0:30' }, NOW);
  assert.equal(at.toISOString(), '2026-10-31T21:30:00.000Z');
  // İstanbul gün anahtarı (UTC+3) hâlâ 1 Kasım.
  assert.equal(new Date(at.getTime() + 3 * 3_600_000).toISOString().slice(0, 10), '2026-11-01');
});
