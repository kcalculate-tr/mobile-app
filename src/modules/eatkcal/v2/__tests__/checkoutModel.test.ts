// eatkcal v2 (G13-S2 md.9) — Sipariş özeti modeli = bugünkü CheckoutScreen.
// "Eski" taraf, CheckoutScreen.tsx'teki satırların AYNEN yazılmış hâlidir
// (KİMSE dosyası React bileşeni olduğu için node'dan import edilemez); satır
// numaraları her bloğun başında. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveFreeShippingAbove,
  resolveMinOrder,
  resolveShippingFee,
  type DeliveryGlobals,
  type DeliveryZoneRow,
} from '../../../../lib/deliveryRules';
import { buildCartSignatureLines, computeCartSignature } from '../../../../lib/cartSignature';
import { buildPaymentNavParams } from '../../../../lib/checkoutPayment';
import { tl } from '../../../../lib/money';
import type { CartItem } from '../../../../types';
import {
  buildDraftInput,
  canReuseDraft,
  cartSignatureFor,
  computeCartTotal,
  computeCheckoutTotals,
  paymentRouteParams,
  payStateAllowsRetry,
  payStateFromOrder,
  pickupAddressOf,
  resolveCheckoutBlock,
  resolveZoneRule,
  scheduledFieldsOf,
  EK_TIME_SLOTS,
} from '../model/checkoutModel';

const globals: DeliveryGlobals = {
  immediate: { min_order: 300, shipping_fee: 49.9, free_shipping_above: 750 },
  scheduled: { min_order: 500, shipping_fee: 0, free_shipping_above: 0 },
} as DeliveryGlobals;

const zone = (over: Record<string, unknown> = {}): DeliveryZoneRow =>
  ({ district: 'Konak', neighbourhood: 'Alsancak', allow_immediate: true, allow_scheduled: true, ...over }) as DeliveryZoneRow;

// Eski CheckoutScreen.tsx:705-722 (aynen)
function legacyCheckoutTotal(p: {
  subtotal: number;
  discountAmount: number;
  deliveryMethod: 'home_delivery' | 'pickup';
  zoneRow: DeliveryZoneRow | null;
  globals: DeliveryGlobals | null;
  deliveryTimeType: 'immediate' | 'scheduled';
}) {
  const macroDiscount = 0;
  const resolvedShippingFee =
    p.deliveryMethod === 'pickup' ? 0 : resolveShippingFee(p.zoneRow, p.globals, p.deliveryTimeType, p.subtotal);
  const deliveryFee = resolvedShippingFee;
  const totalAmount = Math.max(0, p.subtotal + deliveryFee - p.discountAmount - macroDiscount);
  return { deliveryFee, totalAmount, resolvedMinOrder: resolveMinOrder(p.zoneRow, p.globals, p.deliveryTimeType) };
}

const cases = [
  { subtotal: 420, discountAmount: 0, deliveryMethod: 'home_delivery', zoneRow: zone(), deliveryTimeType: 'immediate' },
  { subtotal: 820, discountAmount: 50, deliveryMethod: 'home_delivery', zoneRow: zone(), deliveryTimeType: 'immediate' },
  { subtotal: 420, discountAmount: 420, deliveryMethod: 'home_delivery', zoneRow: zone(), deliveryTimeType: 'immediate' },
  { subtotal: 600, discountAmount: 25, deliveryMethod: 'pickup', zoneRow: null, deliveryTimeType: 'immediate' },
  { subtotal: 610, discountAmount: 0, deliveryMethod: 'home_delivery', zoneRow: zone({ delivery_fee_scheduled: 30 }), deliveryTimeType: 'scheduled' },
  { subtotal: 99.99, discountAmount: 10, deliveryMethod: 'home_delivery', zoneRow: zone({ delivery_fee_immediate: 0 }), deliveryTimeType: 'immediate' },
] as const;

