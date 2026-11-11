// G34-S1 md.4 — öğün + haftalık tartı hatırlatma planı; bildirim izni kaynağı 'personal_plan'
// (bağlam içinde, yalnız hiç cevaplanmamışsa; reddedilmişse SORMAZ → akış yine tamamlanır).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, toExpoWeekday } from '../reminderPlan';
import { DEFAULT_MEALS, DEFAULT_REMINDERS } from '../types';
import { decidePush } from '../../../core/push/pushPolicy';

test('hafta günü eşlemesi: Pazartesi 0 → expo 2 … Pazar 6 → expo 1', () => {
  assert.equal(toExpoWeekday(0), 2);
  assert.equal(toExpoWeekday(3), 5); // Perşembe
  assert.equal(toExpoWeekday(6), 1);
});

test('plan: 3 ana + 1 ara öğün saatleri + Perşembe 08:00 tartı', () => {
  const p = planReminders(DEFAULT_MEALS, DEFAULT_REMINDERS);
  assert.deepEqual(
    p.map((x) => [x.kind, x.slot ?? null, x.hour, x.minute, x.weekday ?? null]),
    [
      ['meal', 'breakfast', 8, 0, null],
      ['meal', 'lunch', 13, 0, null],
      ['meal', 'snack', 16, 0, null],
      ['meal', 'dinner', 19, 30, null],
      ['weigh', null, 8, 0, 5],
    ],
  );
});

test('plan: kapatılan öğün ve kapalı tartı kurulmaz; 2 ana öğünde kahvaltı yok', () => {
  const p = planReminders({ ...DEFAULT_MEALS, main: 2, snack: 0 }, { ...DEFAULT_REMINDERS, meals: { lunch: false }, weighIn: false });
  assert.deepEqual(p.map((x) => x.slot), ['dinner']);
});

test("izin: 'personal_plan' yalnız hiç cevaplanmamışsa sorar; reddedildiyse / soramıyorsa sessiz", () => {
  const base = { askedAt: null, now: 0, source: 'personal_plan' as const };
  assert.equal(decidePush({ ...base, status: 'undetermined', canAskAgain: true }), 'ask');
  assert.equal(decidePush({ ...base, status: 'denied', canAskAgain: true }), 'skip');
  assert.equal(decidePush({ ...base, status: 'undetermined', canAskAgain: false }), 'skip');
  assert.equal(decidePush({ ...base, status: 'granted', canAskAgain: true }), 'granted');
  // ilk öğün teklifi kuralı değişmedi
  assert.equal(decidePush({ ...base, source: 'first_meal', status: 'undetermined', canAskAgain: true, askedAt: 5 }), 'skip');
});
