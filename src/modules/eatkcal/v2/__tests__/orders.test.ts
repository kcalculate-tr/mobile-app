// eatkcal v2 (G13-S2 md.6) — Siparişlerim / detay saf modeli.
// Bugünkü OrdersScreen / OrderDetailScreen / reorder.ts kurallarıyla birebir.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  firstProductId,
  allTabStatuses,
  canReorder,
  canReview,
  detailLines,
  filterOrders,
  orderCodeLabel,
  ordersViewState,
  pastOrderFromRow,
  reachedStepIndex,
  selectionSummary,
  statusBadge,
  statusesForFilter,
  stepTimes,
  trackingProgress,
} from '../model/orders';
import { tr, en } from '../i18n/orders';

test('sekme → durum kümesi bugünkü OrdersScreen ile aynı', () => {
  assert.deepEqual(statusesForFilter('active'), ['pending', 'pending_payment', 'confirmed', 'preparing', 'on_way', 'ready']);
  assert.deepEqual(statusesForFilter('past'), ['delivered']);
  assert.deepEqual(statusesForFilter('cancelled'), ['cancelled', 'payment_failed', 'refunded']);
  // "Tümü" = ACTIVE + PAST; 'cancelled' bugünkü "Tümü"de yok.
  assert.deepEqual(statusesForFilter('all'), [
    'pending', 'pending_payment', 'confirmed', 'preparing', 'on_way', 'ready',
    'delivered', 'payment_failed', 'refunded',
  ]);
  assert.ok(!statusesForFilter('all').includes('cancelled'));
  assert.ok(!allTabStatuses().includes('expired'));
});

test('tek sorgu + istemci süzmesi her sekmede sekme sorgusuyla aynı sonucu verir', () => {
  const statuses = ['pending_payment', 'on_way', 'delivered', 'cancelled', 'refunded', 'payment_failed', 'preparing'];
  const rows = statuses.map((status, id) => ({ id, status }));
  // Tek sorgu tüm sekmelerin birleşimini çeker:
  const fetched = rows.filter((r) => allTabStatuses().includes(r.status));
  for (const f of ['all', 'active', 'past', 'cancelled'] as const) {
    const perTabQuery = rows.filter((r) => statusesForFilter(f).includes(r.status));
    assert.deepEqual(filterOrders(fetched, f), perTabQuery, f);
  }
});

test('görünüm durumu: boş · sonuçsuz filtre · liste', () => {
  assert.equal(ordersViewState([], 'all'), 'empty');
  assert.equal(ordersViewState([], 'cancelled'), 'empty');
  assert.equal(ordersViewState([{ status: 'delivered' }], 'cancelled'), 'filter_empty');
  assert.equal(ordersViewState([{ status: 'delivered' }], 'past'), 'list');
});

test('rozet: takip edilen durumlar lime (aktif), iptal/başarısız olumsuz, bilinmeyen güvenli', () => {
  assert.equal(statusBadge('on_way').tone, 'active');
  assert.equal(statusBadge('delivered').tone, 'neutral');
  assert.equal(statusBadge('refunded').tone, 'neutral');
  assert.equal(statusBadge('payment_failed').tone, 'negative');
  assert.equal(statusBadge('weird').key, 'unknown');
  // Her rozet anahtarının TR + EN metni var.
  for (const s of ['pending', 'pending_payment', 'confirmed', 'preparing', 'on_way', 'ready', 'delivered', 'cancelled', 'payment_failed', 'refunded', 'unknown']) {
    assert.ok((tr.orders.status as Record<string, string>)[s], `tr ${s}`);
    assert.ok((en.orders.status as Record<string, string>)[s], `en ${s}`);
  }
});

test('kod etiketi: order_code yoksa id’den', () => {
  assert.equal(orderCodeLabel({ id: 42, order_code: 'KCAL-1234' }), 'KCAL-1234');
  assert.equal(orderCodeLabel({ id: 42, order_code: null }), '#42');
});

