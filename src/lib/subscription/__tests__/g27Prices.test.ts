// G27-S1 md.2 — mağaza fiyatları. G31-S1 md.3: TL ,99'lu (199,99 / 999,99 / 499,99 / 2999,99);
// USD Fresh $5.99 / $29.99, Balance $12.99 / $59.99.
// Rozet ve haftalık karşılık mağaza fiyatından hesaplanır; kodda / i18n'de sabit fiyat
// ya da sabit indirim yüzdesi kalmadı; demo fiyatlar yalnız test/vitrin kaynağında.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPlanCards, weeklyPrice, yearlyDiscountPct, type StoreProductLike } from '../plans';
import { DEMO_PRICES_TRY, DEMO_PRICES_USD_BALANCE, DEMO_PRICES_USD_FRESH } from '../demoPrices';

const ROOT = path.resolve(__dirname, '../../../..');

test('demo fiyatlar 199,99 / 999,99 / 499,99 / 2999,99 TL; USD Fresh $5.99 / $29.99, Balance $12.99 / $59.99', () => {
  assert.deepEqual({ ...DEMO_PRICES_TRY }, { fresh_monthly: 199.99, fresh_yearly: 999.99, balance_monthly: 499.99, balance_yearly: 2999.99 });
  assert.deepEqual({ ...DEMO_PRICES_USD_FRESH }, { monthly: 5.99, yearly: 29.99 });
  assert.deepEqual({ ...DEMO_PRICES_USD_BALANCE }, { monthly: 12.99, yearly: 59.99 });
});

test('rozetler mağaza fiyatından: Fresh %58, Balance %50', () => {
  assert.equal(yearlyDiscountPct(DEMO_PRICES_TRY.fresh_monthly, DEMO_PRICES_TRY.fresh_yearly), 58);
  assert.equal(yearlyDiscountPct(DEMO_PRICES_TRY.balance_monthly, DEMO_PRICES_TRY.balance_yearly), 50);
  // Fiyat değişirse rozet kendiliğinden değişir (sabit yüzde yok).
  assert.equal(yearlyDiscountPct(149, 999), 44);
});

test('haftalık karşılıklar mağaza fiyatından ve kartlarda TL biçiminde', () => {
  const P = (identifier: string, price: number): StoreProductLike => ({
    identifier,
    price,
    priceString: `${price}`,
    currencyCode: 'TRY',
    introPrice: null,
  });
  const cards = buildPlanCards([
    P('kcalai_fresh_monthly', DEMO_PRICES_TRY.fresh_monthly),
    P('kcalai_fresh_yearly', DEMO_PRICES_TRY.fresh_yearly),
    P('kcalai_balance_monthly', DEMO_PRICES_TRY.balance_monthly),
    P('kcalai_balance_yearly', DEMO_PRICES_TRY.balance_yearly),
  ]);
  assert.ok(cards);
  assert.deepEqual(
    cards!.map((c) => [c.priceText, c.weeklyText, c.discountPct]),
    [
      ['199,99 TL', '46,15 TL', null],
      ['999,99 TL', '19,23 TL', 58],
      ['499,99 TL', '115,38 TL', null],
      ['2999,99 TL', '57,69 TL', 50],
    ],
  );
  assert.equal(Math.round(weeklyPrice(P('x', 199), false) * 100) / 100, 45.92);
});

function trackedSources(): string[] {
  const out = execFileSync('git', ['ls-files', 'src', 'App.tsx', 'locales'], { cwd: ROOT }).toString('utf8');
  return out
    .split('\n')
    .filter((f) => /\.(tsx?|json)$/.test(f))
    .filter((f) => !/__tests__|__component_tests__|__snapshots__/.test(f))
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
}

test('kodda / i18n\'de sabit eski fiyat (149 TL) ya da sabit indirim rozeti (%44) yok', () => {
  const bad: string[] = [];
  for (const f of trackedSources()) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/(?<![\d.,])149\s?TL|%\s?44(?!\d)|(?<![\d.,])44\s?%|34,38/.test(s)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

test('demo fiyatlar uygulama kodundan içe aktarılmaz (yedek fiyat YOK)', () => {
  const bad = trackedSources().filter((f) => {
    if (f.endsWith('demoPrices.ts') || f.startsWith('src/dev/')) return false;
    return /demoPrices['"]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
  assert.deepEqual(bad, []);
});
