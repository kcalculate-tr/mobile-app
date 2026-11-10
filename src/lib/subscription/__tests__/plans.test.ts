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
  tierFromProductId,
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

test('fiyat (G23-S1): sayı + para birimi → ortak formatMoney; TRY "2999 TL" (₺ / binlik yok), diğerleri yerel biçim', () => {
  const sp = (x: string) => x.replace(/\u00a0|\u202f/g, ' ');
  assert.equal(formatStorePrice(149, 'TRY'), '149 TL');
  assert.equal(formatStorePrice(2999, 'TRY', 'tr-TR'), '2999 TL');
  assert.equal(formatStorePrice(1799, 'try', 'en-US'), '1799 TL');
  assert.equal(formatStorePrice(34.38, 'TRY'), '34,38 TL');
  assert.equal(formatStorePrice(59.99, 'USD', 'en-US'), '$59.99');
  assert.equal(sp(formatStorePrice(59.99, 'EUR', 'de-DE')), '59,99 €');
  assert.equal(formatStorePrice(4.99, 'XXZ', 'en-US').endsWith('4.99'), true, 'bilinmeyen kod çökmez');
  assert.equal(yearlyDiscountPct(499, 2999), 50);
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
    TRY('kcalai_balance_yearly', 2999, trial),
    TRY('kcalai_fresh_monthly', 149),
    TRY('kcalai_fresh:yearly', 999, trial),
    TRY('kcalai_balance_monthly', 499),
  ];
  const cards = buildPlanCards(prods);
  assert.ok(cards);
  assert.deepEqual(cards!.map((c) => c.key), ['fresh_monthly', 'fresh_yearly', 'balance_monthly', 'balance_yearly']);
  const by = cards![3];
  assert.equal(by.priceText, '2999 TL');
  assert.ok(!by.priceText.includes('₺'));
  assert.equal(by.discountPct, 50);
  assert.equal(by.trialDays, 7);
  assert.equal(by.popular, true);
  assert.equal(cards![0].weeklyText, '34,38 TL', 'aylık 149 → haftalık 149·12/52');
  assert.equal(cards![0].trialDays, null);
  assert.equal(buildPlanCards(prods.slice(1)), null);
  assert.equal(planFromProductId('KCALAI_FRESH_MONTHLY'), 'fresh_monthly');
  assert.equal(planFromProductId('other'), null);
  // G23-S1: Google Play abonelik + temel plan (RevenueCat "kcalai_fresh:monthly") önekle.
  assert.equal(planFromProductId('kcalai_fresh:monthly'), 'fresh_monthly');
  assert.equal(planFromProductId('kcalai_balance:yearly'), 'balance_yearly');
  assert.equal(planFromProductId('kcalai_balance_monthly:monthly-base'), 'balance_monthly');
  assert.equal(planFromProductId('kcalai_balance'), null, 'dönemsiz kimlik plana eşlenmez');
  assert.equal(tierFromProductId('kcalai_balance'), 'balance');
  assert.equal(tierFromProductId('kcalai_fresh:monthly'), 'fresh');
  assert.equal(tierFromProductId('baska'), null);
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
  // G23-S1: yetki kimliği beklenmedikse ürün kimliği önekinden (Google "kcalai_balance:yearly").
  const g = rcSnapshot({ entitlements: { active: { pro: { productIdentifier: 'kcalai_balance:yearly', store: 'PLAY_STORE' } } } });
  assert.equal(g.tier, 'balance');
  assert.equal(g.productId, 'kcalai_balance:yearly');
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
    { key: 'ai_daily_fresh', value: 10 },
    { key: 'ai_daily_balance', value: 50 },
    { key: 'barcode_daily_free', value: '5' },
  ]);
  assert.deepEqual(l.ai, { free: 2, fresh: 10, balance: 50 });
  assert.deepEqual(l.barcode, { free: 5, fresh: null, balance: null });
  assert.deepEqual(limitsFromSettings([]).ai, { free: null, fresh: null, balance: null });
  const aiTiles = limitTiles('ai', l, 'free');
  assert.deepEqual(aiTiles.map((x) => [x.tier, x.value, x.unlimited, x.current]), [
    ['free', 2, false, true],
    ['fresh', 10, false, false],
    ['balance', 50, false, false],
  ]);
  const bcTiles = limitTiles('barcode', l, 'free');
  assert.deepEqual(bcTiles.map((x) => [x.value, x.unlimited]), [[5, false], [null, true], [null, true]]);
});

test('hak hapı (G23-S1): N/2 · N/10 · N/50 (TR+EN; AI "Sınırsız" yok), G19 yanıtında limit yok → gizli', () => {
  const tTr = makeT('tr');
  const tEn = makeT('en');
  const free = quotaFromReserve('ai', { ok: true, remaining: 1, limit: 2, tier: 'free', unlimited: false, reset_at: 'x' });
  assert.equal(pillLabel(free, tTr), 'Bugün 1/2');
  assert.equal(pillLabel(free, tEn), 'Today 1/2');
  assert.equal(pillA11y(free, tTr), 'Bugün 2 AI taramadan 1 hakkın kaldı');
  assert.equal(pillLabel(quotaFromReserve('ai', { remaining: 9, limit: 10, tier: 'fresh' }), tTr), 'Bugün 9/10');
  const bal = quotaFromReserve('ai', { remaining: 49, limit: 50, tier: 'balance', unlimited: false });
  assert.equal(pillLabel(bal, tTr), 'Bugün 49/50');
  assert.equal(pillLabel(bal, tEn), 'Today 49/50');
  assert.equal(pillA11y(bal, tTr), 'Bugün 50 AI taramadan 49 hakkın kaldı');
  // Eski sunucu "unlimited:true" dese bile limit varsa sayı gösterilir.
  assert.equal(pillLabel(quotaFromReserve('ai', { remaining: 99, limit: 100, unlimited: true }), tTr), 'Bugün 99/100');
  // Ücretli barkod (limit null) → "Sınırsız".
  const bc = quotaFromReserve('barcode', { remaining: null, limit: null, unlimited: true, tier: 'fresh' });
  assert.equal(pillLabel(bc, tTr), 'Sınırsız');
  assert.equal(pillA11y(bc, tTr), 'Barkod tarama sınırsız');
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
