// Tabak Röntgeni kartı — yerleşim birim testleri (G6-S4 md.5: etiket sayısı
// 0/1/4). SAF modül, native yok. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLabelPositions, PHOTO_H, CARD_W, SAFE_TOP, SAFE_BOTTOM, CARD_H } from '../plateXRayLayout';

test('computeLabelPositions: 0 bileşen → boş dizi (öğün adı gösterilir)', () => {
  assert.deepEqual(computeLabelPositions(0), []);
});

test('computeLabelPositions: 1 bileşen → tek konum, foto alanı içinde', () => {
  const pos = computeLabelPositions(1);
  assert.equal(pos.length, 1);
  assert.ok(pos[0].x >= 0 && pos[0].x < CARD_W);
  assert.ok(pos[0].y >= 0 && pos[0].y < PHOTO_H);
});

test('computeLabelPositions: 4 bileşen → tasarımdaki 4 sabit konum, hepsi farklı', () => {
  const pos = computeLabelPositions(4);
  assert.equal(pos.length, 4);
  const unique = new Set(pos.map((p) => `${p.x},${p.y}`));
  assert.equal(unique.size, 4, 'dört konum da birbirinden farklı olmalı');
  for (const p of pos) {
    assert.ok(p.y < PHOTO_H, 'etiket foto alanının dışına taşmamalı');
  }
});

test('computeLabelPositions: 4ten fazla (nadir) → taşmadan ızgaraya düşer', () => {
  const pos = computeLabelPositions(6);
  assert.equal(pos.length, 6);
  for (const p of pos) {
    assert.ok(p.y + 84 <= PHOTO_H, 'ızgara satırları da foto yüksekliğini aşmamalı');
  }
});

test('güvenli alan sabitleri 1080×1920 kart ile tutarlı (T20ShareCardGuide)', () => {
  assert.equal(CARD_W, 1080);
  assert.equal(CARD_H, 1920);
  assert.ok(SAFE_TOP > 0 && SAFE_BOTTOM > 0);
  assert.ok(PHOTO_H + (CARD_H - PHOTO_H) === CARD_H);
});
