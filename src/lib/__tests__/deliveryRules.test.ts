import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEstimatedDelivery,
  resolveFreeShippingAbove,
  resolveMinOrder,
  resolveShippingFee,
  type DeliveryGlobals,
  type DeliveryZoneRow,
} from '../deliveryRules';

// Teslimat ücreti ve minimum sepet CANLI PARA hesabıdır: üç kademeli
// fallback zincirinin (bölge override → global varsayılan → legacy → 0)
// sessizce kayması müşteriye yanlış tutar gösterir ve haftalarca fark
// edilmeyebilir. Bu dosya o zinciri satır satır sabitler.

const globals: DeliveryGlobals = {
  immediate: { min_order: 300, shipping_fee: 40, free_shipping_above: 600 },
  scheduled: { min_order: 200, shipping_fee: 25, free_shipping_above: 500 },
};

const bosGlobals: DeliveryGlobals = {
  immediate: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  scheduled: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
};

// ── resolveMinOrder ─────────────────────────────────────────────────────────

test('min sepet: bölgenin tipe özel override’ı globali ezer', () => {
  const zone: DeliveryZoneRow = { min_order_immediate: 450, min_order_scheduled: 150, min_order: 999 };
  assert.equal(resolveMinOrder(zone, globals, 'immediate'), 450);
  assert.equal(resolveMinOrder(zone, globals, 'scheduled'), 150);
});

test('min sepet: override yoksa globale, o da yoksa legacy min_order’a düşer', () => {
  assert.equal(resolveMinOrder({ min_order: 999 }, globals, 'immediate'), 300);
  assert.equal(resolveMinOrder({ min_order: 999 }, bosGlobals, 'immediate'), 999);
  assert.equal(resolveMinOrder({}, bosGlobals, 'immediate'), 0);
  assert.equal(resolveMinOrder(null, null, 'scheduled'), 0);
});

test('min sepet: 0 ve null override "ayarlanmamış" sayılır (zincir devam eder)', () => {
  // isMeaningfulOverride > 0 arıyor — panelde alan boş bırakılıp 0 kaydedilse
  // bile müşteriye global eşik uygulanmalı, "min sepet yok" DEĞİL.
  assert.equal(resolveMinOrder({ min_order_immediate: 0 }, globals, 'immediate'), 300);
  assert.equal(resolveMinOrder({ min_order_immediate: null }, globals, 'immediate'), 300);
});

test('min sepet: iki teslimat tipi birbirinden bağımsız', () => {
  const zone: DeliveryZoneRow = { min_order_immediate: 450 };
  assert.equal(resolveMinOrder(zone, globals, 'immediate'), 450);
  assert.equal(resolveMinOrder(zone, globals, 'scheduled'), 200); // globalden
});

// ── resolveShippingFee ──────────────────────────────────────────────────────

test('teslimat ücreti: eşiğin altında ücret alınır, eşikte/üstünde 0', () => {
  const zone: DeliveryZoneRow = { delivery_fee_immediate: 50, free_shipping_above_immediate: 700 };
  assert.equal(resolveShippingFee(zone, globals, 'immediate', 699), 50);
  assert.equal(resolveShippingFee(zone, globals, 'immediate', 700), 0, 'eşiğin TAM ÜSTÜ ücretsiz olmalı');
  assert.equal(resolveShippingFee(zone, globals, 'immediate', 1000), 0);
});

test('teslimat ücreti: bölge override yoksa global ücret + global eşik kullanılır', () => {
  assert.equal(resolveShippingFee({}, globals, 'immediate', 599), 40);
  assert.equal(resolveShippingFee({}, globals, 'immediate', 600), 0);
  assert.equal(resolveShippingFee({}, globals, 'scheduled', 499), 25);
  assert.equal(resolveShippingFee({}, globals, 'scheduled', 500), 0);
});

test('teslimat ücreti: bölgedeki 0 ücret geçerli bir değerdir (globale düşmez)', () => {
  // min_order’ın aksine burada `!= null` kontrolü var: "bu mahallede teslimat
  // bedava" diyebilmek için 0 anlamlı olmak zorunda.
  assert.equal(resolveShippingFee({ delivery_fee_immediate: 0 }, globals, 'immediate', 10), 0);
});

test('teslimat ücreti: hiçbir eşik tanımlı değilse ücret her tutarda alınır', () => {
  const g: DeliveryGlobals = {
    immediate: { min_order: 0, shipping_fee: 30, free_shipping_above: 0 },
    scheduled: { min_order: 0, shipping_fee: 0, free_shipping_above: 0 },
  };
  assert.equal(resolveShippingFee({}, g, 'immediate', 100000), 30);
  assert.equal(resolveShippingFee({}, g, 'scheduled', 1), 0);
});

test('teslimat ücreti: hiçbir yapılandırma yoksa 0 (fail-open)', () => {
  assert.equal(resolveShippingFee(null, null, 'immediate', 250), 0);
});

// ── resolveFreeShippingAbove ────────────────────────────────────────────────

test('ücretsiz teslimat eşiği: bölge → global → 0', () => {
  assert.equal(resolveFreeShippingAbove({ free_shipping_above_scheduled: 800 }, globals, 'scheduled'), 800);
  assert.equal(resolveFreeShippingAbove({}, globals, 'scheduled'), 500);
  assert.equal(resolveFreeShippingAbove({}, bosGlobals, 'scheduled'), 0);
  assert.equal(resolveFreeShippingAbove(null, null, 'immediate'), 0);
});

test('ücretsiz teslimat eşiği ile ücret hesabı aynı kaynağı okur', () => {
  // Bar "X TL kaldı" derken resolveFreeShippingAbove’u, ücret satırı
  // resolveShippingFee’yi kullanıyor. İkisi ayrışırsa bar dolar ama ücret
  // düşmez (22.09.2026’da tam olarak bu sınıftan bir hata yaşandı).
  const zone: DeliveryZoneRow = { delivery_fee_immediate: 45, free_shipping_above_immediate: 650 };
  const esik = resolveFreeShippingAbove(zone, globals, 'immediate');
  assert.equal(resolveShippingFee(zone, globals, 'immediate', esik), 0);
  assert.equal(resolveShippingFee(zone, globals, 'immediate', esik - 0.01), 45);
});

// ── formatEstimatedDelivery ─────────────────────────────────────────────────

test('tahmini süre: aralık, tek değer ve veri yokluğu', () => {
  assert.equal(formatEstimatedDelivery({ estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 45 }), '30-45 dk');
  assert.equal(formatEstimatedDelivery({ estimated_delivery_minutes: 45 }), '~45 dk');
  assert.equal(formatEstimatedDelivery({ estimated_delivery_minutes_max: 45 }), '~45 dk');
  assert.equal(formatEstimatedDelivery({ estimated_delivery_minutes: 45, estimated_delivery_minutes_max: 45 }), '~45 dk');
  assert.equal(formatEstimatedDelivery({}), null, 'veri yoksa tahmin UYDURULMAZ');
  assert.equal(formatEstimatedDelivery(null), null);
  assert.equal(formatEstimatedDelivery({ estimated_delivery_minutes: 0 }), null);
});
