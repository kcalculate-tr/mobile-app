// eatkcal v2 (G13-S2 md.3) — ürün detayı seçim/fiyat/makro/sepet satırı
// modeli. SAF (native yok) → birim testinden import edilir.
//
// YENİ MANTIK YOK. Hesaplar mevcut fonksiyonlarla yapılır:
//   fiyat  → src/utils/price.ts getEffectivePrice / hasDiscount /
//            calculateOptionsPriceModifier / formatDiscountBadge
//   makro  → src/lib/itemMacros.ts computeProductUnitMacros / computeBundleUnitMacros
//   limit  → src/lib/products.ts getGroupSelectionLimits
//   satır  → src/lib/cart.ts normalizeSelectedOptions / buildCartLineKey
//   sepet  → useCartStore.addItem(product, options, quantity, parentLineKey)
// Bugünkü ekranda (src/screens/ProductDetailScreen.tsx, KİMSE) INLINE duran
// yapıştırıcı (seçim geçişi, gramaj → sanal template opsiyonu, linked opsiyon
// "split", bundle slot listesi, addItem argümanı) burada BİREBİR aynı
// davranışla saf fonksiyon olarak durur; her fonksiyonun yorumunda kaynak
// satır var. İLTER'E: bu yapıştırıcının tek kaynağa (lib) indirilmesi önerilir
// (ProductDetailScreen KİMSE dosyası olduğu için bu oturum dokunmadı).
import type {
  BundleSelection,
  CartSelectedOptions,
  OptionGroup,
  OptionItem,
  Product,
  ProductOptionLink,
  SelectedOption,
} from '../../../../types';
import { getGroupSelectionLimits } from '../../../../lib/products';
import { buildCartLineKey, normalizeSelectedOptions } from '../../../../lib/cart';
import {
  calculateOptionsPriceModifier,
  formatDiscountBadge,
  getEffectivePrice,
  hasDiscount,
} from '../../../../utils/price';
import { computeBundleUnitMacros, computeProductUnitMacros } from '../../../../lib/itemMacros';

/** Sanal gramaj template'i — sepette/siparişte bu adla saklanır (ÇEVRİLMEZ). */
export const GRAMAJ_TEMPLATE_NAME = 'Et Gramajı';

export type GroupSelections = Record<string, string[]>;
export type TemplateSelections = Record<number, number[]>;

export interface GramajOptionNorm {
  name: string;
  price_modifier: number;
  calorie_modifier: number;
  protein_modifier: number;
  carbs_modifier: number;
  fats_modifier: number;
  is_default: boolean;
  display_order: number;
}

// ── Başlangıç seçimleri ────────────────────────────────────────────────────

/** ProductDetailScreen.tsx:311-318 — tek öğeli zorunlu grup otomatik seçilir. */
export function initialGroupSelections(groups: readonly OptionGroup[]): GroupSelections {
  const out: GroupSelections = {};
  groups.forEach((grp) => {
    const required = grp.isRequired || (grp.minSelection ?? 0) >= 1;
    if (required && grp.items.length === 1) out[grp.id] = [grp.items[0].id];
  });
  return out;
}

/** ProductDetailScreen.tsx:352-362 — template varsayılanları. */
export function initialTemplateSelections(links: readonly ProductOptionLink[]): TemplateSelections {
  const out: TemplateSelections = {};
  links.forEach((link) => {
    const tpl = link.template;
    if (!tpl) return;
    if (tpl.selection_type === 'single') {
      const def = tpl.values.find((v) => v.is_default) ?? tpl.values[0];
      out[tpl.id] = def ? [def.id] : [];
    } else {
      out[tpl.id] = tpl.values.filter((v) => v.is_default).map((v) => v.id);
    }
  });
  return out;
}

