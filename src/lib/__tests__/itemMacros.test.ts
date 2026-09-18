import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMacros,
  computeBundleUnitMacros,
  computeLineMacros,
  computeProductUnitMacros,
  computeUnitMacros,
  formatMacroCompact,
  formatMacroGrams,
  formatMacroKcal,
} from '../itemMacros';

// ── Tek ürün (bundle olmayan) ───────────────────────────────────────────────

test('ürünün kendi makrosu, modifikatörsüz aynen döner', () => {
  const m = computeProductUnitMacros({ calories: 820, protein: 57, carbs: 104, fats: 19 });
  assert.deepEqual(m, { kcal: 820, protein: 57, carbs: 104, fat: 19 });
});

test('seçili opsiyon/gramaj modifikatörleri sepette makroya YANSIR (Bug 2 fix)', () => {
  const m = computeProductUnitMacros(
    { calories: 500, protein: 40, carbs: 50, fats: 15 },
    [
      { calorie_modifier: 100, protein_modifier: 10, carbs_modifier: 5, fats_modifier: 2 }, // gramaj
      { calorie_modifier: 50, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 3 }, // ekstra
    ],
  );
  assert.deepEqual(m, { kcal: 650, protein: 50, carbs: 55, fat: 20 });
});

test('ürünün taban değeri boş/0 ise modifikatör olsa bile alan "—" (null)', () => {
  const m = computeProductUnitMacros(
    { calories: 0, protein: undefined, carbs: 0, fats: null },
    [{ calorie_modifier: 50, protein_modifier: 5, carbs_modifier: 5, fats_modifier: 1 }],
  );
  assert.deepEqual(m, { kcal: null, protein: null, carbs: null, fat: null });
});

// ── Bundle ───────────────────────────────────────────────────────────────

test('bundle satırı: seçilen öğünlerin toplamı', () => {
  const m = computeBundleUnitMacros([
    { calories: 300, protein: 20, carbs: 30, fat: 10 },
    { calories: 200, protein: 15, carbs: 10, fat: 5 },
  ]);
  assert.deepEqual(m, { kcal: 500, protein: 35, carbs: 40, fat: 15 });
});

test('bundle seçimi yoksa toplanamaz -> "—" (null), 0 değil', () => {
  assert.deepEqual(computeBundleUnitMacros([]), { kcal: null, protein: null, carbs: null, fat: null });
  assert.deepEqual(computeBundleUnitMacros(undefined), { kcal: null, protein: null, carbs: null, fat: null });
});

test('computeUnitMacros: bundleSelections doluysa bundle dalı, ürün/opsiyonlar yok sayılır', () => {
  const m = computeUnitMacros({
    product: { calories: 9999, protein: 999, carbs: 999, fats: 999 },
    templateOptions: [{ calorie_modifier: 500 }],
    bundleSelections: [{ calories: 300, protein: 20, carbs: 30, fat: 10 }],
  });
  assert.deepEqual(m, { kcal: 300, protein: 20, carbs: 30, fat: 10 });
});

// ── Adet çarpımı (satır toplamı) ────────────────────────────────────────────

test('computeLineMacros: adet ile çarpılır (bundle olmayan)', () => {
  const m = computeLineMacros({
    product: { calories: 500, protein: 40, carbs: 50, fats: 15 },
    quantity: 3,
  });
  assert.deepEqual(m, { kcal: 1500, protein: 120, carbs: 150, fat: 45 });
});

test('computeLineMacros: adet ile çarpılır (bundle)', () => {
  const m = computeLineMacros({
    quantity: 2,
    bundleSelections: [{ calories: 300, protein: 20, carbs: 30, fat: 10 }],
  });
  assert.deepEqual(m, { kcal: 600, protein: 40, carbs: 60, fat: 20 });
});

test('computeLineMacros: eksik veri adetle çarpılınca da null kalır (0 olmaz)', () => {
  const m = computeLineMacros({ product: { calories: 0 }, quantity: 4 });
  assert.equal(m.kcal, null);
});

// ── Toplama ──────────────────────────────────────────────────────────────

test('addMacros: null + null = null, null + sayı = sayı', () => {
  assert.deepEqual(
    addMacros({ kcal: null, protein: null, carbs: null, fat: null }, { kcal: null, protein: 10, carbs: null, fat: null }),
    { kcal: null, protein: 10, carbs: null, fat: null },
  );
  assert.deepEqual(
    addMacros({ kcal: 100, protein: 10, carbs: 10, fat: 5 }, { kcal: 50, protein: null, carbs: 5, fat: null }),
    { kcal: 150, protein: 10, carbs: 15, fat: 5 },
  );
});

// ── Gösterim: eksik veri "—" olur, alan GİZLENMEZ ───────────────────────────

test('format fonksiyonları eksik veride "—" döner', () => {
  assert.equal(formatMacroKcal(null), '—');
  assert.equal(formatMacroGrams(null), '—');
  assert.equal(formatMacroKcal(480), '480');
  assert.equal(formatMacroGrams(42), '42g');
  assert.equal(formatMacroGrams(42.5), '42.5g');
});

test('formatMacroCompact: kcal • P • K • Y sırası, eksik alan "—"', () => {
  assert.equal(
    formatMacroCompact({ kcal: 480, protein: 42, carbs: 38, fat: 12 }),
    '480 kcal • P 42g • K 38g • Y 12g',
  );
  assert.equal(
    formatMacroCompact({ kcal: 480, protein: null, carbs: null, fat: 12 }),
    '480 kcal • P — • K — • Y 12g',
  );
});
