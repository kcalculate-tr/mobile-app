// G56-S1 — eatkcal ana sayfa sipariş artırma bölümlerinin SAF kuralları (RN / ağ yok → tsx birim testi).
// "Ekranda ne görünür" kararı burada; veri çekme `growthApi.ts`, çizim `ui/growth/*`.
import type { CartSelectedOptions, OptionGroup, Product, ProductOptionLink } from '../../../../types';
import {
  buildCartAddCalls,
  missingSelections,
  normalizeGramajOptions,
  type CartAddCall,
  type GroupSelections,
  type TemplateSelections,
} from '../model/productModel';
import {
  FILTERS,
  KCAL_SECTION,
  NON_MEAL_CATEGORIES,
  PLAN_MATCH,
  TOP_SECTION,
  type FilterKey,
  type FilterRule,
} from './config';

// ── Ortak ürün yardımcıları ───────────────────────────────────────────────────
export type GrowthProduct = Pick<Product, 'id' | 'name' | 'price'> &
  Partial<Pick<Product, 'img' | 'category' | 'calories' | 'cal' | 'protein' | 'carbs' | 'fats' | 'is_available' | 'in_stock' | 'discount_type' | 'discount_value'>>;

export function productKcal(p: { calories?: number | null; cal?: number | null }): number | null {
  const v = Number(p.calories ?? p.cal);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function onSale(p: { is_available?: boolean; in_stock?: boolean }): boolean {
  return p.is_available !== false && p.in_stock !== false;
}

const cat = (p: { category?: string | null }) => String(p.category ?? '').trim();
const isMeal = (p: { category?: string | null }) => !NON_MEAL_CATEGORIES.includes(cat(p));

// ── 1) Kategori çipleri + Filtrelenmiş liste ─────────────────────────────────
export function filterRule(key: FilterKey): FilterRule {
  return FILTERS.find((f) => f.key === key) ?? FILTERS[0];
}

/** Bir kuralın uygulanabilir verisi var mı? Boş kategori listesi = alan yok → çip gizli. */
export function ruleUsable(rule: FilterRule): boolean {
  return !(Array.isArray(rule.categories) && rule.categories.length === 0);
}

/** Ana sayfada / liste ekranında görünen çipler (tasarım sırası; verisi olmayan kural gizli). */
export function filterChips(): FilterRule[] {
  return FILTERS.filter(ruleUsable);
}

export function matchesFilter(p: GrowthProduct, rule: FilterRule): boolean {
  if (!onSale(p)) return false;
  if (!ruleUsable(rule)) return false;
  if (rule.minProtein != null) {
    const v = num(p.protein);
    if (v == null || v < rule.minProtein) return false;
  }
  if (rule.maxCarbs != null) {
    const v = num(p.carbs);
    if (v == null || v > rule.maxCarbs) return false;
  }
  if (rule.underKcal != null) {
    const v = productKcal(p);
    if (v == null || v >= rule.underKcal) return false;
  }
  if (rule.categories && !rule.categories.includes(cat(p))) return false;
  // Makro filtrelerinde soslar ürün listesine karışmasın.
  if ((rule.minProtein != null || rule.maxCarbs != null || rule.underKcal != null) && !isMeal(p)) return false;
  return true;
}

export type ListSource =
  | { filter: FilterKey }
  | { category: string }
  /** Kalan kalori "Tümü": kcal ≤ sınır olan yemekler, proteine göre (kcalPicks ile aynı sıra, sınırsız). */
  | { maxKcal: number }
  /** Bu hafta en çok "Tümü": verilen sıra. */
  | { ids: string[] };

/** Filtrelenmiş liste: kural / kategori, katalog sırası korunur. */
export function applyListSource<T extends GrowthProduct>(products: readonly T[], src: ListSource): T[] {
  if ('category' in src) return products.filter((p) => onSale(p) && cat(p) === src.category.trim());
  if ('ids' in src) {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    return src.ids.map((id) => byId.get(String(id))).filter((p): p is T => !!p && onSale(p));
  }
  if ('maxKcal' in src) {
    return products
      .filter((p) => onSale(p) && isMeal(p))
      .filter((p) => {
        const k = productKcal(p);
        return k != null && k <= src.maxKcal;
      })
      .sort((a, b) => (num(b.protein) ?? 0) - (num(a.protein) ?? 0) || (productKcal(a) ?? 0) - (productKcal(b) ?? 0));
  }
  const rule = filterRule(src.filter);
  return products.filter((p) => matchesFilter(p, rule));
}

// ── 2) Tekrar sipariş ver ─────────────────────────────────────────────────────
/** Yalnız ≥ 1 tamamlanmış (teslim edilmiş) siparişi olanda. */
export function reorderVisible(orders: readonly { items: readonly unknown[] }[] | null | undefined): boolean {
  return Array.isArray(orders) && orders.some((o) => o.items.length > 0);
}

export interface ReorderLine {
  /** order.items[].id (ürün kimliği). */
  id: string;
  name: string;
  quantity: number;
  options: Partial<CartSelectedOptions>;
}

/** Satıştaki katalogda olmayan kalemler (kart üstü `oos` uyarısı). Katalog yüklenmediyse uyarı yok. */
export function reorderUnavailable(items: readonly ReorderLine[], onSaleIds: ReadonlySet<string> | null): ReorderLine[] {
  if (!onSaleIds) return [];
  return items.filter((it) => !onSaleIds.has(String(it.id)));
}

export interface ProductOptionInfo {
  groups: readonly OptionGroup[];
  links: readonly ProductOptionLink[];
}

/**
 * Eski seçimler bugün de geçerli mi? Geçerliyse sepet çağrıları GÜNCEL fiyat/makro ile yeniden
 * kurulur (ürün sayfasıyla aynı `buildCartAddCalls`); değilse null → ürün sayfası açılır.
 * Geçersiz sayılanlar: grup/seçenek kaldırılmış ya da satışta değil, zorunlu seçim eksik, gramaj adı
 * artık yok, şablon değeri yok, paket (bundle) ürün.
 */
export function rebuildReorderLine(product: Product, line: ReorderLine, info: ProductOptionInfo): CartAddCall[] | null {
  const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
  if (product.is_bundle) return null;
  const saved = line.options ?? {};
  const gramaj = normalizeGramajOptions(product);
  const productHasOptions = info.groups.length > 0 || info.links.length > 0 || gramaj.length > 0;
  if (!productHasOptions) {
    // Seçeneksiz ürün: eskiden seçim varmış ama ürün artık seçeneksizse yine de doğrudan eklenir.
    return [{ product, options: {}, quantity: qty }];
  }
  // a) uuid grupları
  const selections: GroupSelections = {};
  for (const [gid, ids] of Object.entries(saved.byGroup ?? {})) {
    if (!Array.isArray(ids) || ids.length === 0) continue;
    const group = info.groups.find((g) => g.id === gid);
    if (!group) return null;
    for (const id of ids) {
      const item = group.items.find((it) => it.id === String(id));
      if (!item || item.isAvailable === false) return null;
    }
    selections[gid] = ids.map(String);
  }
  // b) şablonlar (template_id > 0) ve gramaj (template_id 0, ada göre)
  const templateSelections: TemplateSelections = {};
  let gramajIndex = -1;
  for (const opt of saved.templateOptions ?? []) {
    const tid = Number(opt.template_id) || 0;
    if (tid === 0) {
      const idx = gramaj.findIndex((g) => g.name === String(opt.value_name ?? '').trim());
      if (idx < 0) return null;
      gramajIndex = idx;
      continue;
    }
    const link = info.links.find((l) => l.template?.id === tid);
    const val = link?.template?.values.find((v) => v.id === Number(opt.value_id));
    if (!link || !val) return null;
    templateSelections[tid] = [...(templateSelections[tid] ?? []), val.id];
  }
  const missing = missingSelections({
    groups: info.groups,
    selections,
    links: info.links,
    templateSelections,
    gramajCount: gramaj.length,
    gramajIndex,
  });
  if (missing.length > 0) return null;
  return buildCartAddCalls(
    { product, groups: info.groups, selections, links: info.links, templateSelections, gramajOptions: gramaj, gramajIndex },
    qty,
  );
}

export interface ReorderPlan {
  calls: CartAddCall[];
  /** Seçimi artık geçerli değil → ürün sayfası (ilki açılır). */
  needsPage: string[];
  /** Satışta olmayan kalemlerin adları. */
  unavailable: string[];
  /** Doğrudan eklenen kalem sayısı (bildirim metni). */
  added: number;
}

export function planReorder(
  items: readonly ReorderLine[],
  productsById: ReadonlyMap<string, Product>,
  infoById: ReadonlyMap<string, ProductOptionInfo>,
): ReorderPlan {
  const out: ReorderPlan = { calls: [], needsPage: [], unavailable: [], added: 0 };
  for (const it of items) {
    const p = productsById.get(String(it.id));
    if (!p || !onSale(p)) {
      out.unavailable.push(it.name);
      continue;
    }
    const calls = rebuildReorderLine(p, it, infoById.get(String(it.id)) ?? { groups: [], links: [] });
    if (!calls) {
      if (!out.needsPage.includes(String(p.id))) out.needsPage.push(String(p.id));
      continue;
    }
    out.calls.push(...calls);
    out.added += 1;
  }
  return out;
}

// ── 3) Kalan kalorine uygun öğünler ───────────────────────────────────────────
export type KcalState = 'full' | 'done' | 'empty';

/** kalan = bugünkü hedef − loglanan. Hedef yok / profil yok → empty; hedef doldu → done. */
export function kcalSectionState(input: { targetKcal: number | null | undefined; consumedKcal: number | null | undefined }): {
  state: KcalState;
  remaining: number;
} {
  const target = Number(input.targetKcal) || 0;
  if (!(target > 0)) return { state: 'empty', remaining: 0 };
  const remaining = Math.round(target - Math.max(0, Number(input.consumedKcal) || 0));
  return remaining > 0 ? { state: 'full', remaining } : { state: 'done', remaining: 0 };
}

/**
 * full: kalan ≥ ürün kcal olan yemekler, proteine göre azalan. done: ≤ 400 kcal hafif yemekler,
 * proteine göre azalan. Makrosuz (kcal yok) ürün ve yan ürünler (sos) önerilmez.
 */
export function kcalPicks<T extends GrowthProduct>(products: readonly T[], state: KcalState, remaining: number): T[] {
  if (state === 'empty') return [];
  const cap = state === 'full' ? remaining : KCAL_SECTION.lightMaxKcal;
  return products
    .filter((p) => onSale(p) && isMeal(p))
    .filter((p) => {
      const k = productKcal(p);
      return k != null && k <= cap;
    })
    .sort((a, b) => (num(b.protein) ?? 0) - (num(a.protein) ?? 0) || (productKcal(a) ?? 0) - (productKcal(b) ?? 0))
    .slice(0, KCAL_SECTION.maxCards);
}

// ── 4) Planından sipariş et ───────────────────────────────────────────────────
export type PlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const PLAN_SLOT_ORDER: readonly PlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface PlanItemLike {
  id: string;
  date: string;
  slot: PlanSlot;
  source: 'recipe' | 'eatkcal' | 'custom';
  refId: string | null;
  name: string;
  kcal: number;
}

export interface PlanRow<T extends GrowthProduct = GrowthProduct> {
  item: PlanItemLike;
  product: T;
  via: 'id' | 'kcal';
}

/**
 * Bugünün plan öğünleri ↔ ürün. Kural (config.PLAN_MATCH):
 *  1) source = 'eatkcal' ve refId → o ürün (satışta değilse satır gizli, yedek eşleme YAPILMAZ:
 *     planlanan ürün bilinçli seçilmişti).
 *  2) diğerleri → aynı öğün tipinin kategorilerinde |kcal − plan| ≤ %10 olan en yakın ürün
 *     (eşitlikte yüksek protein, sonra küçük kimlik).
 *  3) eşleşme yok → satır yok. Sıra: kahvaltı, öğle, akşam, ara öğün.
 */
export function matchPlanItems<T extends GrowthProduct>(items: readonly PlanItemLike[], products: readonly T[], today: string): PlanRow<T>[] {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const rows: PlanRow<T>[] = [];
  const todays = items
    .filter((it) => it.date === today)
    .sort((a, b) => PLAN_SLOT_ORDER.indexOf(a.slot) - PLAN_SLOT_ORDER.indexOf(b.slot));
  for (const it of todays) {
    if (it.source === 'eatkcal' && it.refId) {
      const p = byId.get(String(it.refId));
      if (p && onSale(p)) rows.push({ item: it, product: p, via: 'id' });
      continue;
    }
    const target = Number(it.kcal) || 0;
    if (!(target > 0)) continue;
    const cats = PLAN_MATCH.slotCategories[it.slot] ?? [];
    let best: T | null = null;
    let bestDiff = Infinity;
    for (const p of products) {
      if (!onSale(p) || !cats.includes(cat(p))) continue;
      const k = productKcal(p);
      if (k == null) continue;
      const diff = Math.abs(k - target);
      if (diff > target * PLAN_MATCH.kcalTolerance) continue;
      const better =
        diff < bestDiff ||
        (diff === bestDiff && best != null && ((num(p.protein) ?? 0) > (num(best.protein) ?? 0) || ((num(p.protein) ?? 0) === (num(best.protein) ?? 0) && Number(p.id) < Number(best.id))));
      if (better) {
        best = p;
        bestDiff = diff;
      }
    }
    if (best) rows.push({ item: it, product: best, via: 'kcal' });
  }
  return rows;
}

// ── 5) Bu hafta en çok sipariş edilenler ──────────────────────────────────────
export interface TopRpcRow {
  product_id: number | string;
  rank: number;
  order_count: number;
}
export interface TopRow<T extends GrowthProduct = GrowthProduct> {
  product: T;
  rank: number;
  orderCount: number;
}

/** RPC satırları → kartlar (katalogda/satışta olmayan düşer, sıra 1..n yeniden). < 3 → [] (bölüm gizli). */
export function topRows<T extends GrowthProduct>(rpc: readonly TopRpcRow[] | null | undefined, products: readonly T[]): TopRow<T>[] {
  if (!Array.isArray(rpc)) return [];
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const rows = [...rpc]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .map((r) => ({ p: byId.get(String(r.product_id)), n: Math.max(0, Math.floor(Number(r.order_count) || 0)) }))
    .filter((r): r is { p: T; n: number } => !!r.p && onSale(r.p) && r.n > 0)
    .slice(0, TOP_SECTION.limit)
    .map((r, i) => ({ product: r.p, rank: i + 1, orderCount: r.n }));
  return rows.length >= TOP_SECTION.minProducts ? rows : [];
}

// ── 0) Kampanya şeridi koşulu + 6) Davet görünürlüğü ─────────────────────────
export type BannerAudience = 'signed_in' | 'guest' | 'no_orders' | 'has_orders';

export interface BannerCtx {
  signedIn: boolean;
  /** Teslim edilmiş siparişi var mı? Bilinmiyorsa null → sipariş koşullu banner GİZLİ (güvenli taraf). */
  hasOrders: boolean | null;
  /** Davet girişleri açık mı (inviteVisible). */
  inviteOn: boolean;
}

export function isInviteTarget(dest: string | null | undefined): boolean {
  return String(dest ?? '').trim() === 'Invite';
}

/** Koşulu sağlamayan banner sıradan çıkar. `audience` boş = herkes. */
export function bannerVisible(cell: { audience?: string | null; navigate_to?: string | null; link?: string | null }, ctx: BannerCtx): boolean {
  if (isInviteTarget(cell.navigate_to ?? cell.link) && !ctx.inviteOn) return false;
  const a = String(cell.audience ?? '').trim();
  if (!a) return true;
  if (a === 'signed_in') return ctx.signedIn;
  if (a === 'guest') return !ctx.signedIn;
  if (a === 'no_orders') return ctx.signedIn ? ctx.hasOrders === false : true;
  if (a === 'has_orders') return ctx.signedIn && ctx.hasOrders === true;
  return true; // bilinmeyen değer → eski uygulama gibi göster
}

/** Davet: giriş yapmış + `davet` bayrağı açık + ödül tutarı tanımlı. Misafirde ve bayrak kapalıyken hiçbir giriş yok. */
export function inviteVisible(input: { signedIn: boolean; flag: boolean; rewardTl: number | null | undefined }): boolean {
  return input.signedIn && input.flag && Number(input.rewardTl) > 0;
}
