import { getSupabaseClient } from './supabase';
import { mapProductRow } from './products';
import type { CartItem, Product } from '../types';

/** Öneri kartında gösterilecek gerekçe — sıralamayı da bu belirler. */
export type SuggestionReason = 'drink' | 'new_to_you' | 'complete_cart' | 'popular';

export type CartSuggestion = {
  product: Product;
  reason: SuggestionReason;
  score: number;
};

export const SUGGESTION_BADGES: Record<SuggestionReason, string> = {
  drink: 'Yanına içecek',
  new_to_you: 'Hiç denemedin',
  complete_cart: 'Sepetini tamamla',
  popular: 'Çok tercih edilen',
};

// İçecek sayılan kategoriler. Tam eşleşme yerine parça eşleşme — kategori adı
// ileride değişirse (ör. "Detoks & Shake" -> "İçecekler") kural bozulmasın.
const DRINK_HINTS = ['detoks', 'shake', 'içecek', 'icecek', 'smoothie', 'su'];

const norm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr-TR').trim();

export const isDrinkProduct = (p: Product): boolean => {
  const c = norm(p.category);
  return DRINK_HINTS.some((h) => c.includes(h));
};

/** Kullanıcının GEÇMİŞTE sipariş ettiği ürün id'leri (string). */
export const fetchOrderedProductIds = async (userId: string): Promise<Set<string>> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('items')
    .eq('user_id', userId)
    .limit(50);

  const ids = new Set<string>();
  if (error || !Array.isArray(data)) return ids;
  for (const row of data) {
    const items = (row as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const id = (it as Record<string, unknown>)?.id;
      if (id != null) ids.add(String(id));
    }
  }
  return ids;
};

/**
 * Öneri havuzu: is_crosssell işaretli ürünler + TÜM içecekler.
 * İçecekler ayrıca çekiliyor çünkü "sepette içecek yok" kuralının çalışması
 * için havuzda her zaman içecek bulunmalı (is_crosssell işaretli olmasalar bile).
 */
export const fetchSuggestionPool = async (limit = 24): Promise<Product[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(200);
  if (error || !Array.isArray(data)) return [];

  const all = data
    .map((row) => ({ row: row as Record<string, unknown>, product: mapProductRow(row as Record<string, unknown>) }))
    .filter(({ product }) => product.is_available !== false && product.in_stock !== false);

  const pool = all.filter(({ row, product }) => Boolean(row.is_crosssell) || isDrinkProduct(product));
  return pool.slice(0, limit).map(({ product }) => product);
};

/**
 * Sepetin EKSİĞİNE göre öneri üretir.
 *
 * Kurallar (puan sırasıyla):
 *  1. Sepette hiç içecek yoksa → içecekler en üste (`drink`).
 *  2. Kullanıcının daha önce HİÇ sipariş etmediği ürün → `new_to_you`.
 *  3. Kategorisi sepette bulunmayan ürün → `complete_cart`.
 *  4. Hiçbiri tutmuyorsa → `popular` (havuz sırası).
 *
 * Sepette zaten olan ürünler her durumda elenir. Puan eşitliğinde ürün id'sine
 * göre sıralanır; böylece aynı sepet için liste her açılışta AYNI gelir
 * (rastgelelik yok — kullanıcı "az önce gördüğüm ürün nerede" yaşamasın).
 */
export const buildCartSuggestions = ({
  cartItems,
  pool,
  orderedProductIds,
  limit = 10,
}: {
  cartItems: CartItem[];
  pool: Product[];
  orderedProductIds: Set<string>;
  limit?: number;
}): CartSuggestion[] => {
  const cartIds = new Set(cartItems.map((i) => String(i.productId)));
  const cartProductNames = new Set(cartItems.map((i) => norm(i.name)));

  // Sepetteki kategoriler: CartItem kategori taşımadığı için havuzdaki
  // ürünlerle id eşleştirip kategoriyi oradan okuyoruz.
  const poolById = new Map(pool.map((p) => [String(p.id), p]));
  const cartCategories = new Set<string>();
  let cartHasDrink = false;
  for (const id of cartIds) {
    const p = poolById.get(id);
    if (!p) continue;
    if (p.category) cartCategories.add(norm(p.category));
    if (isDrinkProduct(p)) cartHasDrink = true;
  }
  // Havuzda olmayan sepet kalemleri için ada bakarak da içecek kontrolü yap.
  if (!cartHasDrink) {
    cartHasDrink = Array.from(cartProductNames).some((n) =>
      DRINK_HINTS.some((h) => h.length > 2 && n.includes(h)),
    );
  }

  const suggestions: CartSuggestion[] = [];
  for (const product of pool) {
    const id = String(product.id);
    if (cartIds.has(id)) continue;

    let score = 0;
    let reason: SuggestionReason = 'popular';

    if (!cartHasDrink && isDrinkProduct(product)) {
      score += 100;
      reason = 'drink';
    }
    if (!orderedProductIds.has(id)) {
      score += 40;
      if (reason === 'popular') reason = 'new_to_you';
    }
    if (product.category && !cartCategories.has(norm(product.category))) {
      score += 20;
      if (reason === 'popular') reason = 'complete_cart';
    }

    suggestions.push({ product, reason, score });
  }

  return suggestions
    .sort((a, b) => (b.score - a.score) || (a.product.id - b.product.id))
    .slice(0, limit);
};
