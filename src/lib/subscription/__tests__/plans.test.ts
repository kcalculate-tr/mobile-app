// G22-S1 md.3/md.4 — kcalAI planları: kart matematiği (FinMoSub), fiyat, kademe çözümü, hak sınırları.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_STEP,
  buildPlanCards,
  cardVisual,
  formatStorePrice,
  initialCard,
  planFromProductId,
  resolveTier,
  selectedCard,
  stripFor,
  tierFromEntitlements,
  trialDays,
  yearlyDiscountPct,
  type StoreProductLike,
} from '../plans';
import { barcodeAllowed, limitTiles, limitsFromSettings, pillA11y, pillLabel, quotaFromReserve } from '../limits';
import { purchaseErrorResult, rcSnapshot } from '../rc';
import { translations } from '../../../core/i18n/dictionaries';

// Basit t(): sözlükten yaprak + %{x} doldurma (i18n çekirdeğine bağımlı olmadan).
function makeT(lang: 'tr' | 'en') {
  return (key: string, opts: Record<string, unknown> = {}) => {
    let cur: unknown = translations[lang];
    for (const p of key.split('.')) cur = (cur as Record<string, unknown>)?.[p];
    if (typeof cur !== 'string') throw new Error(`anahtar yok: ${key}`);
    return cur.replace(/%\{(\w+)\}/g, (_m, k: string) => String(opts[k]));
  };
}

const TRY = (id: string, price: number, intro?: StoreProductLike['introPrice']): StoreProductLike => ({
  identifier: id,
  price,
  priceString: `₺${price}`,
  currencyCode: 'TRY',
  introPrice: intro ?? null,
});

test('kart matematiği: ölçek 1−0.14·d, opaklık 1−0.45·d, d = |kart−merkez|/261 (doyar)', () => {
  assert.equal(CARD_STEP, 261);
  const c = cardVisual(1, 261);
  assert.deepEqual({ d: c.d, scale: c.scale, opacity: c.opacity, frame: c.frame }, { d: 0, scale: 1, opacity: 1, frame: 1 });
  const half = cardVisual(1, 261 + 130.5);
  assert.ok(Math.abs(half.scale - 0.93) < 1e-9 && Math.abs(half.opacity - 0.775) < 1e-9);
  const far = cardVisual(0, 3 * 261);
  assert.ok(Math.abs(far.scale - 0.86) < 1e-9 && Math.abs(far.opacity - 0.55) < 1e-9 && far.frame === 0);
  assert.equal(cardVisual(0, 261, true).scale, 1, 'azaltılmış harekette ölçek sabit');
});

test('snap: seçili kart yuvarlanır ve sınırlanır; açılış kartı + şerit', () => {
  assert.equal(selectedCard(0), 0);
  assert.equal(selectedCard(261 * 1.49), 1);
  assert.equal(selectedCard(261 * 1.51), 2);
  assert.equal(selectedCard(99999), 3);
  assert.equal(selectedCard(-50), 0);
  assert.equal(initialCard(), 3, 'varsayılan Balance Yıllık');
  assert.equal(initialCard('fresh', false), 0);
  assert.equal(stripFor(1), 'fresh');
  assert.equal(stripFor(2), 'balance');
});