/** ProductDetailScreen.tsx:423-439 — product.gramaj_options normalizasyonu. */
export function normalizeGramajOptions(product: Product | null | undefined): GramajOptionNorm[] {
  const raw = Array.isArray(product?.gramaj_options) ? (product!.gramaj_options as unknown[]) : [];
  return raw
    .map((g: any, idx: number) => ({
      name: String(g?.name ?? '').trim(),
      price_modifier: Number(g?.price_modifier) || 0,
      calorie_modifier: Number(g?.calorie_modifier) || 0,
      protein_modifier: Number(g?.protein_modifier) || 0,
      carbs_modifier: Number(g?.carbs_modifier) || 0,
      fats_modifier: Number(g?.fats_modifier) || 0,
      is_default: Boolean(g?.is_default),
      display_order: Number(g?.display_order) || idx,
    }))
    .filter((g) => g.name.length > 0)
    .sort((a, b) => a.display_order - b.display_order);
}

/** ProductDetailScreen.tsx:497-507 — varsayılan gramaj indeksi (yoksa 0; liste boşsa -1). */
export function initialGramajIndex(options: readonly GramajOptionNorm[]): number {
  if (options.length === 0) return -1;
  const idx = options.findIndex((g) => g.is_default);
  return idx >= 0 ? idx : 0;
}

// ── Seçim geçişleri ────────────────────────────────────────────────────────

/**
 * ProductDetailScreen.tsx:552-577 — grup seçimi. `null` → değişiklik yok
 * (limit dolu). `advance` → sonraki gruba kaydırma ipucu.
 */
export function toggleGroupSelection(
  group: OptionGroup,
  current: readonly string[],
  itemId: string,
): { next: string[]; advance: boolean } | null {
  const { max } = getGroupSelectionLimits(group);
  const set = new Set(current);
  if (max === 1) return { next: [itemId], advance: true };
  if (set.has(itemId)) {
    set.delete(itemId);
    return { next: Array.from(set), advance: false };
  }
  if (set.size < max) {
    set.add(itemId);
    const next = Array.from(set);
    return { next, advance: next.length === max };
  }
  return null;
}

/** ProductDetailScreen.tsx:371-387 — template seçimi (single → değiştir; multiple → limitli aç/kapa). */
export function toggleTemplateSelection(
  link: ProductOptionLink,
  current: readonly number[],
  valueId: number,
): number[] {
  const tpl = link.template;
  if (!tpl) return [...current];
  if (tpl.selection_type === 'single') return [valueId];
  if (current.includes(valueId)) return current.filter((id) => id !== valueId);
  if (link.effective_max != null && current.length >= link.effective_max) return [...current];
  return [...current, valueId];
}

// ── Türetilmiş değerler ────────────────────────────────────────────────────

/** ProductDetailScreen.tsx:390-413 — seçili template değerleri → SelectedOption[]. */
export function buildTemplateOptions(
  links: readonly ProductOptionLink[],
  selected: TemplateSelections,
): SelectedOption[] {
  const result: SelectedOption[] = [];
  links.forEach((link) => {
    const tpl = link.template;
    if (!tpl) return;
    (selected[tpl.id] || []).forEach((vid) => {
      const v = tpl.values.find((val) => val.id === vid);
      if (!v) return;
      result.push({
        template_id: tpl.id,
        template_name: tpl.name,
        value_id: v.id,
        value_name: v.name,
        price_modifier: Number(v.price_modifier) || 0,
        calorie_modifier: Number(v.calorie_modifier) || 0,
        protein_modifier: Number(v.protein_modifier) || 0,
        carbs_modifier: Number(v.carbs_modifier) || 0,
        fats_modifier: Number(v.fats_modifier) || 0,
      });
    });
  });
  return result;
}

/** ProductDetailScreen.tsx:652-664 / 734-746 — gramaj sanal template opsiyonu (value_id = indeks). */
export function gramajTemplateOption(g: GramajOptionNorm, index: number): SelectedOption {
  return {
    template_id: 0,
    template_name: GRAMAJ_TEMPLATE_NAME,
    value_id: index,
    value_name: g.name,
    price_modifier: Number(g.price_modifier) || 0,
    calorie_modifier: Number(g.calorie_modifier) || 0,
    protein_modifier: Number(g.protein_modifier) || 0,
    carbs_modifier: Number(g.carbs_modifier) || 0,
    fats_modifier: Number(g.fats_modifier) || 0,
  };
}

