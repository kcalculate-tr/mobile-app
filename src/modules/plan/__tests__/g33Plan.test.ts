// G33-S1 md.10 — Öğün planı saf mantık: makro hesabı (USDA), algoritma (±%5, filtre, determinizm,
// eatkcal, koru), alışveriş birleştirme, hafta yardımcıları, kademe kuralları.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { SEED_INGREDIENTS, SEED_RECIPES } from '../data/seed';
import { ingredientMap, recipeMacros, seedRecipeInfos, scaleMacros } from '../nutrition';
import { candidatePlans, generatePlan, quantizePortion, summarizeForCoach, within, type GenerateInput } from '../generate';
import { buildShoppingList, displayQuantity, eatkcalMeals, groupShopping, recipeCountOf } from '../shopping';
import { addDaysKey, rollingWeeks, spanLabel, weekDays, weekRange, weekStartOf, weekdayIndex, dayTitle } from '../week';
import { planAccess } from '../access';
import { ALLERGENS, SLOTS, type PlanItem } from '../types';

const recipes = seedRecipeInfos();
const ING = ingredientMap();
const RMAP = new Map(SEED_RECIPES.map((r) => [r.key, r]));
const days = weekDays('2026-11-09').slice(2); // Çar–Paz, 5 gün

const base: GenerateInput = {
  recipes,
  days,
  target: { kcal: 2180, protein: 140 },
  diet: 'all',
  avoid: [],
  eatkcal: null,
  keep: [],
  keepPlanned: true,
  variant: 0,
};

test('tohum: 40 tarif (her yuvada 10), her malzemede FDC ID ve USDA 100 g değerleri', () => {
  assert.equal(SEED_RECIPES.length, 40);
  for (const s of SLOTS) assert.equal(SEED_RECIPES.filter((r) => r.slot === s).length, 10, s);
  for (const i of SEED_INGREDIENTS) {
    assert.ok(Number.isInteger(i.fdcId) && i.fdcId > 100000, i.key);
    assert.ok(i.per100.kcal >= 0 && i.per100.protein >= 0 && i.per100.carbs >= 0 && i.per100.fat >= 0, i.key);
  }
});

test('makro malzemeden HESAPLANIR: menemen = Σ gram/100 × USDA değeri', () => {
  const r = RMAP.get('menemen')!;
  const m = recipeMacros(r, ING);
  let k = 0;
  for (const { key, grams } of r.ingredients) k += (grams / 100) * ING.get(key)!.per100.kcal;
  assert.equal(m.kcal, Math.round(k));
  // Yumurta 171287: 143 kcal/100 g (USDA SR Legacy).
  assert.equal(ING.get('egg')!.fdcId, 171287);
  assert.equal(ING.get('egg')!.per100.kcal, 143);
});

test('SQL tohumu ile uygulama hesabı aynı (gen.mjs ↔ nutrition.ts)', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../../supabase/migrations/20261112100200_g33_recipe_seed.sql'), 'utf8');
  for (const r of recipes) {
    const re = new RegExp(`\\('${r.key}', '[^']*', '[^']*', '${r.slot}', ${r.macros.kcal}, ${r.macros.protein}, ${r.macros.carbs}, ${r.macros.fat},`);
    assert.match(sql, re, r.key);
  }
});

test('alerjen etiketleri malzemeden: menemen yumurta+gluten, somon deniz ürünü', () => {
  const by = new Map(recipes.map((r) => [r.key, r]));
  assert.deepEqual(by.get('menemen')!.allergens, ['egg', 'gluten']);
  assert.ok(by.get('somon_kinoa')!.allergens.includes('seafood'));
  assert.ok(by.get('tofu_sote')!.diets.includes('vegan'));
  assert.ok(!by.get('tavuk_sote')!.diets.includes('vegetarian'));
});

test('algoritma: her gün kcal ±%5, protein mümkün olduğunca yakın; 4 yuva dolu', () => {
  const r = generatePlan(base);
  assert.equal(r.days.length, 5);
  for (const d of r.days) {
    assert.ok(within(d.kcal, 2180), `${d.date} ${d.kcal}`);
    assert.equal(r.items.filter((x) => x.date === d.date).length, 4);
  }
  assert.ok(r.days.filter((d) => d.withinTolerance).length >= 3, JSON.stringify(r.days));
});

