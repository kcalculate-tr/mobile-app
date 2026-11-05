// eatkcal v2 — Ana sayfa / Mağaza saf yardımcıları (G13-S2 md.1–2).
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bannerTargetToEk,
  cardKcal,
  cardPrice,
  deliveryChip,
  distinctBrandKeys,
  filterByCategory,
  filterProductsByQuery,
  liveStepIndex,
  macroStrip,
  pickZoneRowForAddress,
  storeCategories,
} from '../model/homeData';
import { DEFAULT_MACRO_SETTINGS } from '../../../../lib/macroRules';

test('liveStepIndex: activeOrder.ts ORDER_STEPS sırası; bilinmeyen → -1', () => {
  assert.equal(liveStepIndex('confirmed'), 0);
  assert.equal(liveStepIndex('preparing'), 1);
  assert.equal(liveStepIndex('on_way'), 2);
  assert.equal(liveStepIndex('delivered'), 3);
  assert.equal(liveStepIndex('pending_payment'), -1);
  assert.equal(liveStepIndex(null), -1);
});

test('distinctBrandKeys: katalog sırası, tekil, boşlar atlanır', () => {
  const keys = distinctBrandKeys([
    { brand: 'kcalculate' },
    { brand: 'tera' },
    { brand: null },
    { brand: 'kcalculate' },
    { brand: ' breaking-fast ' },
    { brand: '' },
  ]);
  assert.deepEqual(keys, ['kcalculate', 'tera', 'breaking-fast']);
});

test('filterProductsByQuery: HomeScreen ile aynı (ad içinde, küçük harf); boş sorgu → hepsi', () => {
  const list = [{ name: 'Izgara Tavuk' }, { name: 'Somon Bowl' }];
  assert.equal(filterProductsByQuery(list, '').length, 2);
  assert.deepEqual(filterProductsByQuery(list, 'tavuk'), [{ name: 'Izgara Tavuk' }]);
  assert.deepEqual(filterProductsByQuery(list, '  SOMON '), [{ name: 'Somon Bowl' }]);
});

test('storeCategories / filterByCategory: yalnız mağazada geçen kategoriler', () => {
  const cats = [{ name: 'Tüm Ürünler' }, { name: 'Yüksek protein' }, { name: 'Yağ yakımı' }];
  const prods = [{ category: 'Yağ yakımı' }, { category: 'Yağ yakımı' }, { category: null }];
  assert.deepEqual(storeCategories(cats, prods), ['Yağ yakımı']);
  assert.equal(filterByCategory(prods, 'Yağ yakımı').length, 2);
  assert.equal(filterByCategory(prods, null).length, 3);
});

test('bannerTargetToEk: mevcut navigate_to önekleri v2 rotalarına', () => {
  assert.deepEqual(bannerTargetToEk('ProductDetail: 42'), { kind: 'product', productId: '42' });
  assert.deepEqual(bannerTargetToEk('BrandLanding:tera'), { kind: 'store', brandKey: 'tera' });
  assert.deepEqual(bannerTargetToEk('CategoryProducts:Yağ yakımı'), { kind: 'category', categoryName: 'Yağ yakımı' });
  assert.deepEqual(bannerTargetToEk('Offers'), { kind: 'legacy', dest: 'Offers' });
  assert.deepEqual(bannerTargetToEk(''), { kind: 'none' });
  assert.deepEqual(bannerTargetToEk('ProductDetail:'), { kind: 'none' });
});

test('macroStrip: macroProgress ile aynı (5 Macro = 1 öğün)', () => {
  const s = macroStrip({ macro_balance: 3, macro_points: 0 }, DEFAULT_MACRO_SETTINGS);
  assert.deepEqual(s, { toNext: 2, total: 5, filled: 3 });
  const none = macroStrip(null, DEFAULT_MACRO_SETTINGS);
  assert.deepEqual(none, { toNext: 5, total: 5, filled: 0 });
});

test('pickZoneRowForAddress: ilçe + mahalle eşleşmesi (tr-TR), mahalle yoksa ilk satır', () => {
  const rows = [
    { district: 'Konak', neighbourhood: 'Alsancak', estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 55 },
    { district: 'Konak', neighborhood: 'İsmet Kaptan', estimated_delivery_minutes: 40 },
  ];
  assert.equal(pickZoneRowForAddress(rows, { district: 'Konak', neighbourhood: 'alsancak' }), rows[0]);
  assert.equal(pickZoneRowForAddress(rows, { district: 'Konak', neighbourhood: 'İSMET KAPTAN' }), rows[1]);
  assert.equal(pickZoneRowForAddress(rows, { district: 'Konak', neighbourhood: null }), rows[0]);
  assert.equal(pickZoneRowForAddress(rows, { district: 'Konak', neighbourhood: 'Yok' }), null);
  assert.equal(pickZoneRowForAddress(rows, { district: 'Bornova', neighbourhood: null }), null);
  assert.equal(pickZoneRowForAddress(rows, null), null);
});

test('deliveryChip: süre verisi yoksa gizli; hemen yalnız dükkan açık + bölge izinli', () => {
  assert.equal(deliveryChip(null, true), null);
  assert.equal(deliveryChip({ district: 'Konak' }, true), null);
  assert.deepEqual(deliveryChip({ estimated_delivery_minutes: 30, estimated_delivery_minutes_max: 55 }, true), {
    estimate: '30-55 dk',
    immediate: true,
  });
  assert.equal(deliveryChip({ estimated_delivery_minutes: 30, allow_immediate: false }, true)?.immediate, false);
  assert.equal(deliveryChip({ estimated_delivery_minutes: 30 }, false)?.immediate, false);
});

test('cardPrice / cardKcal: utils/price ile; veri yoksa rozet gizli', () => {
  assert.deepEqual(cardPrice({ price: 200 }), { now: 200, before: null });
  const d = cardPrice({ price: 200, discount_type: 'percent', discount_value: 10 });
  assert.equal(d.before, 200);
  assert.equal(d.now, 180);
  assert.equal(cardKcal({ calories: 512.4 }), 512);
  assert.equal(cardKcal({ calories: 0 }), null);
  assert.equal(cardKcal({}), null);
});
