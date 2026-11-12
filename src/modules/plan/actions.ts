// G33-S1 md.6 — "Logla": plan satırı MEVCUT günlük takip kayıt servisine (çevrimdışı kuyruk,
// submitLogOp → meal_consumptions) gider; "Geri al" aynı kuyruktan siler. eatkcal seçenekleri
// mevcut ürün kataloğundan (makro + fiyat), İzmir kontrolü kayıtlı adreslerden.
import type { EatkcalOption, PlanItem } from './types';
import type { Product } from '../../types';

/** source_ref `plan:<satır>` → aynı plan satırı iki kez loglanmaz (23505 = zaten yazıldı). */
export async function logPlanItem(it: PlanItem, consumedAt: Date = new Date()): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { submitLogOp, newRowId } = require('../gun/track/logQueueNative') as typeof import('../gun/track/logQueueNative');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { toServerMealType } = require('../../core/meal/mealType') as typeof import('../../core/meal/mealType');
  const id = newRowId();
  const row = {
    id,
    // meal_consumptions CHECK'inde plan kaynağı yok → 'manual' (koç önerileriyle aynı yol).
    source: 'manual',
    source_ref: `plan:${it.id}`,
    name: it.name,
    meal_type: toServerMealType(it.slot),
    calories: Math.round(it.kcal),
    protein: it.protein,
    carbs: it.carbs,
    fat: it.fat,
    note: null,
    consumed_at: consumedAt.toISOString(),
  };
  try {
    return (await submitLogOp({ kind: 'insert', id, row, at: Date.now() })) ? id : null;
  } catch {
    return null;
  }
}

export async function unlogPlanItem(consumptionId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { submitLogOp } = require('../gun/track/logQueueNative') as typeof import('../gun/track/logQueueNative');
  try {
    return await submitLogOp({ kind: 'delete', id: consumptionId, at: Date.now() });
  } catch {
    return false;
  }
}

/** İl adı İzmir mi (Türkçe büyük/küçük harf + "İ" güvenli). */
export function isIzmirCity(city: string | null | undefined): boolean {
  if (!city) return false;
  return city.toLocaleLowerCase('tr').replace(/ı/g, 'i').includes('izmir');
}

/** Seçili adres ya da kayıtlı adreslerden biri İzmir'de mi? (coach-chat ile aynı kural). */
export async function userInIzmir(userId: string | null): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAddressStore } = require('../../store/addressStore') as typeof import('../../store/addressStore');
    if (isIzmirCity(useAddressStore.getState().selectedAddress?.city)) return true;
    if (!userId) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../../core/supabase') as typeof import('../../core/supabase');
    const { data } = await getSupabaseClient().from('addresses').select('city').eq('user_id', userId).limit(20);
    return ((data ?? []) as { city?: string | null }[]).some((a) => isIzmirCity(a.city));
  } catch {
    return false;
  }
}

/** Ürün → plan seçeneği (makrosu olmayan ürün plana önerilmez). */
export function productToOption(p: Product): EatkcalOption | null {
  const kcal = Number(p.calories ?? p.cal ?? 0);
  if (!Number.isFinite(kcal) || kcal <= 0) return null;
  if (p.in_stock === false || p.is_available === false) return null;
  return {
    id: String(p.id),
    name: p.name,
    kcal,
    protein: Number(p.protein ?? 0) || 0,
    carbs: Number(p.carbs ?? 0) || 0,
    fat: Number(p.fats ?? 0) || 0,
    price: Number.isFinite(Number(p.price)) ? Number(p.price) : null,
  };
}

let productsMemo: Product[] | null = null;
export async function loadEatkcalProducts(): Promise<Product[]> {
  if (productsMemo) return productsMemo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchProducts } = require('../../lib/products') as typeof import('../../lib/products');
    const list = await fetchProducts();
    productsMemo = list;
    return list;
  } catch {
    return [];
  }
}

export async function loadEatkcalOptions(): Promise<EatkcalOption[]> {
  return (await loadEatkcalProducts()).map(productToOption).filter((x): x is EatkcalOption => !!x);
}

export interface BasketChoice {
  id: string;
  name: string;
}
export interface BasketResult {
  /** Doğrudan sepete eklenen öğün sayısı. */
  added: number;
  /** Gramaj / zorunlu seçenek isteyen ürünler (tekil, plan sırasıyla) → ürün sayfası açılır. */
  choice: BasketChoice[];
  /** Katalogda olmayan / satışta olmayan öğün sayısı. */
  missing: number;
}

/**
 * G36-S1 md.5 (İlter 12 Kas) — saf ayırıcı: her plan satırı ya doğrudan eklenir, ya seçim ister
 * (ürün sayfası), ya da katalogda yoktur. Aynı ürün iki kez seçim isterse tek sayfa açılır.
 */
export function splitPlanBasket(
  items: readonly PlanItem[],
  byId: ReadonlyMap<string, Product>,
  needsChoice: (p: Product) => boolean,
): { direct: Product[]; choice: BasketChoice[]; missing: number } {
  const direct: Product[] = [];
  const choice: BasketChoice[] = [];
  let missing = 0;
  for (const it of items) {
    const p = it.refId ? byId.get(it.refId) : undefined;
    if (!p || p.in_stock === false || p.is_available === false) {
      missing++;
      continue;
    }
    if (needsChoice(p)) {
      if (!choice.some((c) => c.id === String(p.id))) choice.push({ id: String(p.id), name: p.name });
      continue;
    }
    direct.push(p);
  }
  return { direct, choice, missing };
}

/**
 * Plan eatkcal satırlarını sepete ekler. Seçim isteyen (gramaj ya da zorunlu seçenek grubu) ürün
 * ATLANMAZ: `choice` listesinde döner, ekran o ürünün sayfasını açar (seçim sonrası sepete orada).
 * Seçenek grupları öğrenilemezse güvenli taraf: ürün sayfası (eksik seçimle sepete girmez).
 */
export async function addPlanMealsToCart(items: readonly PlanItem[]): Promise<BasketResult> {
  const products = await loadEatkcalProducts();
  const byId = new Map(products.map((p) => [String(p.id), p]));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useCartStore } = require('../../store/cartStore') as typeof import('../../store/cartStore');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasGramajChoice, hasRequiredOptionGroup } = require('../../lib/quickAdd') as typeof import('../../lib/quickAdd');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fetchProductOptionGroups } = require('../../lib/products') as typeof import('../../lib/products');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSupabaseClient } = require('../../core/supabase') as typeof import('../../core/supabase');

  // Zorunlu seçenek grubu ürün başına bir kez sorulur.
  const required = new Map<string, boolean>();
  const candidates = new Set<string>();
  for (const it of items) {
    const p = it.refId ? byId.get(it.refId) : undefined;
    if (p && !hasGramajChoice(p.gramaj_options)) candidates.add(String(p.id));
  }
  await Promise.all(
    [...candidates].map(async (id) => {
      try {
        required.set(id, hasRequiredOptionGroup(await fetchProductOptionGroups(getSupabaseClient(), id)));
      } catch {
        required.set(id, true);
      }
    }),
  );
  const { direct, choice, missing } = splitPlanBasket(items, byId, (p) => hasGramajChoice(p.gramaj_options) || required.get(String(p.id)) !== false);
  for (const p of direct) useCartStore.getState().addItem(p, {}, 1);
  return { added: direct.length, choice, missing };
}
