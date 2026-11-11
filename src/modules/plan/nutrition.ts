// G33-S1 md.5 — Tarif makroları, alerjen ve diyet etiketleri MALZEMEDEN hesaplanır (uydurma yok).
// Aynı kural scripts/plan-seed/gen.mjs'de (SQL tohumu); test ikisinin eşitliğini denetler. SAF.
import type { AllergenKey, DietKey, Ingredient, Macros, Recipe, RecipeInfo } from './types';
import { ALLERGENS } from './types';
import { SEED_INGREDIENTS, SEED_RECIPES } from './data/seed';

const r1 = (n: number) => Math.round(n * 10) / 10;

export function ingredientMap(list: readonly Ingredient[] = SEED_INGREDIENTS): Map<string, Ingredient> {
  return new Map(list.map((i) => [i.key, i]));
}

/** Σ gram/100 × 100 g değeri. Bilinmeyen malzeme hata (sessiz 0 yok). */
export function recipeMacros(recipe: Recipe, ing: Map<string, Ingredient>): Macros {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { key, grams } of recipe.ingredients) {
    const i = ing.get(key);
    if (!i) throw new Error(`plan: bilinmeyen malzeme ${key} (${recipe.key})`);
    t.kcal += (grams / 100) * i.per100.kcal;
    t.protein += (grams / 100) * i.per100.protein;
    t.carbs += (grams / 100) * i.per100.carbs;
    t.fat += (grams / 100) * i.per100.fat;
  }
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}

export function recipeAllergens(recipe: Recipe, ing: Map<string, Ingredient>): AllergenKey[] {
  const s = new Set<AllergenKey>();
  for (const { key } of recipe.ingredients) for (const a of ing.get(key)?.allergens ?? []) s.add(a);
  return ALLERGENS.filter((a) => s.has(a));
}

/** yüksek protein: protein kalorisi ≥ %30 · düşük karbonhidrat: karbonhidrat kalorisi ≤ %26. */
export function recipeDiets(recipe: Recipe, ing: Map<string, Ingredient>, m: Macros): Exclude<DietKey, 'all'>[] {
  const o = new Set(recipe.ingredients.map(({ key }) => ing.get(key)?.origin));
  const meat = o.has('meat');
  const fish = o.has('fish');
  const animal = meat || fish || o.has('dairy') || o.has('egg') || o.has('honey');
  const d: Exclude<DietKey, 'all'>[] = [];
  if (!meat && !fish) d.push('vegetarian');
  if (!animal) d.push('vegan');
  if (!meat) d.push('pescatarian');
  if (m.kcal > 0 && (m.protein * 4) / m.kcal >= 0.3) d.push('high_protein');
  if (m.kcal > 0 && (m.carbs * 4) / m.kcal <= 0.26) d.push('low_carb');
  return d;
}

export function recipeInfo(recipe: Recipe, ing: Map<string, Ingredient>): RecipeInfo {
  const macros = recipeMacros(recipe, ing);
  return { ...recipe, macros, allergens: recipeAllergens(recipe, ing), diets: recipeDiets(recipe, ing, macros) };
}

let seedInfos: RecipeInfo[] | null = null;
/** Uygulama içi tohumdan hesaplanmış tarifler (tablo boş/erişilemezse yedek; testler). */
export function seedRecipeInfos(): RecipeInfo[] {
  if (!seedInfos) {
    const m = ingredientMap();
    seedInfos = SEED_RECIPES.map((r) => recipeInfo(r, m));
  }
  return seedInfos;
}

/** Porsiyon çarpanıyla ölçeklenmiş makro (kcal tam sayı, makrolar 0,1). */
export function scaleMacros(m: Macros, portion: number): Macros {
  return { kcal: Math.round(m.kcal * portion), protein: r1(m.protein * portion), carbs: r1(m.carbs * portion), fat: r1(m.fat * portion) };
}

/** Diyet uyumu: `all` her şeyi geçirir. */
export function fitsDiet(r: Pick<RecipeInfo, 'diets'>, diet: DietKey): boolean {
  return diet === 'all' || r.diets.includes(diet);
}

/** Seçilen alerjenlerden HİÇBİRİNİ içermez. */
export function freeOf(r: Pick<RecipeInfo, 'allergens'>, avoid: readonly AllergenKey[]): boolean {
  return !avoid.some((a) => r.allergens.includes(a));
}
