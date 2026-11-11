// G33-S1 md.8 — Alışveriş listesi: plandaki TARİF malzemelerinden kategoriye göre BİRLEŞİK liste.
// Aynı malzeme toplanır (porsiyon çarpanıyla); eatkcal ve "kendi öğünüm" satırları malzeme üretmez.
// Kullanıcı durumu (alındı / silindi) ve elle eklenenler ayrı satırlardır (shopping_list_items). SAF.
import type { Ingredient, PlanItem, Recipe, ShopCategory, ShopUnit } from './types';
import { SHOP_CATEGORIES } from './types';

export interface ShopLine {
  /** plan satırı: `plan:<ingredient_key>` · elle: `manual:<id>` */
  id: string;
  ingredientKey: string | null;
  nameTr: string;
  nameEn: string;
  category: ShopCategory;
  grams: number;
  quantity: number;
  unit: ShopUnit | string;
  /** Kaç farklı tarifte geçiyor (elle eklenende 0). */
  recipeCount: number;
  source: 'plan' | 'manual';
  checked: boolean;
}

export interface ShopState {
  ingredientKey: string;
  checked: boolean;
  removed: boolean;
}

export interface ManualLine {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: ShopCategory;
  checked: boolean;
}

/** Gram → gösterim miktarı. Adet benzeri birimler yukarı yuvarlanır; gram/ml 10'a, 1 kg üstü 50'ye. */
export function displayQuantity(grams: number, unit: ShopUnit, unitGrams: number): number {
  if (unit === 'g' || unit === 'ml') {
    const step = grams >= 1000 ? 50 : 10;
    return Math.max(step, Math.ceil(grams / step) * step);
  }
  return Math.max(1, Math.ceil(grams / Math.max(1e-6, unitGrams) - 1e-9));
}

export function buildShoppingList(
  items: readonly PlanItem[],
  recipes: ReadonlyMap<string, Recipe>,
  ingredients: ReadonlyMap<string, Ingredient>,
  state: readonly ShopState[] = [],
  manual: readonly ManualLine[] = [],
): ShopLine[] {
  const acc = new Map<string, { grams: number; recipes: Set<string> }>();
  for (const it of items) {
    if (it.source !== 'recipe' || !it.refId) continue;
    const r = recipes.get(it.refId);
    if (!r) continue;
    for (const { key, grams } of r.ingredients) {
      const cur = acc.get(key) ?? { grams: 0, recipes: new Set<string>() };
      cur.grams += grams * (it.portion || 1);
      cur.recipes.add(r.key);
      acc.set(key, cur);
    }
  }
  const st = new Map(state.map((s) => [s.ingredientKey, s]));
  const out: ShopLine[] = [];
  for (const [key, v] of acc) {
    const ing = ingredients.get(key);
    if (!ing) continue;
    const s = st.get(key);
    if (s?.removed) continue;
    out.push({
      id: `plan:${key}`,
      ingredientKey: key,
      nameTr: ing.nameTr,
      nameEn: ing.nameEn,
      category: ing.category,
      grams: Math.round(v.grams),
      quantity: displayQuantity(v.grams, ing.unit, ing.unitGrams),
      unit: ing.unit,
      recipeCount: v.recipes.size,
      source: 'plan',
      checked: !!s?.checked,
    });
  }
  for (const m of manual) {
    out.push({
      id: `manual:${m.id}`,
      ingredientKey: null,
      nameTr: m.name,
      nameEn: m.name,
      category: m.category,
      grams: 0,
      quantity: m.quantity ?? 1,
      unit: m.unit ?? 'paket',
      recipeCount: 0,
      source: 'manual',
      checked: m.checked,
    });
  }
  const catIdx = (c: ShopCategory) => SHOP_CATEGORIES.indexOf(c);
  return out.sort((a, b) => catIdx(a.category) - catIdx(b.category) || a.nameTr.localeCompare(b.nameTr, 'tr'));
}

export interface ShopGroup {
  category: ShopCategory;
  lines: ShopLine[];
}

/** Alınmamışlar kategoriye göre; alınanlar ayrı ("Alındı"). */
export function groupShopping(lines: readonly ShopLine[]): { groups: ShopGroup[]; done: ShopLine[]; remaining: number } {
  const groups: ShopGroup[] = [];
  for (const c of SHOP_CATEGORIES) {
    const l = lines.filter((x) => x.category === c && !x.checked);
    if (l.length) groups.push({ category: c, lines: l });
  }
  const done = lines.filter((x) => x.checked);
  return { groups, done, remaining: lines.length - done.length };
}

/** Plandaki eatkcal öğünleri (sepet kartı + sepet sayfası). */
export function eatkcalMeals(items: readonly PlanItem[]): PlanItem[] {
  return items.filter((x) => x.source === 'eatkcal').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Plandaki farklı tarif sayısı ("Planındaki N tariften"). */
export function recipeCountOf(items: readonly PlanItem[]): number {
  return new Set(items.filter((x) => x.source === 'recipe' && x.refId).map((x) => x.refId)).size;
}
