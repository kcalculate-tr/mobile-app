#!/usr/bin/env node
// G33-S1 md.5 — Tarif tohumu üretici. TEK kaynak: scripts/plan-seed/source.json
// (USDA FoodData Central SR Legacy CSV 2018-04'ten okunmuş 100 g değerleri + FDC ID; tarifler gram).
// Çıktılar:
//   1) src/modules/plan/data/seed.ts           — uygulama içi kopya (tablo boşsa / test)
//   2) supabase/migrations/20261112100200_g33_recipe_seed.sql (+ rollback)
//   3) docs/night/G33-TARIF-TASLAK.md            — İlter/diyetisyen onay tablosu
// Makrolar HESAPLANIR (uydurma yok): Σ gram/100 × per100. Alerjen ve diyet etiketleri malzemeden türetilir.
// Çalıştırma: node scripts/plan-seed/gen.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/plan-seed/source.json'), 'utf8'));
const ING = new Map(src.ingredients.map((i) => [i.key, i]));

const r1 = (n) => Math.round(n * 10) / 10;
function macrosOf(recipe) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { key, grams } of recipe.ingredients) {
    const i = ING.get(key);
    for (const k of Object.keys(t)) t[k] += (grams / 100) * i.per100[k];
  }
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}
// Diyet/alerjen türetimi — src/modules/plan/nutrition.ts ile AYNI kural (test eşitliği denetler).
function allergensOf(recipe) {
  const s = new Set();
  for (const { key } of recipe.ingredients) for (const a of ING.get(key).allergens) s.add(a);
  return ['peanut', 'milk', 'egg', 'gluten', 'seafood', 'treenut', 'sesame', 'soy'].filter((a) => s.has(a));
}
function dietsOf(recipe, m) {
  const o = new Set(recipe.ingredients.map(({ key }) => ING.get(key).origin));
  const d = [];
  const meat = o.has('meat');
  const fish = o.has('fish');
  const animal = meat || fish || o.has('dairy') || o.has('egg') || o.has('honey');
  if (!meat && !fish) d.push('vegetarian');
  if (!animal) d.push('vegan');
  if (!meat) d.push('pescatarian');
  if (m.kcal > 0 && (m.protein * 4) / m.kcal >= 0.3) d.push('high_protein');
  if (m.kcal > 0 && (m.carbs * 4) / m.kcal <= 0.26) d.push('low_carb');
  return d;
}

const recipes = src.recipes.map((r) => {
  const m = macrosOf(r);
  return { ...r, macros: m, allergens: allergensOf(r), diets: dietsOf(r, m) };
});

// ── 1) seed.ts ──
const ts = `// OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: scripts/plan-seed/source.json · üretici: node scripts/plan-seed/gen.mjs
// G33-S1 md.5 — TASLAK tarif tohumu (İlter/diyetisyen onayı bekliyor: docs/night/G33-TARIF-TASLAK.md).
// 100 g değerleri USDA FoodData Central SR Legacy (2018-04); her malzemede FDC ID. Makrolar burada YOK —
// uygulama \`nutrition.ts\` ile malzemelerden HESAPLAR.
import type { Ingredient, Recipe } from '../types';

export const SEED_INGREDIENTS: Ingredient[] = ${JSON.stringify(
  src.ingredients.map(({ key, fdcId, nameTr, nameEn, category, unit, unitGrams, allergens, origin, per100 }) => ({ key, fdcId, nameTr, nameEn, category, unit, unitGrams, allergens, origin, per100 })),
  null,
  1,
)};

export const SEED_RECIPES: Recipe[] = ${JSON.stringify(src.recipes, null, 1)};
`;
fs.mkdirSync(path.join(ROOT, 'src/modules/plan/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/modules/plan/data/seed.ts'), ts);

