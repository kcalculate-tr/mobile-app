// eatkcal v2 (G15-S5 md.5) — sipariş değişiklik talebi kuralları (OrderDetailScreen ile birebir).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { changeOptions, hoursUntilDelivery, isoDay, parseDeliveryDays } from '../model/changeRequest';

const NOW = new Date(2026, 10, 6, 12, 0, 0).getTime(); // 6 Kas 2026 12:00 yerel

test('teslimata kalan saat: saat yoksa 12:00, HH:MM:SS kabul', () => {
  assert.equal(hoursUntilDelivery('2026-11-08', null, NOW), 48);
  assert.equal(hoursUntilDelivery('2026-11-08', '14:30:00', NOW), 50.5);
  assert.equal(hoursUntilDelivery(null, '10:00', NOW), null);
  assert.equal(hoursUntilDelivery('bozuk', '10:00', NOW), null);
});

test('randevulu ≥48 sa: iptal + tarih + adres; <48 sa: yalnız adres', () => {
  const far = changeOptions({ status: 'confirmed', scheduled_date: '2026-11-09', scheduled_time: '12:00', created_at: '2026-11-05T10:00:00Z' }, NOW);
  assert.deepEqual(far, { canCancel: true, canChangeDate: true, canChangeAddress: true, showSupportFallback: false });
  const near = changeOptions({ status: 'confirmed', scheduled_date: '2026-11-07', scheduled_time: '12:00', created_at: '2026-11-05T10:00:00Z' }, NOW);
  assert.deepEqual(near, { canCancel: false, canChangeDate: false, canChangeAddress: true, showSupportFallback: false });
});

test('hemen teslim: ilk 30 dk adres, sonra destek', () => {
  const fresh = changeOptions({ status: 'preparing', scheduled_date: null, scheduled_time: null, created_at: new Date(NOW - 10 * 60000).toISOString() }, NOW);
  assert.deepEqual(fresh, { canCancel: false, canChangeDate: false, canChangeAddress: true, showSupportFallback: false });
  const late = changeOptions({ status: 'on_way', scheduled_date: null, scheduled_time: null, created_at: new Date(NOW - 45 * 60000).toISOString() }, NOW);
  assert.deepEqual(late, { canCancel: false, canChangeDate: false, canChangeAddress: false, showSupportFallback: true });
});

test('terminal durumda hiçbir eylem yok', () => {
  for (const status of ['delivered', 'cancelled', 'payment_failed', 'refunded']) {
    const o = changeOptions({ status, scheduled_date: '2026-11-20', scheduled_time: null, created_at: '2026-11-05T10:00:00Z' }, NOW);
    assert.deepEqual(o, { canCancel: false, canChangeDate: false, canChangeAddress: false, showSupportFallback: false });
  }
});

test('teslimat günleri ve ISO gün', () => {
  assert.deepEqual(parseDeliveryDays([1, '2', 9, -1, 'x']), [1, 2]);
  assert.equal(parseDeliveryDays([]), null);
  assert.equal(parseDeliveryDays(null), null);
  assert.equal(isoDay(new Date(2026, 0, 5)), '2026-01-05');
});
