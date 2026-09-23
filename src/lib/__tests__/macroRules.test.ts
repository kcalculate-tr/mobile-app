import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MACRO_SETTINGS,
  liraToNextMacroAfterOrder,
  macroEarnedForOrder,
  macroProgress,
  normalizeCarryover,
  type MacroSettings,
} from '../macroRules';

// Macro kazanımı gerçek para değerindedir (5 Macro = 1 ücretsiz öğün).
// İstemcideki formül sunucudaki grant_macros_on_delivery() ile BİREBİR aynı
// olmak zorunda; ayrışırsa müşteriye "+4 Macro kazanacaksın" deyip 0
// veriyoruz (veya tersi). Sunucudaki karşılığı, 23.09.2026 itibarıyla:
//
//   v_points := profiles.macro_points;
//   if v_points < 0 or v_points >= threshold then v_points := 0; end if;
//   v_earned := floor((v_points + total_price) / threshold);
//   v_remainder := (v_points + total_price) - v_earned * threshold;
//
// Aşağıdaki testler bu dört satırı istemci tarafında sabitler.

const ayar: MacroSettings = { ...DEFAULT_MACRO_SETTINGS, earnThreshold: 500, mealCost: 5 };

// ── normalizeCarryover: aralık koruması ─────────────────────────────────────

test('devreden artık [0, eşik) aralığındaysa aynen kullanılır', () => {
  assert.equal(normalizeCarryover(0, 500), 0);
  assert.equal(normalizeCarryover(250, 500), 250);
  assert.equal(normalizeCarryover(499.99, 500), 499.99);
});

test('aralık dışı artık 0 sayılır — eski Macro modelinden devreden 1620 hatası', () => {
  // 23.09.2026: profiles.macro_points = 1620 (eski model kalıntısı) ₺585'lik
  // bir siparişte hem önizlemeyi hem GERÇEK kazanımı 4 Macro'ya şişiriyordu.
  assert.equal(normalizeCarryover(1620, 500), 0);
  assert.equal(normalizeCarryover(500, 500), 0, 'tam eşik de aralık dışıdır');
  assert.equal(normalizeCarryover(-10, 500), 0);
  assert.equal(normalizeCarryover(null, 500), 0);
  assert.equal(normalizeCarryover(undefined, 500), 0);
  assert.equal(normalizeCarryover(Number.NaN, 500), 0);
});

test('eşik geçersizse artık 0 sayılır (sıfıra bölme yok)', () => {
  assert.equal(normalizeCarryover(300, 0), 0);
  assert.equal(normalizeCarryover(300, -1), 0);
});

// ── macroEarnedForOrder: sunucu formülü ile birebir ──────────────────────────

test('kazanım: eşiğin altındaki sipariş, artık yoksa Macro kazandırmaz', () => {
  assert.equal(macroEarnedForOrder(499, { macro_balance: 0, macro_points: 0 }, ayar), 0);
});

test('kazanım: tam eşik 1, iki katı 2 Macro', () => {
  assert.equal(macroEarnedForOrder(500, { macro_balance: 0, macro_points: 0 }, ayar), 1);
  assert.equal(macroEarnedForOrder(1000, { macro_balance: 0, macro_points: 0 }, ayar), 2);
  assert.equal(macroEarnedForOrder(1499, { macro_balance: 0, macro_points: 0 }, ayar), 2);
});

test('kazanım: devreden artık hesaba katılır — eşiğin altındaki sipariş de kazandırabilir', () => {
  assert.equal(macroEarnedForOrder(200, { macro_balance: 0, macro_points: 400 }, ayar), 1);
  assert.equal(macroEarnedForOrder(100, { macro_balance: 0, macro_points: 399 }, ayar), 0);
});

test('kazanım: bozuk artık şişirme yapmaz (₺585 → 1, 4 DEĞİL)', () => {
  assert.equal(macroEarnedForOrder(585, { macro_balance: 3, macro_points: 1620 }, ayar), 1);
});

test('kazanım: tutar veya eşik geçersizse 0', () => {
  assert.equal(macroEarnedForOrder(0, { macro_balance: 0, macro_points: 0 }, ayar), 0);
  assert.equal(macroEarnedForOrder(-100, { macro_balance: 0, macro_points: 0 }, ayar), 0);
  assert.equal(macroEarnedForOrder(500, null, { ...ayar, earnThreshold: 0 }), 0);
});

test('kazanım: profil yoksa yalnız sipariş tutarı sayılır', () => {
  assert.equal(macroEarnedForOrder(1200, null, ayar), 2);
});

test('kazanım formülü sunucudaki floor((artık + tutar) / eşik) ile aynı', () => {
  const esik = ayar.earnThreshold;
  for (const artik of [0, 1, 123, 499]) {
    for (const tutar of [1, 250, 500, 585, 999, 1000, 2750]) {
      const sunucu = Math.floor((artik + tutar) / esik);
      assert.equal(
        macroEarnedForOrder(tutar, { macro_balance: 0, macro_points: artik }, ayar),
        sunucu,
        `artık=${artik} tutar=${tutar}`,
      );
    }
  }
});

// ── liraToNextMacroAfterOrder ───────────────────────────────────────────────

test('bir sonraki Macro’ya kalan tutar sunucunun artığını tamamlar', () => {
  assert.equal(liraToNextMacroAfterOrder(300, { macro_balance: 0, macro_points: 0 }, ayar), 200);
  assert.equal(liraToNextMacroAfterOrder(585, { macro_balance: 0, macro_points: 0 }, ayar), 415);
  // Tam katlarda "0 TL kaldı" DEĞİL, yeni bir tur başlar.
  assert.equal(liraToNextMacroAfterOrder(1000, { macro_balance: 0, macro_points: 0 }, ayar), 500);
  assert.equal(liraToNextMacroAfterOrder(0, { macro_balance: 0, macro_points: 0 }, ayar), 500);
});

test('kalan tutar bozuk artıktan etkilenmez', () => {
  assert.equal(liraToNextMacroAfterOrder(300, { macro_balance: 0, macro_points: 1620 }, ayar), 200);
});

// ── macroProgress: gösterim ─────────────────────────────────────────────────

test('ilerleme: bakiye öğün maliyetinin modülünü alır (5/5’te takılmaz)', () => {
  const p = macroProgress({ macro_balance: 5, macro_points: 0 }, ayar);
  assert.equal(p.balance, 5);
  assert.equal(p.mealProgress, 0);
  assert.equal(p.macrosToNextMeal, 5);
});

test('ilerleme: kısmi bakiye doğru oranı verir', () => {
  const p = macroProgress({ macro_balance: 3, macro_points: 100 }, ayar);
  assert.equal(p.macrosToNextMeal, 2);
  assert.equal(p.mealProgress, 0.6);
  assert.equal(p.liraToNextMacro, 400);
});

test('ilerleme: profil yoksa ve negatif değerlerde çökmez', () => {
  const bos = macroProgress(null, ayar);
  assert.equal(bos.balance, 0);
  assert.equal(bos.macrosToNextMeal, 5);
  const negatif = macroProgress({ macro_balance: -3, macro_points: -50 }, ayar);
  assert.equal(negatif.balance, 0);
  assert.equal(negatif.liraToNextMacro, 500);
});

test('ilerleme: mealCost 0 verilse bile sıfıra bölünmez', () => {
  const p = macroProgress({ macro_balance: 2, macro_points: 0 }, { ...ayar, mealCost: 0 });
  assert.ok(Number.isFinite(p.mealProgress));
  assert.equal(p.mealCost, 1);
});