// ── 2) SQL ──
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (a) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
let sql = `-- G33-S1 md.5 — TASLAK tarif tohumu (40 Türk fit tarifi) + malzeme besin değerleri.
-- version: 20261112100200  name: g33_recipe_seed
-- DURUM: UYGULANMADI (yalnız dosya). Geri alma: supabase/rollbacks/20261112100200_g33_recipe_seed_rollback.sql
-- ÖNKOŞUL: 20261112100100_g33_meal_plan (tablolar). İdempotent (on conflict do update).
-- OTOMATİK ÜRETİLDİ: node scripts/plan-seed/gen.mjs (kaynak scripts/plan-seed/source.json).
-- ingredient_nutrition: USDA FoodData Central SR Legacy (2018-04) 100 g değerleri, her satırda fdc_id.
-- recipes.kcal/protein/carbs/fat: malzemelerden HESAPLANMIŞ (Σ gram/100 × 100 g değeri) — uydurma yok.
-- recipes.status = 'draft' → istemci yalnız 'published' okur; İlter/diyetisyen onayıyla
--   update public.recipes set status = 'published' where key in (...);
begin;

insert into public.ingredient_nutrition (key, name_tr, name_en, category, unit, unit_grams, kcal_100g, protein_100g, carbs_100g, fat_100g, allergens, origin, source, fdc_id, source_description) values
`;
sql += src.ingredients
  .map((i) => `  (${q(i.key)}, ${q(i.nameTr)}, ${q(i.nameEn)}, ${q(i.category)}, ${q(i.unit)}, ${i.unitGrams}, ${i.per100.kcal}, ${i.per100.protein}, ${i.per100.carbs}, ${i.per100.fat}, ${arr(i.allergens)}, ${q(i.origin)}, ${q('usda_fdc_sr_legacy')}, ${i.fdcId}, ${q(i.usdaDescription)})`)
  .join(',\n');
sql += `
on conflict (key) do update set
  name_tr = excluded.name_tr, name_en = excluded.name_en, category = excluded.category, unit = excluded.unit,
  unit_grams = excluded.unit_grams, kcal_100g = excluded.kcal_100g, protein_100g = excluded.protein_100g,
  carbs_100g = excluded.carbs_100g, fat_100g = excluded.fat_100g, allergens = excluded.allergens,
  origin = excluded.origin, source = excluded.source, fdc_id = excluded.fdc_id, source_description = excluded.source_description;

insert into public.recipes (key, name_tr, name_en, slot, kcal, protein, carbs, fat, allergens, diets, status) values
`;
sql += recipes
  .map((r) => `  (${q(r.key)}, ${q(r.nameTr)}, ${q(r.nameEn)}, ${q(r.slot)}, ${r.macros.kcal}, ${r.macros.protein}, ${r.macros.carbs}, ${r.macros.fat}, ${arr(r.allergens)}, ${arr(r.diets)}, 'draft')`)
  .join(',\n');
sql += `
on conflict (key) do update set
  name_tr = excluded.name_tr, name_en = excluded.name_en, slot = excluded.slot, kcal = excluded.kcal,
  protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat, allergens = excluded.allergens,
  diets = excluded.diets, updated_at = now();

delete from public.recipe_ingredients where recipe_key in (${recipes.map((r) => q(r.key)).join(', ')});
insert into public.recipe_ingredients (recipe_key, ingredient_key, grams, position) values
`;
sql += recipes
  .flatMap((r) => r.ingredients.map((ing, idx) => `  (${q(r.key)}, ${q(ing.key)}, ${ing.grams}, ${idx})`))
  .join(',\n');
sql += `;

commit;
`;
fs.writeFileSync(path.join(ROOT, 'supabase/migrations/20261112100200_g33_recipe_seed.sql'), sql);
fs.writeFileSync(
  path.join(ROOT, 'supabase/rollbacks/20261112100200_g33_recipe_seed_rollback.sql'),
  `-- G33-S1 — 20261112100200_g33_recipe_seed geri alma (yalnız tohum satırları; tablolar kalır).
begin;
delete from public.recipe_ingredients where recipe_key in (${recipes.map((r) => q(r.key)).join(', ')});
delete from public.recipes where key in (${recipes.map((r) => q(r.key)).join(', ')});
delete from public.ingredient_nutrition where key in (${src.ingredients.map((i) => q(i.key)).join(', ')});
commit;
`,
);

