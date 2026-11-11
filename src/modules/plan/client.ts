// G33-S1 — Öğün planı Supabase istemcisi (meal_plans, meal_plan_items, shopping_list_items,
// recipes + recipe_ingredients + ingredient_nutrition). RLS: kullanıcı yalnız kendi satırı.
// Tarifler yalnız `published` (taslak tohum yalnız __DEV__'de uygulama içi yedekten).
import { getSupabaseClient } from '../../core/supabase';
import type { Ingredient, ItemSource, PlanItem, Recipe, RecipeInfo, ShopCategory, Slot } from './types';
import { recipeInfo, seedRecipeInfos, ingredientMap } from './nutrition';
import { SEED_INGREDIENTS, SEED_RECIPES } from './data/seed';
import type { ManualLine, ShopState } from './shopping';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface RecipeCatalog {
  recipes: RecipeInfo[];
  recipeMap: Map<string, Recipe>;
  ingredients: Map<string, Ingredient>;
  /** 'db' yayımlanmış tarifler · 'seed' uygulama içi TASLAK (yalnız geliştirme) · 'none'. */
  origin: 'db' | 'seed' | 'none';
}

function seedCatalog(): RecipeCatalog {
  return { recipes: seedRecipeInfos(), recipeMap: new Map(SEED_RECIPES.map((r) => [r.key, r])), ingredients: ingredientMap(SEED_INGREDIENTS), origin: 'seed' };
}

/** Yayımlanmış tarifler; yoksa geliştirmede tohum, üretimde boş (taslak gösterilmez). */
export async function fetchRecipeCatalog(allowSeed: boolean = __DEV__): Promise<RecipeCatalog> {
  const empty: RecipeCatalog = { recipes: [], recipeMap: new Map(), ingredients: new Map(), origin: 'none' };
  try {
    const sb = getSupabaseClient();
    const [rRes, iRes] = await Promise.all([
      sb.from('recipes').select('key, name_tr, name_en, slot, recipe_ingredients(ingredient_key, grams, position)').eq('status', 'published'),
      sb.from('ingredient_nutrition').select('key, name_tr, name_en, category, unit, unit_grams, kcal_100g, protein_100g, carbs_100g, fat_100g, allergens, origin, fdc_id'),
    ]);
    if (rRes.error || iRes.error || !rRes.data?.length) return allowSeed ? seedCatalog() : empty;
    const ingredients = new Map<string, Ingredient>();
    for (const row of (iRes.data ?? []) as Record<string, unknown>[]) {
      ingredients.set(String(row.key), {
        key: String(row.key),
        fdcId: num(row.fdc_id),
        nameTr: String(row.name_tr),
        nameEn: String(row.name_en),
        category: String(row.category) as ShopCategory,
        unit: String(row.unit) as Ingredient['unit'],
        unitGrams: num(row.unit_grams) || 1,
        allergens: (Array.isArray(row.allergens) ? row.allergens : []) as Ingredient['allergens'],
        origin: String(row.origin) as Ingredient['origin'],
        per100: { kcal: num(row.kcal_100g), protein: num(row.protein_100g), carbs: num(row.carbs_100g), fat: num(row.fat_100g) },
      });
    }
    const recipes: RecipeInfo[] = [];
    const recipeMap = new Map<string, Recipe>();
    for (const row of rRes.data as Record<string, unknown>[]) {
      const ri = ((row.recipe_ingredients ?? []) as Record<string, unknown>[])
        .sort((a, b) => num(a.position) - num(b.position))
        .map((x) => ({ key: String(x.ingredient_key), grams: num(x.grams) }));
      if (!ri.length || ri.some((x) => !ingredients.has(x.key))) continue;
      const r: Recipe = { key: String(row.key), nameTr: String(row.name_tr), nameEn: String(row.name_en), slot: String(row.slot) as Slot, ingredients: ri };
      recipeMap.set(r.key, r);
      // Makro DAİMA malzemeden yeniden hesaplanır (tablodaki önbellek değil).
      recipes.push(recipeInfo(r, ingredients));
    }
    return { recipes, recipeMap, ingredients, origin: 'db' };
  } catch {
    return allowSeed ? seedCatalog() : empty;
  }
}

function rowToItem(row: Record<string, unknown>): PlanItem {
  return {
    id: String(row.id),
    date: String(row.date),
    slot: String(row.slot) as Slot,
    source: String(row.source) as ItemSource,
    refId: row.ref_id == null ? null : String(row.ref_id),
    name: String(row.name),
    portion: num(row.portion) || 1,
    kcal: Math.round(num(row.kcal)),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    loggedId: row.logged_consumption_id == null ? null : String(row.logged_consumption_id),
    price: row.price == null ? null : num(row.price),
  };
}