/** ProductDetailScreen.tsx:579-587 — tüm uuid grupları min..max aralığında mı? */
export function groupsValid(groups: readonly OptionGroup[], selections: GroupSelections): boolean {
  if (!groups.length) return true;
  return groups.every((group) => {
    const { min, max } = getGroupSelectionLimits(group);
    const n = (selections[group.id] || []).length;
    return n >= min && n <= max;
  });
}

/** Grup zorunlu mu (başlık rozeti) — ProductDetailScreen.tsx:1022. */
export function isGroupRequired(group: OptionGroup): boolean {
  return group.isRequired || getGroupSelectionLimits(group).min > 0;
}

/**
 * Eksik seçimler — ProductDetailScreen.tsx:530-546 (template) + 718-722
 * (gramaj) + 1017 (uuid grup `selectedCount < min`). Kimlikler UI vurgusu için.
 */
export function missingSelections(input: {
  groups: readonly OptionGroup[];
  selections: GroupSelections;
  links: readonly ProductOptionLink[];
  templateSelections: TemplateSelections;
  gramajCount: number;
  gramajIndex: number;
}): { key: string; name: string }[] {
  const out: { key: string; name: string }[] = [];
  if (input.gramajCount > 0 && (input.gramajIndex < 0 || input.gramajIndex >= input.gramajCount)) {
    out.push({ key: 'gramaj', name: GRAMAJ_TEMPLATE_NAME });
  }
  input.groups.forEach((group) => {
    const { min, max } = getGroupSelectionLimits(group);
    const n = (input.selections[group.id] || []).length;
    if (n < min || n > max) out.push({ key: `g:${group.id}`, name: group.name });
  });
  input.links.forEach((link) => {
    const tpl = link.template;
    if (!tpl) return;
    const sel = input.templateSelections[tpl.id] || [];
    if (link.effective_required && sel.length === 0) {
      out.push({ key: `t:${tpl.id}`, name: tpl.name });
      return;
    }
    if (tpl.selection_type === 'multiple' && link.effective_min > 0 && sel.length < link.effective_min) {
      out.push({ key: `t:${tpl.id}`, name: tpl.name });
    }
  });
  return out;
}

/** ProductDetailScreen.tsx:589-600 — seçili uuid opsiyonlarının fiyat farkı toplamı. */
export function groupsExtraPrice(groups: readonly OptionGroup[], selections: GroupSelections): number {
  let total = 0;
  groups.forEach((group) => {
    const ids = new Set(selections[group.id] || []);
    group.items.forEach((item) => {
      if (ids.has(item.id)) total += item.priceAdjustment;
    });
  });
  return Number(total.toFixed(2));
}

export interface SplitItem {
  groupId: string;
  groupName: string;
  item: OptionItem;
}

/** ProductDetailScreen.tsx:606-620 — tekli üründe linked_product_id'li seçimler ayrı satır olur. */
export function splitSelectedItems(
  isBundle: boolean,
  groups: readonly OptionGroup[],
  selections: GroupSelections,
): SplitItem[] {
  if (isBundle) return [];
  const out: SplitItem[] = [];
  groups.forEach((group) => {
    const ids = new Set(selections[group.id] || []);
    group.items.forEach((item) => {
      if (ids.has(item.id) && item.linkedProductId != null) {
        out.push({ groupId: group.id, groupName: group.name, item });
      }
    });
  });
  return out;
}

/** ProductDetailScreen.tsx:630-637 — split edilmeyen seçimler (ana satırın byGroup'u). */
export function nonSplitByGroup(selections: GroupSelections, split: readonly SplitItem[]): GroupSelections {
  const splitIds = new Set(split.map((s) => s.item.id));
  const out: GroupSelections = {};
  Object.entries(selections).forEach(([gid, ids]) => {
    const kept = ids.filter((id) => !splitIds.has(id));
    if (kept.length > 0) out[gid] = kept;
  });
  return out;
}

