// ScanQuotaChip görünürlük durumları — "ekran açılışında salt okunur değer
// yoksa çipi gizle" (G6-S4 md.3). Zustand çekirdeği native bağımlılık
// taşımaz, saf test. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { useScanQuotaStore } from '../quotaStore';

test('quotaStore: açılışta remaining=null → çip gizli olmalı', () => {
  assert.equal(useScanQuotaStore.getState().remaining, null);
});

test('quotaStore: reserve sonucu kaydedilince çip bilinir hale gelir', () => {
  useScanQuotaStore.getState().recordQuota(2, '2026-11-04T00:00:00.000+03:00');
  const state = useScanQuotaStore.getState();
  assert.equal(state.remaining, 2);
  assert.equal(state.resetAt, '2026-11-04T00:00:00.000+03:00');
});

test('quotaStore: kota dolunca remaining=0 — çip "0/3" gösterecek şekilde bilinir kalır', () => {
  useScanQuotaStore.getState().recordQuota(0, '2026-11-04T00:00:00.000+03:00');
  assert.equal(useScanQuotaStore.getState().remaining, 0);
});

test('quotaStore: clear() tekrar bilinmez duruma döner (çip gizlenir)', () => {
  useScanQuotaStore.getState().recordQuota(1, '2026-11-04T00:00:00.000+03:00');
  useScanQuotaStore.getState().clear();
  assert.equal(useScanQuotaStore.getState().remaining, null);
  assert.equal(useScanQuotaStore.getState().resetAt, null);
});