test('aşamalar getTrackingProgress eşlemesinden', () => {
  assert.equal(trackingProgress('pending_payment'), 0);
  assert.equal(reachedStepIndex('pending_payment'), -1);
  assert.equal(reachedStepIndex('cancelled'), -1);
  assert.equal(reachedStepIndex('confirmed'), 0);
  assert.equal(reachedStepIndex('preparing'), 1);
  assert.equal(reachedStepIndex('ready'), 2);
  assert.equal(reachedStepIndex('on_way'), 2);
  assert.equal(reachedStepIndex('delivered'), 3);
});

test('saatler yalnız veri olan adımlarda (uydurma saat yok)', () => {
  assert.deepEqual(stepTimes({ status: 'on_way', created_at: '2026-11-06T10:00:00Z', delivered_at: null }), {
    received: '2026-11-06T10:00:00Z',
  });
  assert.deepEqual(
    stepTimes({ status: 'delivered', created_at: '2026-11-06T10:00:00Z', delivered_at: '2026-11-06T10:40:00Z' }),
    { received: '2026-11-06T10:00:00Z', delivered: '2026-11-06T10:40:00Z' },
  );
  assert.deepEqual(stepTimes({ status: 'pending_payment', created_at: '2026-11-06T10:00:00Z' }), {});
});

test('tekrar sipariş: reorder.ts REORDERABLE_STATUSES + toItems ile aynı PastOrder', () => {
  assert.ok(canReorder('delivered'));
  assert.ok(canReorder('confirmed'));
  assert.ok(!canReorder('cancelled'));
  assert.ok(!canReorder('pending_payment'));
  const po = pastOrderFromRow({
    id: 7,
    order_code: 'KCAL-7',
    created_at: '2026-11-06T10:00:00Z',
    total_amount: 350,
    items: [
      { id: 12, name: 'Tavuk Bowl', quantity: 2, calories: 500, legacy_selected_options: { labels: ['Basmati'] } },
      { name: 'id yok — atlanır' },
      { id: '13', quantity: 0, calories: -5 },
    ],
  });
  assert.equal(po.items.length, 2);
  assert.deepEqual(po.items[0], {
    id: '12', name: 'Tavuk Bowl', quantity: 2, options: { labels: ['Basmati'] }, calories: 500, imageUrl: null,
  });
  assert.deepEqual(po.items[1], { id: '13', name: 'Ürün', quantity: 1, options: {}, calories: 0, imageUrl: null });
  assert.equal(po.totalCalories, 1000);
});

test('ürün satırları: items JSON (seçim özetiyle), yoksa order_items', () => {
  const fromJson = detailLines({
    items: [
      {
        id: 42,
        name: 'Tavuk Bowl',
        quantity: 1,
        unit_price: 300,
        total_price: 300,
        legacy_selected_options: { labels: ['Basmati'] },
        selected_options: [{ value_name: 'Izgara Tavuk 150 g' }, { value_name: 'Maş Fasulye' }],
      },
    ],
    order_items: [{ product_name: 'X', quantity: 9, total_price: 1 }],
  });
  assert.deepEqual(fromJson, [{ name: 'Tavuk Bowl', productId: '42', quantity: 1, totalPrice: 300, summary: 'Basmati · Izgara Tavuk 150 g · Maş Fasulye' }]);
  const fromRel = detailLines({ items: [], order_items: [{ product_name: 'Somon', quantity: 2, total_price: 640 }] });
  assert.deepEqual(fromRel, [{ name: 'Somon', productId: null, quantity: 2, totalPrice: 640, summary: '' }]);
  assert.equal(selectionSummary({}), '');
});

test('G15-S5: liste satırı fotoğrafı için ilk ürün id (orders.items)', () => {
  assert.equal(firstProductId([{ id: 7 }, { id: 9 }]), '7');
  assert.equal(firstProductId([{ name: 'x' }, { id: 'a1' }]), 'a1');
  assert.equal(firstProductId(null), null);
  assert.equal(firstProductId([]), null);
});

test('değerlendir yalnız mevcut fetchPendingFeedbackOrder bu siparişi döndürünce', () => {
  assert.equal(canReview(5, null), false);
  assert.equal(canReview(5, { id: 4 }), false);
  assert.equal(canReview(5, { id: 5 }), true);
});

test('i18n: tr ve en aynı anahtarlara sahip', () => {
  const keys = (o: unknown, p = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
    );
  assert.deepEqual(keys(en).sort(), keys(tr).sort());
});
