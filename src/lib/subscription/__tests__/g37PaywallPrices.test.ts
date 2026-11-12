// G37-S1 md.3 + md.1/md.2 kaynak denetimi — paywall fiyatı mağazanın para biriminden (TL/USD), USD'ye
// sabitleme ya da sabit en-US biçimi yok; tasarruf % ve "ayda N" aynı para biriminden. Zemin statik
// (kayma yok), ikon süzülmesi karuselden bağımsız tek döngü.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildPlanCards, type StoreProductLike } from '../plans';

const trial = { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' };
const mk = (cur: string, prices: [number, number, number, number], priceString: (n: number) => string): StoreProductLike[] => [
  { identifier: 'kcalai_fresh_monthly', price: prices[0], priceString: priceString(prices[0]), currencyCode: cur },
  { identifier: 'kcalai_fresh_yearly', price: prices[1], priceString: priceString(prices[1]), currencyCode: cur, introPrice: trial },
  { identifier: 'kcalai_balance_monthly', price: prices[2], priceString: priceString(prices[2]), currencyCode: cur },
  { identifier: 'kcalai_balance_yearly', price: prices[3], priceString: priceString(prices[3]), currencyCode: cur, introPrice: trial },
];

test('TRY mağazası: "999,99 TL", "ayda 83 TL", %58 — ₺ yok, para birimi TRY', () => {
  const cards = buildPlanCards(mk('TRY', [199.99, 999.99, 499.99, 2999.99], (n) => `₺${n}`));
  assert.ok(cards);
  const fy = cards.find((c) => c.key === 'fresh_yearly')!;
  const fm = cards.find((c) => c.key === 'fresh_monthly')!;
  assert.equal(fy.currency, 'TRY');
  assert.equal(fy.priceText, '999,99 TL');
  assert.equal(fm.priceText, '199,99 TL');
  assert.equal(fy.monthlyText, '83 TL');
  assert.equal(fy.discountPct, 58);
  for (const c of cards) assert.ok(!c.priceText.includes('₺') && !c.priceText.includes('$'), c.priceText);
});

test('USD mağazası: "$29.99", "ayda $2.50", %58 — aynı kod, para birimi USD (en-US yerel ayarıyla)', () => {
  const cards = buildPlanCards(mk('USD', [5.99, 29.99, 12.99, 59.99], (n) => `$${n}`), 'en-US');
  assert.ok(cards);
  const fy = cards.find((c) => c.key === 'fresh_yearly')!;
  const by = cards.find((c) => c.key === 'balance_yearly')!;
  assert.equal(fy.currency, 'USD');
  assert.equal(fy.priceText, '$29.99');
  assert.equal(fy.monthlyText, '$2.50');
  assert.equal(fy.discountPct, Math.round((1 - 29.99 / (5.99 * 12)) * 100));
  assert.equal(by.priceText, '$59.99');
  assert.equal(by.monthlyText, '$5.00');
  for (const c of cards) assert.ok(!c.priceText.includes('TL'), c.priceText);
});

test('USD mağazası TR cihazda: yine USD (TL ye çevrilmez, USD ye sabitlenmez) — tr-TR biçimi', () => {
  const cards = buildPlanCards(mk('USD', [5.99, 29.99, 12.99, 59.99], (n) => `$${n}`), 'tr-TR');
  const fy = cards!.find((c) => c.key === 'fresh_yearly')!;
  assert.match(fy.priceText, /\$/);
  assert.match(fy.priceText, /29,99/);
  assert.ok(!fy.priceText.includes('TL'));
});

test('tasarruf %: aylık ikiz farklı para birimindeyse hesaplanmaz (karışık para birimi yok)', () => {
  const p = mk('TRY', [199.99, 999.99, 499.99, 2999.99], (n) => `₺${n}`);
  p[0] = { ...p[0], currencyCode: 'USD', price: 5.99 };
  const cards = buildPlanCards(p)!;
  assert.equal(cards.find((c) => c.key === 'fresh_yearly')!.discountPct, null);
  assert.equal(cards.find((c) => c.key === 'balance_yearly')!.discountPct, 50);
});

const root = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

test('fiyat kodu: USD sabitleme / en-US biçimi yok (plans.ts, money.ts, paywall ekranları)', () => {
  for (const rel of [
    'src/lib/subscription/plans.ts',
    'src/lib/money.ts',
    'src/lib/subscription/usePlanCards.ts',
    'src/modules/subscription/screens/PaywallScreen.tsx',
    'src/modules/personalPlan/screens/PlanPaywallScreen.tsx',
  ]) {
    const code = read(rel)
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    assert.ok(!/['"]en-US['"]/.test(code), `${rel}: sabit en-US`);
    assert.ok(!/currency:\s*['"]USD['"]/.test(code), `${rel}: USD sabitleme`);
    assert.ok(!/priceString/.test(code) || rel.endsWith('plans.ts'), `${rel}: priceString doğrudan kullanılıyor`);
  }
});

test('paywall zemini statik + ikon süzülmesi karusel dışında tek bileşen', () => {
  const src = read('src/modules/subscription/screens/PaywallScreen.tsx');
  const motion = read('src/core/design/motion.tsx');
  assert.ok(!/useDrift/.test(src), 'zemin kayması kaldırıldı');
  assert.ok(!/export function useDrift/.test(motion), 'useDrift kaldırıldı');
  // Zemin içinde Animated yok.
  const glow = src.slice(src.indexOf('function PaywallGlow'), src.indexOf('function FeatureIcon'));
  assert.ok(glow.length > 0 && !/Animated\./.test(glow), 'zemin hareketsiz');
  // İkon karuselin içinde değil, tek kez çiziliyor.
  assert.equal((src.match(/<FeatureIcon /g) ?? []).length, 1);
  const strip = src.slice(src.indexOf('<Animated.ScrollView'), src.indexOf('</Animated.ScrollView>'));
  assert.ok(!/FeatureIcon|useLoopFloat|FloatingGlass/.test(strip), 'karusel sayfalarında ikon yok');
  assert.ok(/useAnimatedScrollHandler/.test(src), 'görsel seçimi UI thread kaydırma işleyicisinde');
});
