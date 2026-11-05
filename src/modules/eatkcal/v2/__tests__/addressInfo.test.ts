// eatkcal v2 md.5 — FinEkInfo saf özetleri (veri yoksa satır gizli).
import test from 'node:test';
import assert from 'node:assert/strict';
import { commonImmediateEta, immediateDeliveryFree, minOrderSummary } from '../model/addressInfo';

const fast = (extra: Record<string, unknown> = {}) => ({ district: 'Konak', is_active: true, allow_immediate: true, ...extra });

test('ortak süre: tüm hızlı bölgelerde aynıysa gösterilir, farklı/eksikse null', () => {
  assert.equal(
    commonImmediateEta([
      fast({ estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 55 }),
      fast({ estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 55 }),
      { district: 'Urla', is_active: true, allow_immediate: false }, // hızlı değil → sayılmaz
    ]),
    '30-55 dk',
  );
  assert.equal(
    commonImmediateEta([fast({ estimated_delivery_minutes: 30 }), fast({ estimated_delivery_minutes: 45 })]),
    null,
  );
  assert.equal(commonImmediateEta([fast({ estimated_delivery_minutes: 30 }), fast()]), null);
  assert.equal(commonImmediateEta([]), null);
});

test('ücretsiz: her hızlı bölgede ücret 0 ise', () => {
  assert.equal(immediateDeliveryFree([fast(), fast()], null), true);
  assert.equal(immediateDeliveryFree([fast(), fast({ delivery_fee_immediate: 30 })], null), false);
  assert.equal(immediateDeliveryFree([], null), false);
  assert.equal(
    immediateDeliveryFree([fast()], {
      immediate: { min_order: 0, shipping_fee: 25, free_shipping_above: 0 },
      scheduled: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
    }),
    false,
  );
});

test('minimum: tek değer / değişken / yok (DeliveryZonesSheet kararı)', () => {
  assert.equal(minOrderSummary([300, 300, Infinity]), 300);
  assert.equal(minOrderSummary([300, 400]), 'varies');
  assert.equal(minOrderSummary([Infinity, 0]), null);
});