test('fiyat: TRY ortak biçimlendirici (₺ yok, binlik nokta yok); diğer para birimi mağaza dizesi', () => {
  assert.equal(formatStorePrice(149, 'TRY', '₺149,00'), '149 TL');
  assert.equal(formatStorePrice(1799, 'TRY', '₺1.799,00'), '1799 TL');
  assert.equal(formatStorePrice(34.38, 'TRY', null), '34,38 TL');
  assert.equal(formatStorePrice(4.99, 'USD', '$4.99'), '$4.99');
  assert.equal(yearlyDiscountPct(249, 1799), 40);
  assert.equal(yearlyDiscountPct(149, 999), 44);
  assert.equal(yearlyDiscountPct(null, 999), null);
  assert.equal(trialDays(TRY('x', 1, { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' })), 7);
  assert.equal(trialDays(TRY('x', 1, { price: 0, periodNumberOfUnits: 1, periodUnit: 'WEEK' })), 7);
  assert.equal(trialDays(TRY('x', 1, { price: 9, periodNumberOfUnits: 1, periodUnit: 'MONTH' })), null);
});

test('buildPlanCards: 4 kart sırayla; eksik ürün → null (yedek fiyat YOK)', () => {
  const trial = { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' };
  const prods = [
    TRY('kcalai_balance_yearly', 1799, trial),
    TRY('kcalai_fresh_monthly', 149),
    TRY('kcalai_fresh_yearly:yearly-base', 999, trial),
    TRY('kcalai_balance_monthly', 249),
  ];
  const cards = buildPlanCards(prods);
  assert.ok(cards);
  assert.deepEqual(cards!.map((c) => c.key), ['fresh_monthly', 'fresh_yearly', 'balance_monthly', 'balance_yearly']);
  const by = cards![3];
  assert.equal(by.priceText, '1799 TL');
  assert.equal(by.discountPct, 40);
  assert.equal(by.trialDays, 7);
  assert.equal(by.popular, true);
  assert.equal(cards![0].weeklyText, '34,38 TL', 'aylık 149 → haftalık 149·12/52');
  assert.equal(cards![0].trialDays, null);
  assert.equal(buildPlanCards(prods.slice(1)), null);
  assert.equal(planFromProductId('KCALAI_FRESH_MONTHLY'), 'fresh_monthly');
  assert.equal(planFromProductId('other'), null);
});

test('kademe: RevenueCat yetkisi önce, sunucu doğrular', () => {
  assert.equal(tierFromEntitlements(['fresh', 'balance']), 'balance');
  assert.equal(tierFromEntitlements([]), 'free');
  assert.deepEqual(resolveTier('fresh', 'fresh'), { tier: 'fresh', status: 'verified' });
  assert.deepEqual(resolveTier('balance', 'free'), { tier: 'balance', status: 'pending' }, 'webhook gecikmesi');
  assert.deepEqual(resolveTier('free', 'fresh'), { tier: 'fresh', status: 'verified' }, 'başka cihazda satın alındı');
  assert.deepEqual(resolveTier(null, 'fresh'), { tier: 'fresh', status: 'server_only' });
  assert.deepEqual(resolveTier(null, null), { tier: 'free', status: 'unknown' });
  const snap = rcSnapshot({
    entitlements: { active: { fresh: { productIdentifier: 'kcalai_fresh_yearly', expirationDate: '2026-11-17T00:00:00Z', willRenew: true, periodType: 'TRIAL', store: 'APP_STORE' } } },
    managementURL: 'https://apps.apple.com/account/subscriptions',
  });
  assert.deepEqual(
    { tier: snap.tier, trial: snap.trial, pid: snap.productId },
    { tier: 'fresh', trial: true, pid: 'kcalai_fresh_yearly' },
  );
  assert.equal(rcSnapshot(null).tier, 'free');
});

test('satın alma hata kodu → sonuç (iptal / bekliyor / hata)', () => {
  assert.equal(purchaseErrorResult({ code: '1', userCancelled: true }), 'cancelled');
  assert.equal(purchaseErrorResult({ code: 'PAYMENT_PENDING_ERROR' }), 'pending');
  assert.equal(purchaseErrorResult({ code: '20' }), 'pending');
  assert.equal(purchaseErrorResult(new Error('network')), 'error');
});

test('hak sınırları: app_settings → limitler; kod sabiti yok, eksik anahtar null', () => {
  const l = limitsFromSettings([
    { key: 'ai_daily_free', value: 2 },
    { key: 'ai_daily_fresh', value: 15 },
    { key: 'ai_daily_balance', value: 100 },
    { key: 'barcode_daily_free', value: '5' },
  ]);
  assert.deepEqual(l.ai, { free: 2, fresh: 15, balance: 100 });
  assert.deepEqual(l.barcode, { free: 5, fresh: null, balance: null });
  assert.deepEqual(limitsFromSettings([]).ai, { free: null, fresh: null, balance: null });
  const aiTiles = limitTiles('ai', l, 'free');
  assert.deepEqual(aiTiles.map((x) => [x.tier, x.value, x.unlimited, x.current]), [
    ['free', 2, false, true],
    ['fresh', 15, false, false],
    ['balance', null, true, false],
  ]);
  const bcTiles = limitTiles('barcode', l, 'free');
  assert.deepEqual(bcTiles.map((x) => [x.value, x.unlimited]), [[5, false], [null, true], [null, true]]);
});

test('hak hapı: N/2 · N/15 · Sınırsız (TR+EN), G19 yanıtında limit yok → gizli', () => {
  const tTr = makeT('tr');
  const tEn = makeT('en');
  const free = quotaFromReserve('ai', { ok: true, remaining: 1, limit: 2, tier: 'free', unlimited: false, reset_at: 'x' });
  assert.equal(pillLabel(free, tTr), 'Bugün 1/2');
  assert.equal(pillLabel(free, tEn), 'Today 1/2');
  assert.equal(pillA11y(free, tTr), 'Bugün 2 AI taramadan 1 hakkın kaldı');
  assert.equal(pillLabel(quotaFromReserve('ai', { remaining: 9, limit: 15, tier: 'fresh' }), tTr), 'Bugün 9/15');
  assert.equal(pillLabel(quotaFromReserve('ai', { remaining: 99, limit: 100, unlimited: true }), tTr), 'Sınırsız');
  const g19 = quotaFromReserve('ai', { ok: true, remaining: 2, reset_at: 'x' });
  assert.equal(g19.limit, null);
  assert.equal(pillLabel(g19, tTr), null);
  assert.equal(pillLabel(g19, tTr, 3), 'Bugün 2/3', 'eski sunucu: bilinen tavanla');
});

test('barkod hakkı: RPC yok/ağ hatası → izin (fail-open); ok:false → limit', () => {
  assert.equal(barcodeAllowed(null, true), true);
  assert.equal(barcodeAllowed({ ok: false }, false), false);
  assert.equal(barcodeAllowed({ ok: true }, false), true);
});
