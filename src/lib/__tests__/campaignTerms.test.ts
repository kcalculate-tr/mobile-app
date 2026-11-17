// 16 Kas — kampanya koşulları yalnız gerçek alanlardan üretilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignTerms } from '../campaignTerms';

const fmt = (d: string) => d;

test('HOSGELDIN250: ilk sipariş + 650 TL alt sınır + kişi başı 1 + tek kupon', () => {
  const keys = campaignTerms({ first_order_only: true, min_cart_total: 650, max_uses_per_user: 1, discount_type: 'fixed', max_discount: 0 }, fmt).map((t) => t.key);
  assert.deepEqual(keys, ['coupons_term_first', 'coupons_term_min', 'coupons_term_uses_one', 'coupons_term_single']);
});

test('yüzde: tavan + tarih aralığı + hariç kategoriler', () => {
  const t = campaignTerms({ discount_type: 'percent', max_discount: 100, start_date: '2026-11-01', end_date: '2026-11-30', excluded_categories: ['Koli'] }, fmt);
  assert.deepEqual(t.find((x) => x.key === 'coupons_term_max')?.params, { n: 100 });
  assert.deepEqual(t.find((x) => x.key === 'coupons_term_dates')?.params, { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(t.find((x) => x.key === 'coupons_term_excluded')?.params, { list: 'Koli' });
});

test('boş alanlar madde üretmez (yalnız tek kupon)', () => {
  assert.deepEqual(campaignTerms({ min_cart_total: 0, max_uses_per_user: null }, fmt).map((t) => t.key), ['coupons_term_single']);
});

test('G58-S2: free_item → "1 öğün ücretsiz" şartı ilk madde; üst sınır varsa yazılır', () => {
  const t = campaignTerms({ discount_type: 'free_item', max_discount: 350, max_uses_per_user: 1, end_date: '2026-12-17' }, fmt);
  assert.equal(t[0].key, 'coupons_term_free_meal');
  assert.deepEqual(t.find((x) => x.key === 'coupons_term_free_meal_max')?.params, { n: 350 });
  assert.ok(!t.some((x) => x.key === 'coupons_term_max'), 'yüzde tavanı maddesi free_item için yazılmaz');
  const unlimited = campaignTerms({ discount_type: 'free_item', max_discount: 0 }, fmt).map((x) => x.key);
  assert.ok(unlimited.includes('coupons_term_free_meal'));
  assert.ok(!unlimited.includes('coupons_term_free_meal_max'), 'üst sınır boş → sınırsız, madde yok');
});