/** ProductDetailScreen.tsx:750-767 — bundle slot seçimleri (self-contained isim + makro). */
export function buildBundleSelections(
  isBundle: boolean,
  groups: readonly OptionGroup[],
  selections: GroupSelections,
): BundleSelection[] {
  if (!isBundle) return [];
  return groups.flatMap((group) => {
    const ids = new Set(selections[group.id] || []);
    return group.items
      .filter((item) => ids.has(item.id))
      .map((item) => ({
        slot_name: group.name,
        option_item_id: item.id,
        linked_product_id: item.linkedProductId ?? null,
        name: item.name,
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fats) || 0,
      }));
  });
}

// ── Toplu durum: fiyat + makro + sepet argümanı ────────────────────────────

export interface ProductSelectionState {
  product: Product;
  groups: readonly OptionGroup[];
  selections: GroupSelections;
  links: readonly ProductOptionLink[];
  templateSelections: TemplateSelections;
  gramajOptions: readonly GramajOptionNorm[];
  gramajIndex: number;
}

export interface DisplayMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface ProductDerived {
  isBundle: boolean;
  selectedGramaj: GramajOptionNorm | null;
  templateOptions: SelectedOption[];
  /** Ana satırın template listesi (gramaj başta) — ProductDetailScreen.tsx:734-746. */
  cartTemplateOptions: SelectedOption[];
  /** Ekranda gösterilen birim fiyat — ProductDetailScreen.tsx:641-643. */
  totalUnitPrice: number;
  /** İndirim öncesi birim fiyat — ProductDetailScreen.tsx:644-646. */
  originalUnitPrice: number;
  hasDiscount: boolean;
  discountBadge: string | null;
  /** Birim makro (bundle → seçimlerin toplamı) — ProductDetailScreen.tsx:455-489, 856. */
  macros: DisplayMacros;
  /** Makro kartı gösterilir mi — ProductDetailScreen.tsx:196 / 993. */
  macroCardEnabled: boolean;
  split: SplitItem[];
  byGroup: GroupSelections;
  /** Ana satırın sepet anahtarı — ProductDetailScreen.tsx:649-674. */
  lineKey: string;
}

export function deriveProduct(s: ProductSelectionState): ProductDerived {
  const isBundle = Boolean(s.product.is_bundle);
  const selectedGramaj =
    s.gramajIndex >= 0 && s.gramajIndex < s.gramajOptions.length ? s.gramajOptions[s.gramajIndex] : null;
  const templateOptions = buildTemplateOptions(s.links, s.templateSelections);
  const templateMod = calculateOptionsPriceModifier(templateOptions);
  const gramajMod = selectedGramaj ? Number(selectedGramaj.price_modifier) || 0 : 0;
  const extraPrice = groupsExtraPrice(s.groups, s.selections);
  const effectiveBase = getEffectivePrice(s.product);
  const totalUnitPrice = Number((effectiveBase + extraPrice + templateMod + gramajMod).toFixed(2));
  const originalUnitPrice = Number(((s.product.price || 0) + extraPrice + templateMod + gramajMod).toFixed(2));

  let macros: DisplayMacros;
  if (isBundle) {
    const items: OptionItem[] = [];
    s.groups.forEach((group) => {
      const ids = new Set(s.selections[group.id] || []);
      group.items.forEach((item) => {
        if (ids.has(item.id)) items.push(item);
      });
    });
    const m = computeBundleUnitMacros(items);
    macros = { kcal: m.kcal ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fats: m.fat ?? 0 };
  } else {
    const modifiers = selectedGramaj ? [selectedGramaj, ...templateOptions] : templateOptions;
    const m = computeProductUnitMacros(s.product, modifiers);
    macros = { kcal: m.kcal ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fats: m.fat ?? 0 };
  }

  const cartTemplateOptions: SelectedOption[] = selectedGramaj
    ? [gramajTemplateOption(selectedGramaj, s.gramajIndex), ...templateOptions]
    : [...templateOptions];

  const split = splitSelectedItems(isBundle, s.groups, s.selections);
  const byGroup = nonSplitByGroup(s.selections, split);
  const normalized = normalizeSelectedOptions({ byGroup, templateOptions: cartTemplateOptions });
  const lineKey = buildCartLineKey(String(s.product.id), normalized.byGroup, normalized.templateOptions);

  return {
    isBundle,
    selectedGramaj,
    templateOptions,
    cartTemplateOptions,
    totalUnitPrice,
    originalUnitPrice,
    hasDiscount: hasDiscount(s.product),
    discountBadge: formatDiscountBadge(s.product.discount_type, s.product.discount_value),
    macros,
    macroCardEnabled: isBundle || (s.product.calories ?? s.product.cal) != null,
    split,
    byGroup,
    lineKey,
  };
}

