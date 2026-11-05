// G13-S1 — Ana sayfa vurgu hedefi + teslim otomatik log seçimi (SAF).
import test from 'node:test';
import assert from 'node:assert/strict';

import { pickHighlightTarget, undoClearsHighlight } from '../homeHighlight';
import { pickAutoLogInstances } from '../delivery';
import { buildSlots } from '../homeData';

const rows = [
  { id: 'a', consumed_at: '2026-11-06T08:10:00.000Z' },
  { id: 'b', consumed_at: '2026-11-06T13:05:00.000Z' },
  { id: 'c', consumed_at: '2026-11-06T12:00:00.000Z' },
];

test('pickHighlightTarget: yükteki id listede varsa o seçilir', () => {
  assert.equal(pickHighlightTarget(rows, new Set(['a', 'b', 'c']), 'a'), 'a');
});

test('pickHighlightTarget: id yoksa uçuştan önce olmayan en yeni kayıt', () => {
  assert.equal(pickHighlightTarget(rows, new Set(['a'])), 'b');
  assert.equal(pickHighlightTarget(rows, new Set(['a', 'b'])), 'c');
});

test('pickHighlightTarget: yeni kayıt yoksa null (uydurma vurgu yok)', () => {
  assert.equal(pickHighlightTarget(rows, new Set(['a', 'b', 'c'])), null);
  assert.equal(pickHighlightTarget([], new Set()), null);
});

test('pickHighlightTarget: bir kez — zaten vurgulanan tekrar seçilmez', () => {
  assert.equal(pickHighlightTarget(rows, new Set(['a', 'b', 'c']), 'b', new Set(['b'])), null);
  assert.equal(pickHighlightTarget(rows, new Set(['a']), null, new Set(['b'])), 'c');
});

test('pickHighlightTarget: yükteki id listede yoksa yeni kayda düşer', () => {
  assert.equal(pickHighlightTarget(rows, new Set(['a', 'c']), 'zz'), 'b');
});

test('undoClearsHighlight: aynı id ya da id yoksa geri alınır, başka kayıtsa değil', () => {
  assert.equal(undoClearsHighlight('b', 'b'), true);
  assert.equal(undoClearsHighlight('b', null), true);
  assert.equal(undoClearsHighlight('b', 'x'), false);
});

test('buildSlots: highlightId yalnız o kaydı vurgular', () => {
  const s = buildSlots(
    [
      { id: 'a', source: 'kesfet', name: 'X', meal_type: 'ogle', calories: 100, protein: 0, carbs: 0, fat: 0, consumed_at: '2026-11-06T10:00:00.000Z' },
      { id: 'b', source: 'manual', name: 'Y', meal_type: 'ogle', calories: 50, protein: 0, carbs: 0, fat: 0, consumed_at: '2026-11-06T10:30:00.000Z' },
    ],
    { highlightId: 'b' },
  );
  const lunch = s.find((x) => x.key === 'lunch')!;
  assert.deepEqual(lunch.items.map((i) => i.highlight), [false, true]);
});

test('pickAutoLogInstances: yalnız bugün teslim + tüketilmemiş + daha önce loglanmamış kopyalar', () => {
  const items = [
    { id: 'p1', orderItemId: 'oi1', quantity: 2 },
    { id: 'p2', orderItemId: 'oi2', quantity: 1 }, // dün teslim → yok
    { id: 'p3', quantity: 1 }, // sipariş bağı yok → yok
    { id: 'p4', orderItemId: 'oi4', quantity: 1 },
  ];
  const today = new Map([
    ['oi1', '2026-11-06T12:00:00.000Z'],
    ['oi4', '2026-11-06T18:00:00.000Z'],
  ]);
  const consumed = new Set(['p1-0']); // ilk kopya zaten "Tükettim"
  const done = new Set(['p4-0']); // kullanıcı kaldırmıştı → geri gelmez
  const out = pickAutoLogInstances(items, today, consumed, done);
  assert.deepEqual(out.map((c) => c.instanceId), ['p1-1']);
  assert.equal(out[0].deliveredAt, '2026-11-06T12:00:00.000Z');
});