test('toplam: v2 computeCheckoutTotals = eski CheckoutScreen formülü (6 senaryo)', () => {
  for (const c of cases) {
    const v2 = computeCheckoutTotals({ ...c, globals, settingsMinCartAmount: 0 });
    const old = legacyCheckoutTotal({ ...c, globals });
    assert.equal(v2.deliveryFee, old.deliveryFee, JSON.stringify(c));
    assert.equal(v2.totalAmount, old.totalAmount, JSON.stringify(c));
  }
});

test('toplam: minimum sepet = max(settings, ilçe/global) (CheckoutScreen.tsx:806-810)', () => {
  const v2 = computeCheckoutTotals({
    subtotal: 200,
    discountAmount: 0,
    deliveryMethod: 'home_delivery',
    deliveryTimeType: 'immediate',
    zoneRow: zone(),
    globals,
    settingsMinCartAmount: 350,
  });
  assert.equal(v2.effectiveMinAmount, Math.max(350, resolveMinOrder(zone(), globals, 'immediate')));
  assert.equal(v2.remainingToMinAmount, 150);
});

test('ücretsiz teslimat kalan: CheckoutFooter eşiği, Gel-Al’da yok', () => {
  const home = computeCheckoutTotals({ subtotal: 500, discountAmount: 0, deliveryMethod: 'home_delivery', deliveryTimeType: 'immediate', zoneRow: zone(), globals, settingsMinCartAmount: 0 });
  assert.equal(home.freeShippingAbove, resolveFreeShippingAbove(zone(), globals, 'immediate'));
  assert.equal(home.remainingToFreeShipping, 250);
  const pickup = computeCheckoutTotals({ subtotal: 500, discountAmount: 0, deliveryMethod: 'pickup', deliveryTimeType: 'immediate', zoneRow: null, globals, settingsMinCartAmount: 0 });
  assert.equal(pickup.remainingToFreeShipping, 0);
  assert.equal(pickup.deliveryFee, 0);
});

test('sepet ekranı toplamı = eski CartScreen.tsx:253 (subtotal − kupon, min 0)', () => {
  assert.equal(computeCartTotal(420, 50), Math.max(0, 420 - 50));
  assert.equal(computeCartTotal(40, 50), 0);
});

test('bölge kuralı: mahalle eşleşmesi, izin bayrakları, teslim günleri (CheckoutScreen.tsx:1298-1395)', () => {
  const rows = [
    { district: 'Konak', neighbourhood: 'Göztepe', allow_immediate: false, allow_scheduled: true, delivery_days: [2, 4] },
    { district: 'Konak', neighbourhood: 'Alsancak', allow_immediate: true, allow_scheduled: false, min_order: 250 },
  ];
  const r = resolveZoneRule(rows, { district: 'Konak', neighbourhood: 'ALSANCAK ' }, 'immediate');
  assert.equal(r.status.status, 'ok');
  if (r.status.status !== 'ok') return;
  assert.equal(r.status.data.neighbourhood, 'Alsancak');
  assert.equal(r.status.data.allowImmediate, true);
  assert.equal(r.status.data.allowScheduled, false);
  assert.equal(r.status.data.minOrder, 250);
  assert.deepEqual(r.deliveryDays, [1, 2, 3, 4, 5]);

  const g = resolveZoneRule(rows, { district: 'Konak', neighbourhood: 'Göztepe' }, 'scheduled');
  assert.deepEqual(g.deliveryDays, [2, 4]);

  assert.equal(resolveZoneRule(rows, { district: 'Konak', neighbourhood: 'Yok' }, 'immediate').status.status, 'not_configured');
  assert.equal(resolveZoneRule([], { district: 'Konak', neighbourhood: null }, 'immediate').status.status, 'not_configured');
  // Mahalle yoksa ilk satır (en yeni updated_at)
  const first = resolveZoneRule(rows, { district: 'Konak', neighbourhood: null }, 'immediate');
  assert.equal(first.status.status === 'ok' && first.status.data.neighbourhood, 'Göztepe');
  // allow_* hiç yoksa ikisi de açık
  const open = resolveZoneRule([{ district: 'Bornova' }], { district: 'Bornova', neighbourhood: null }, 'immediate');
  assert.equal(open.status.status === 'ok' && open.status.data.allowImmediate && open.status.data.allowScheduled, true);
});