function itemToRow(it: PlanItem, planId: string, userId: string) {
  return {
    id: it.id,
    plan_id: planId,
    user_id: userId,
    date: it.date,
    slot: it.slot,
    source: it.source,
    ref_id: it.refId,
    name: it.name.slice(0, 120),
    portion: it.portion,
    kcal: Math.round(it.kcal),
    protein: it.protein,
    carbs: it.carbs,
    fat: it.fat,
    price: it.price ?? null,
    logged_consumption_id: it.loggedId,
  };
}

export interface WeekData {
  planId: string | null;
  note: string | null;
  items: PlanItem[];
}

export async function fetchWeek(userId: string, weekStart: string): Promise<WeekData> {
  const sb = getSupabaseClient();
  const { data: plan, error } = await sb.from('meal_plans').select('id, note').eq('user_id', userId).eq('week_start', weekStart).maybeSingle();
  if (error) throw error;
  if (!plan) return { planId: null, note: null, items: [] };
  const { data: rows, error: e2 } = await sb.from('meal_plan_items').select('*').eq('plan_id', (plan as { id: string }).id);
  if (e2) throw e2;
  return { planId: (plan as { id: string }).id, note: (plan as { note?: string | null }).note ?? null, items: ((rows ?? []) as Record<string, unknown>[]).map(rowToItem) };
}

export async function ensurePlan(userId: string, weekStart: string, source: 'manual' | 'template' | 'coach' = 'manual', note: string | null = null): Promise<string> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('meal_plans')
    .upsert({ user_id: userId, week_start: weekStart, source, note }, { onConflict: 'user_id,week_start' })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function upsertItem(userId: string, planId: string, it: PlanItem): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.from('meal_plan_items').upsert(itemToRow(it, planId, userId), { onConflict: 'plan_id,date,slot' });
  if (error) throw error;
}

export async function deleteItem(userId: string, id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('meal_plan_items').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function setItemLogged(userId: string, id: string, loggedId: string | null): Promise<void> {
  const { error } = await getSupabaseClient().from('meal_plan_items').update({ logged_consumption_id: loggedId }).eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

/** "Planı uygula": oluşturulan günlerin satırlarını yazar (aynı gün+yuva üzerine). */
export async function applyItems(userId: string, planId: string, items: readonly PlanItem[]): Promise<void> {
  if (!items.length) return;
  const { error } = await getSupabaseClient()
    .from('meal_plan_items')
    .upsert(items.map((it) => itemToRow(it, planId, userId)), { onConflict: 'plan_id,date,slot' });
  if (error) throw error;
}

// ── Alışveriş listesi ────────────────────────────────────────────────────────
export async function fetchShop(userId: string, weekStart: string): Promise<{ state: ShopState[]; manual: ManualLine[] }> {
  const { data, error } = await getSupabaseClient()
    .from('shopping_list_items')
    .select('id, name, quantity, unit, category, source, ingredient_key, checked, removed')
    .eq('user_id', userId)
    .eq('week_start', weekStart);
  if (error) throw error;
  const state: ShopState[] = [];
  const manual: ManualLine[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (r.source === 'plan' && r.ingredient_key) state.push({ ingredientKey: String(r.ingredient_key), checked: !!r.checked, removed: !!r.removed });
    else if (r.source === 'manual' && !r.removed)
      manual.push({ id: String(r.id), name: String(r.name), quantity: r.quantity == null ? null : num(r.quantity), unit: r.unit == null ? null : String(r.unit), category: String(r.category) as ShopCategory, checked: !!r.checked });
  }
  return { state, manual };
}

export async function upsertShopState(userId: string, weekStart: string, s: ShopState & { name: string; category: ShopCategory }): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('shopping_list_items')
    .upsert(
      { user_id: userId, week_start: weekStart, source: 'plan', ingredient_key: s.ingredientKey, name: s.name.slice(0, 80), category: s.category, checked: s.checked, removed: s.removed },
      { onConflict: 'user_id,week_start,source,ingredient_key' },
    );
  if (error) throw error;
}

export async function insertManual(userId: string, weekStart: string, m: ManualLine): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('shopping_list_items')
    .insert({ id: m.id, user_id: userId, week_start: weekStart, source: 'manual', name: m.name.slice(0, 80), quantity: m.quantity, unit: m.unit, category: m.category, checked: m.checked });
  if (error) throw error;
}

export async function updateManual(userId: string, id: string, patch: { checked?: boolean; removed?: boolean }): Promise<void> {
  const { error } = await getSupabaseClient().from('shopping_list_items').update(patch).eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