// ── 3) Onay tablosu ──
const SLOT_TR = { breakfast: 'Kahvaltı', lunch: 'Öğle', dinner: 'Akşam', snack: 'Ara öğün' };
const AL_TR = { peanut: 'fıstık', milk: 'süt', egg: 'yumurta', gluten: 'gluten', seafood: 'deniz ürünü', treenut: 'kuruyemiş', sesame: 'susam', soy: 'soya' };
const DI_TR = { vegetarian: 'vejetaryen', vegan: 'vegan', pescatarian: 'pesketaryen', high_protein: 'yüksek protein', low_carb: 'düşük karbonhidrat' };
const nf = (n) => String(n).replace('.', ',');
let md = `# G33-S1 — Tarif tohumu TASLAK (İlter / diyetisyen onayı için)

Durum: **TASLAK** — \`recipes.status = 'draft'\`; onaylanan tarifler \`published\` yapılınca uygulamada görünür.
Kaynak: \`scripts/plan-seed/source.json\` → \`node scripts/plan-seed/gen.mjs\` (bu dosya, seed.ts ve SQL aynı kaynaktan üretilir).

- Malzeme değerleri: **USDA FoodData Central, SR Legacy (2018-04)**, 100 g başına; her malzemede FDC ID (aşağıda).
- Tarif makroları **hesaplanır**: Σ (gram / 100 × 100 g değeri). Uydurma/tahmini değer yok. Tuz, su, baharat dışı izler dahil değil.
- Pişmiş ağırlık kullanılan malzemeler adında "(pişmiş)/(haşlanmış)" yazar (USDA "cooked" kaydı).
- Alerjen ve diyet etiketleri malzemelerden türetilir: yüksek protein = protein kalorisi ≥ %30, düşük karbonhidrat = karbonhidrat kalorisi ≤ %26.
- Onay için: her satırda ✅ / ✏️ (gramaj değişikliği) / ❌ işaretleyin.

## Tarifler (${recipes.length})

| # | Öğün | Tarif | Malzemeler (g) | kcal | P | K | Y | Alerjen | Diyet | Onay |
|---|---|---|---|---|---|---|---|---|---|---|
`;
recipes.forEach((r, i) => {
  const ings = r.ingredients.map(({ key, grams }) => `${ING.get(key).nameTr} ${grams}`).join(' · ');
  md += `| ${i + 1} | ${SLOT_TR[r.slot]} | ${r.nameTr} | ${ings} | ${r.macros.kcal} | ${nf(r.macros.protein)} | ${nf(r.macros.carbs)} | ${nf(r.macros.fat)} | ${r.allergens.map((a) => AL_TR[a]).join(', ') || '—'} | ${r.diets.map((d) => DI_TR[d]).join(', ') || '—'} | ☐ |\n`;
});
md += `
## Malzemeler (${src.ingredients.length}) — USDA FDC SR Legacy, 100 g başına

| Malzeme | FDC ID | USDA kaydı | kcal | P | K | Y | Alerjen |
|---|---|---|---|---|---|---|---|
`;
for (const i of src.ingredients) {
  md += `| ${i.nameTr} | ${i.fdcId} | ${i.usdaDescription} | ${nf(i.per100.kcal)} | ${nf(i.per100.protein)} | ${nf(i.per100.carbs)} | ${nf(i.per100.fat)} | ${i.allergens.map((a) => AL_TR[a]).join(', ') || '—'} |\n`;
}
fs.writeFileSync(path.join(ROOT, 'docs/night/G33-TARIF-TASLAK.md'), md);
console.log(`seed.ts + SQL + TASLAK: ${src.ingredients.length} malzeme, ${recipes.length} tarif`);