test('algoritma DETERMİNİSTİK: aynı girdi = aynı plan; variant değişince farklı', () => {
  const a = generatePlan(base).items.map((x) => `${x.date}:${x.slot}:${x.refId}:${x.portion}`);
  const b = generatePlan(base).items.map((x) => `${x.date}:${x.slot}:${x.refId}:${x.portion}`);
  const c = generatePlan({ ...base, variant: 1 }).items.map((x) => `${x.date}:${x.slot}:${x.refId}:${x.portion}`);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('alerjen filtresi: fıstık/süt seçiliyse içeren tarif plana girmez', () => {
  const r = generatePlan({ ...base, avoid: ['peanut', 'milk'] });
  const by = new Map(recipes.map((x) => [x.key, x]));
  for (const it of r.items) {
    const info = by.get(it.refId!)!;
    assert.ok(!info.allergens.includes('peanut') && !info.allergens.includes('milk'), it.refId!);
  }
  assert.ok(r.excludedByAllergen > 0);
});

test('diyet filtresi: vegan → yalnız vegan tarifler', () => {
  const r = generatePlan({ ...base, diet: 'vegan' });
  const by = new Map(recipes.map((x) => [x.key, x]));
  for (const it of r.items) assert.ok(by.get(it.refId!)!.diets.includes('vegan'), it.refId!);
});

const eatkcal = [
  { id: 'p1', name: 'KCAL Tavuklu Bowl', kcal: 560, protein: 45, carbs: 50, fat: 18, price: 285 },
  { id: 'p2', name: 'Izgara Somon Bowl', kcal: 520, protein: 40, carbs: 40, fat: 20, price: 320 },
];

test('eatkcal dahil: seçili günlerin 1., 3., 5.si öğle eatkcal; alerjen filtresi varsa önerilmez', () => {
  const r = generatePlan({ ...base, eatkcal });
  assert.deepEqual(r.eatkcalDays, [days[0], days[2], days[4]]);
  for (const d of r.eatkcalDays) {
    const lunch = r.items.find((x) => x.date === d && x.slot === 'lunch')!;
    assert.equal(lunch.source, 'eatkcal');
  }
  for (const d of r.days) assert.ok(within(d.kcal, 2180), `${d.date} ${d.kcal}`);
  assert.equal(generatePlan({ ...base, eatkcal, avoid: ['gluten'] }).eatkcalDays.length, 0);
  assert.equal(generatePlan({ ...base, eatkcal: null }).eatkcalDays.length, 0);
});

test('"Planladığım öğünleri koru": dolu yuva aynen kalır; kapalıyken yeniden doldurulur', () => {
  const mine: PlanItem = { id: 'k1', date: days[0], slot: 'dinner', source: 'custom', refId: null, name: 'Annemin dolması', portion: 1, kcal: 500, protein: 20, carbs: 50, fat: 20, loggedId: null };
  const r = generatePlan({ ...base, keep: [mine] });
  assert.equal(r.items.find((x) => x.date === days[0] && x.slot === 'dinner')!.id, 'k1');
  const r2 = generatePlan({ ...base, keep: [mine], keepPlanned: false });
  assert.notEqual(r2.items.find((x) => x.date === days[0] && x.slot === 'dinner')!.id, 'k1');
});

test('porsiyon 0,05 adımlı ve 0,5–2 aralığında; ölçekli makro', () => {
  assert.equal(quantizePortion(1.234), 1.25);
  assert.equal(quantizePortion(9), 2);
  assert.equal(quantizePortion(0.1), 0.5);
  assert.deepEqual(scaleMacros({ kcal: 300, protein: 18, carbs: 21.7, fat: 15.9 }, 1.5), { kcal: 450, protein: 27, carbs: 32.6, fat: 23.9 });
});

test('Balance adayları: 3 farklı plan; özet yalnız hesaplanmış değerler', () => {
  const c = candidatePlans(base, 3);
  assert.equal(c.length, 3);
  const s = summarizeForCoach(c[0]);
  assert.equal(s.days.length, 5);
  assert.equal(s.days[0].kcal, c[0].days[0].kcal);
});

test('alışveriş: aynı malzeme toplanır (porsiyonla), kategori sırası, eatkcal malzeme üretmez', () => {
  const items: PlanItem[] = [
    { id: 'a', date: days[0], slot: 'breakfast', source: 'recipe', refId: 'menemen', name: 'Menemen', portion: 1, kcal: 300, protein: 18, carbs: 22, fat: 16, loggedId: null },
    { id: 'b', date: days[1], slot: 'breakfast', source: 'recipe', refId: 'menemen', name: 'Menemen', portion: 1.5, kcal: 450, protein: 27, carbs: 33, fat: 24, loggedId: null },
    { id: 'c', date: days[1], slot: 'lunch', source: 'eatkcal', refId: 'p1', name: 'Bowl', portion: 1, kcal: 560, protein: 45, carbs: 50, fat: 18, loggedId: null },
  ];
  const lines = buildShoppingList(items, RMAP, ING);
  const egg = lines.find((l) => l.ingredientKey === 'egg')!;
  assert.equal(egg.grams, 250); // 100 + 150
  assert.equal(egg.quantity, 5); // 50 g/adet
  assert.equal(egg.recipeCount, 1);
  const tomato = lines.find((l) => l.ingredientKey === 'tomato')!;
  assert.equal(tomato.grams, 375);
  assert.equal(lines[0].category, 'produce');
  assert.equal(lines.filter((l) => l.ingredientKey === null).length, 0);
  assert.equal(recipeCountOf(items), 1);
  assert.equal(eatkcalMeals(items).length, 1);
});

test('alışveriş: alındı/silindi durumu + elle eklenen + gruplama', () => {
  const items: PlanItem[] = [
    { id: 'a', date: days[0], slot: 'breakfast', source: 'recipe', refId: 'menemen', name: 'Menemen', portion: 1, kcal: 300, protein: 18, carbs: 22, fat: 16, loggedId: null },
  ];
  const lines = buildShoppingList(items, RMAP, ING, [
    { ingredientKey: 'egg', checked: true, removed: false },
    { ingredientKey: 'olive_oil', checked: false, removed: true },
  ], [{ id: 'm1', name: 'Kahve', quantity: 1, unit: 'paket', category: 'other', checked: false }]);
  assert.ok(!lines.some((l) => l.ingredientKey === 'olive_oil'));
  const g = groupShopping(lines);
  assert.equal(g.done.length, 1);
  assert.equal(g.done[0].ingredientKey, 'egg');
  assert.equal(g.groups[g.groups.length - 1].category, 'other');
  assert.equal(g.remaining, lines.length - 1);
});

test('gösterim miktarı: gram 10’a, adet yukarı', () => {
  assert.equal(displayQuantity(601, 'g', 1), 610);
  assert.equal(displayQuantity(1220, 'g', 1), 1250);
  assert.equal(displayQuantity(130, 'adet', 120), 2);
  assert.equal(displayQuantity(5, 'yk', 10), 1);
});

test('hafta: Pazartesi başı, kayan 4 hafta, etiketler', () => {
  assert.equal(weekStartOf('2026-11-11'), '2026-11-09');
  assert.equal(weekStartOf('2026-11-15'), '2026-11-09');
  assert.equal(weekdayIndex('2026-11-09'), 0);
  assert.deepEqual(rollingWeeks('2026-11-12'), ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(weekRange('2026-11-09', 'tr'), '9–15 Kasım');
  assert.equal(weekRange('2026-11-30', 'en'), '30 November – 6 December');
  assert.equal(dayTitle('2026-11-11', 'tr'), 'Çarşamba, 11 Kasım');
  assert.equal(dayTitle('2026-11-11', 'en'), 'Wednesday, 11 Nov');
  assert.equal(spanLabel(days, 'tr'), 'Çarşamba – Pazar, 5 gün');
  assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01');
});

test('kademe: Ücretsiz önizleme (1 gün açık), Fresh şablon, Balance koç; alışveriş Fresh+', () => {
  assert.deepEqual(planAccess('free'), { mode: 'preview', openDays: 1, canApply: false, shopping: false, regenCostsCoach: false });
  assert.equal(planAccess('fresh').mode, 'template');
  assert.equal(planAccess('fresh').shopping, true);
  assert.equal(planAccess('balance').mode, 'coach');
  assert.equal(planAccess('balance').regenCostsCoach, true);
});

test('sözlük: 8 alerjen (26o ile tek sözlük)', () => {
  assert.deepEqual([...ALLERGENS], ['peanut', 'milk', 'egg', 'gluten', 'seafood', 'treenut', 'sesame', 'soy']);
});
