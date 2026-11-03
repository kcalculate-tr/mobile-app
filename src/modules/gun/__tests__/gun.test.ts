// Gün halkası mock testleri — SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMockGunClient } from '../mock';

test('getDayRings: ilk öğe daima "ben"', async () => {
  const c = createMockGunClient({ ringCount: 3 });
  const rings = await c.getDayRings();
  assert.equal(rings.length, 3);
  assert.equal(rings[0].user.id, 'me');
  for (const r of rings) {
    assert.ok(r.progress >= 0 && r.progress <= 1, 'progress 0–1 aralığında');
  }
});

test('shareMealToDay: paylaşılan consumption kartlarda görünür', async () => {
  const c = createMockGunClient({ cardCount: 2 });
  const before = await c.getDayCards({ user: 'me' });
  await c.shareMealToDay({ consumption: 'consumption-me-paylasilan' });
  const after = await c.getDayCards({ user: 'me' });
  assert.equal(after.length, before.length + 1);
  assert.ok(c._shared.has('consumption-me-paylasilan'));
  assert.ok(after.some((card) => card.consumption_id === 'consumption-me-paylasilan'));
});