test('engel mesajı: eski checkoutBlockMessage metinleri aynen', () => {
  const base = {
    deliveryMethod: 'home_delivery' as const,
    deliveryTimeType: 'immediate' as const,
    rulesFetchFailed: false,
    rulesLoading: false,
    hasAddress: true,
    ruleStatus: { status: 'ok', data: { district: 'Konak', neighbourhood: null, isActive: true, minOrder: 0, allowImmediate: true, allowScheduled: true } } as const,
    hasScheduledDate: false,
    hasTimeSlot: false,
    effectiveMinAmount: 300,
    remainingToMinAmount: 0,
    formatMoney: tl,
  };
  assert.equal(resolveCheckoutBlock(base), '');
  assert.equal(resolveCheckoutBlock({ ...base, hasAddress: false }), 'Lütfen teslimat adresi seçin.');
  assert.equal(resolveCheckoutBlock({ ...base, rulesFetchFailed: true }), 'Teslimat kuralları yüklenemedi. Lütfen tekrar deneyin.');
  assert.equal(resolveCheckoutBlock({ ...base, ruleStatus: { status: 'not_configured' } }), 'Bu bölge için teslimat kuralı tanımlı değil. Lütfen farklı bir adres seçin.');
  assert.equal(resolveCheckoutBlock({ ...base, deliveryTimeType: 'scheduled' }), 'Lütfen teslimat tarihi seçin.');
  assert.equal(resolveCheckoutBlock({ ...base, deliveryTimeType: 'scheduled', hasScheduledDate: true }), 'Lütfen teslimat saatini seçin.');
  assert.equal(
    resolveCheckoutBlock({ ...base, remainingToMinAmount: 50 }),
    `Minimum sepet: ${tl(300)} — Kalan: ${tl(50)}`,
  );
  assert.equal(resolveCheckoutBlock({ ...base, deliveryMethod: 'pickup', hasAddress: false }), '');
});

const item = (id: string, price: number, qty: number, opts: unknown[] = []): CartItem =>
  ({ lineKey: `${id}:${JSON.stringify(opts)}`, productId: id, name: `Ürün ${id}`, quantity: qty, unitPrice: price, selected_options: opts, selectedOptions: { byGroup: {}, extraPrice: 0, templateOptions: opts } }) as unknown as CartItem;

test('taslak argümanı = eski createOrderDraftForPayment çağrısı (CheckoutScreen.tsx:1746-1770)', () => {
  const items = [item('11', 300, 1), item('12', 120, 2)];
  const address = { id: '3f6c1a2e-1111-4222-8333-444455556666', title: 'Ev', contact_name: 'A', contact_phone: '5', contact_email: 'a@b.c', full_address: 'X', city: 'İzmir', district: 'Konak', neighbourhood: 'Alsancak' };
  const scheduled = scheduledFieldsOf('scheduled', '2026-11-07', EK_TIME_SLOTS[1]);
  const v2 = buildDraftInput({
    userId: 'u1',
    address: address as never,
    cartItems: items,
    customerName: '  Ad Soyad ',
    customerEmail: ' a@b.c ',
    customerPhone: ' 0555 ',
    totals: { subtotal: 540, deliveryFee: 0, discountAmount: 40 },
    coupon: { code: 'KOD', campaignId: '9' },
    deliveryMethod: 'home_delivery',
    orderNote: '  zil çalma ',
    scheduled,
    cardsEnabled: true,
    selectedCardId: 'card-1',
  });
  // Eski ekranın geçtiği nesne (aynen):
  const legacy = {
    userId: 'u1',
    address,
    cartItems: items,
    customerName: '  Ad Soyad '.trim(),
    customerEmail: ' a@b.c '.trim(),
    customerPhone: ' 0555 '.trim(),
    subtotal: 540,
    deliveryFee: 0,
    discountAmount: 40,
    couponCode: 'KOD' || null,
    couponId: '9' || null,
    deliveryMethod: 'delivery',
    orderNote: '  zil çalma '.trim() || null,
    deliveryType: 'scheduled',
    scheduledDate: '2026-11-07',
    scheduledTime: '13:30',
    paymentMethod: true && 'card-1' ? 'saved_card' : 'new_card',
  };
  assert.deepEqual(v2, legacy);

  const pickup = buildDraftInput({
    userId: 'u1',
    address: pickupAddressOf({ name: ' A ', phone: '5', email: 'e' }, null),
    cartItems: items,
    customerName: 'A',
    customerEmail: 'e',
    customerPhone: '5',
    totals: { subtotal: 540, deliveryFee: 0, discountAmount: 0 },
    coupon: null,
    deliveryMethod: 'pickup',
    orderNote: '',
    scheduled: scheduledFieldsOf('immediate', null, null),
    cardsEnabled: false,
    selectedCardId: null,
  });
  assert.equal(pickup.deliveryMethod, 'pickup');
  assert.equal(pickup.address.full_address, 'Gel-Al (Şubeden Teslim)');
  assert.equal(pickup.couponCode, null);
  assert.equal(pickup.orderNote, null);
  assert.equal(pickup.deliveryType, 'immediate');
  assert.equal(pickup.paymentMethod, 'new_card');
});

