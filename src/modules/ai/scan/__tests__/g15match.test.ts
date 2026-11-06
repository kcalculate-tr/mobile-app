// G15-S2 — FinCollectCut eşleşme yüzdesi (taranan ad ↔ menü). SAF.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bestMatchPercent, nameSimilarity } from '../matchName';

test('nameSimilarity: aynı ad 1, ilgisiz 0, büyük/küçük harf ve noktalama yok sayılır', () => {
  assert.equal(nameSimilarity('Tavuk kinoa bowl', 'tavuk Kinoa Bowl!'), 1);
  assert.equal(nameSimilarity('Menemen', 'Mercimek çorbası'), 0);
  assert.equal(nameSimilarity('', 'x'), 0);
});

test('bestMatchPercent: en iyi menü eşleşmesi; %60 altı null', () => {
  const menu = ['KCAL Tavuk Kinoa Bowl', 'Izgara Somon Bowl', 'Mercimek Çorbası'];
  assert.equal(bestMatchPercent('Tavuk kinoa bowl', menu), 86);
  assert.equal(bestMatchPercent('Menemen', menu), null);
  assert.equal(bestMatchPercent('Tavuk kinoa bowl', []), null);
});
