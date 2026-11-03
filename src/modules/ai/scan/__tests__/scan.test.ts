// AI tarama akışı birim testleri — kota rezerve/iade, "tahmin" etiketi, kota
// bitince barkod/elle giriş yolu. SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { runAiScan } from '../runScan';
import { createMockAiScanClient } from '../mock';

test('runAiScan: başarılı → sonuç HER ZAMAN tahmin (isEstimate=true) ve düzeltilebilir', async () => {
  const c = createMockAiScanClient({ cap: 3 });
  const out = await runAiScan(c, { idempotencyKey: 'k1', imageRef: 'file://a.jpg' });
  assert.equal(out.status, 'ok');
  if (out.status === 'ok') {
    assert.equal(out.estimate.isEstimate, true);
    assert.ok(out.estimate.ingredients.length > 0, 'malzemeler düzeltilebilir');
    assert.equal(typeof out.estimate.portion, 'number', 'porsiyon düzeltilebilir');
    assert.equal(out.remaining, 2, 'bir hak düşmüş olmalı');
  }
});

test('runAiScan: analiz başarısız → hak İADE edilir (remaining geri gelir)', async () => {
  const c = createMockAiScanClient({ cap: 3, failAnalysis: true });
  const out = await runAiScan(c, { idempotencyKey: 'k1', imageRef: 'file://a.jpg' });
  assert.equal(out.status, 'failed');
  assert.equal(c._remaining(), 3, 'iade sonrası tüm haklar geri gelmeli');
  assert.equal(c._reservedKeys.has('k1'), false, 'rezervasyon bırakılmalı');
  if (out.status === 'failed') assert.equal(out.remaining, 3);
});

test('runAiScan: kota bitince quota_exhausted → analiz hiç çağrılmaz', async () => {
  const c = createMockAiScanClient({ cap: 2 });
  await runAiScan(c, { idempotencyKey: 'a', imageRef: 'x' });
  await runAiScan(c, { idempotencyKey: 'b', imageRef: 'x' });
  const out = await runAiScan(c, { idempotencyKey: 'c', imageRef: 'x' });
  assert.equal(out.status, 'quota_exhausted');
  if (out.status === 'quota_exhausted') assert.equal(out.remaining, 0);
  // Kota bitti ama barkod/elle giriş (bu akışın dışında) etkilenmez — burada
  // yalnız tarama yolunun fallback'e düştüğünü doğruluyoruz.
});

test('runAiScan: aynı idempotency anahtarı yeni hak düşürmez', async () => {
  const c = createMockAiScanClient({ cap: 3 });
  await runAiScan(c, { idempotencyKey: 'same', imageRef: 'x' });
  const out = await runAiScan(c, { idempotencyKey: 'same', imageRef: 'x' });
  assert.equal(out.status, 'ok');
  assert.equal(c._remaining(), 2, 'tek hak düşmüş olmalı (idempotent)');
});