test('PaymentScreen parametreleri = eski navigate(PaymentScreen) (CheckoutScreen.tsx:1835-1840)', () => {
  for (const cards of [
    { cardsEnabled: false, selectedCardId: null },
    { cardsEnabled: true, selectedCardId: null },
    { cardsEnabled: true, selectedCardId: 'c9' },
  ]) {
    const v2 = paymentRouteParams({ orderId: 4711, amount: 520, orderCode: 'KCAL-1', ...cards });
    assert.deepEqual(v2, { orderId: '4711', amount: 520, orderCode: 'KCAL-1', ...buildPaymentNavParams(cards) });
  }
});

test('mükerrer koruma: aynı sepet+bağlam → aynı imza → taslak yeniden kullanılır', () => {
  const items = [item('11', 300, 1, [{ id: 1 }]), item('12', 120, 2)];
  const ctx = { couponCode: null, addressId: 'a', deliveryMethod: 'delivery' as const, deliveryType: 'immediate' as const, scheduledDate: null, scheduledTime: null };
  const sig = cartSignatureFor(items, ctx);
  assert.equal(sig, computeCartSignature(buildCartSignatureLines(items), ctx));
  assert.equal(canReuseDraft(sig, cartSignatureFor([...items].reverse(), ctx)), true);
  assert.equal(canReuseDraft(sig, cartSignatureFor([item('11', 300, 2, [{ id: 1 }]), item('12', 120, 2)], ctx)), false);
  assert.equal(canReuseDraft(sig, cartSignatureFor(items, { ...ctx, couponCode: 'X' })), false);
  assert.equal(canReuseDraft(null, sig), false);
});

test('ödeme sonucu → pano durumu (FinEkCheckoutPayFail / PayUnknown)', () => {
  assert.equal(payStateFromOrder({ status: 'payment_failed', paymentStatus: 'failed' }), 'fail');
  assert.equal(payStateFromOrder({ status: 'pending_payment', paymentStatus: 'failed' }), 'fail');
  assert.equal(payStateFromOrder({ status: 'pending_payment', paymentStatus: 'pending' }), 'unknown');
  assert.equal(payStateFromOrder({ status: 'confirmed', paymentStatus: 'paid' }), 'unknown');
  assert.equal(payStateFromOrder(null), 'unknown');
  // Ödenmiş/onaylı siparişte tekrar ödeme başlatılmaz; bekleyen/başarısızda eski ekran gibi tekrar denenir.
  assert.equal(payStateAllowsRetry('unknown', { status: 'confirmed', paymentStatus: 'paid' }), false);
  assert.equal(payStateAllowsRetry('unknown', { status: 'pending_payment', paymentStatus: 'pending' }), true);
  assert.equal(payStateAllowsRetry('fail', { status: 'payment_failed', paymentStatus: 'failed' }), true);
  assert.equal(payStateAllowsRetry('wait', null), false);
  assert.equal(payStateAllowsRetry('idle', null), true);
});