export interface CartAddCall {
  product: Product;
  options: Partial<CartSelectedOptions>;
  quantity: number;
  parentLineKey?: string;
}

/**
 * ProductDetailScreen.tsx:748-811 — `addItem` çağrıları (sıra: ana satır,
 * sonra linked opsiyon satırları). Ana satır `quantity` adet; linked satırlar
 * bugünkü ekrandaki gibi 1 adet (bugünkü ekranda adet artışı
 * `updateQuantity(parent)` ile yapılır, alt satırlar 1'de kalır — aynı sonuç).
 */
export function buildCartAddCalls(s: ProductSelectionState, quantity = 1): CartAddCall[] {
  const d = deriveProduct(s);
  const splitIds = new Set(d.split.map((x) => x.item.id));
  let mainExtraPrice = 0;
  const mainLabels: string[] = [];
  s.groups.forEach((group) => {
    const ids = new Set(s.selections[group.id] || []);
    group.items.forEach((item) => {
      if (!ids.has(item.id) || splitIds.has(item.id)) return;
      mainExtraPrice += item.priceAdjustment;
      mainLabels.push(`${group.name}: ${item.name}`);
    });
  });
  const bundleSelections = buildBundleSelections(d.isBundle, s.groups, s.selections);
  const calls: CartAddCall[] = [
    {
      product: s.product,
      options: {
        byGroup: d.byGroup,
        extraPrice: Number(mainExtraPrice.toFixed(2)),
        labels: mainLabels,
        templateOptions: d.cartTemplateOptions.length > 0 ? d.cartTemplateOptions : undefined,
        bundleSelections: bundleSelections.length > 0 ? bundleSelections : undefined,
      },
      quantity: Math.max(1, Math.floor(quantity)),
    },
  ];
  d.split.forEach(({ groupName, item }) => {
    const optProduct: Product = {
      id: item.linkedProductId as number,
      name: item.name,
      price: Number(item.priceAdjustment) || 0,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fats: Number(item.fats) || 0,
      is_bundle: false,
    };
    calls.push({ product: optProduct, options: { labels: [groupName] }, quantity: 1, parentLineKey: d.lineKey });
  });
  return calls;
}

/**
 * Sepete eklenecek toplam tutar (alt bar): ana birim × adet + linked satırlar
 * (1 adet). Linked satır yoksa = ekrandaki birim fiyat × adet.
 */
export function addTotal(d: ProductDerived, quantity: number, basis: 'effective' | 'original' = 'effective'): number {
  const q = Math.max(1, Math.floor(quantity));
  const splitSum = d.split.reduce((n, s) => n + (Number(s.item.priceAdjustment) || 0), 0);
  const unit = basis === 'original' ? d.originalUnitPrice : d.totalUnitPrice;
  const mainUnit = Number((unit - splitSum).toFixed(2));
  return Number((mainUnit * q + splitSum).toFixed(2));
}

/** Halka dolumları — ProductDetailScreen.tsx:859-895 ile aynı oranlar. */
export function ringProgress(m: DisplayMacros): { kcal: number; protein: number; carbs: number; fats: number } {
  const total = m.carbs * 4 + m.protein * 4 + m.fats * 9 || 1;
  return {
    kcal: Math.min(m.kcal / 2000, 1),
    protein: Math.min((m.protein * 4) / total, 1),
    carbs: Math.min((m.carbs * 4) / total, 1),
    fats: Math.min((m.fats * 9) / total, 1),
  };
}

/** Seçenek kutusundaki kcal: bilinen veri varsa (bundle/linked kalem veya template/gramaj modifikatörü). */
export function optionKcal(item: OptionItem): number | null {
  const v = Number(item.calories);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}
