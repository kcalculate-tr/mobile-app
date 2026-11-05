// eatkcal v2 — ürün detayı modeli: v2'nin ürettiği addItem argümanı, sepette
// bugünkü ekranla (src/screens/ProductDetailScreen.tsx) AYNI satırı (lineKey +
// unitPrice) üretir. cartStore node'da import edilemez (AsyncStorage/supabase);
// addItem'ın satır formülü (src/store/cartStore.ts addItem: normalizeSelectedOptions
// → buildCartLineKey; unitPrice = getEffectivePrice + extraPrice +
// calculateOptionsPriceModifier(templateOptions)) aynı saf fonksiyonlarla kurulur.
// Çalıştırma: npx tsx --test src/modules/eatkcal/v2/__tests__/productModel.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCartLineKey, normalizeSelectedOptions } from '../../../../lib/cart';
import { calculateOptionsPriceModifier, getEffectivePrice } from '../../../../utils/price';
import { computeProductUnitMacros } from '../../../../lib/itemMacros';
import type { CartSelectedOptions, OptionGroup, Product, ProductOptionLink, SelectedOption } from '../../../../types';
import {
  addTotal,
  buildCartAddCalls,
  buildTemplateOptions,
  deriveProduct,
  gramajTemplateOption,
  groupsExtraPrice,
  initialGramajIndex,
  initialGroupSelections,
  initialTemplateSelections,
  missingSelections,
  nonSplitByGroup,
  normalizeGramajOptions,
  splitSelectedItems,
  toggleGroupSelection,
  toggleTemplateSelection,
  type ProductSelectionState,
} from '../model/productModel';

/** cartStore.addItem'ın satır formülü (src/store/cartStore.ts:21-50). */
function cartStoreLine(product: Product, options: Partial<CartSelectedOptions>, parentLineKey?: string) {
  const n = normalizeSelectedOptions(options);
  const lineKey = parentLineKey
    ? `${parentLineKey}::x::${product.id}`
    : buildCartLineKey(String(product.id), n.byGroup, n.templateOptions);
  const unitPrice = Number(
    (getEffectivePrice(product) + n.extraPrice + calculateOptionsPriceModifier(n.templateOptions)).toFixed(2),
  );
  return { lineKey, unitPrice };
}

/** Bugünkü ekranın birim fiyat + lineKey formülü (ProductDetailScreen.tsx:639-674). */
function legacyScreen(s: ProductSelectionState) {
  const tpl = buildTemplateOptions(s.links, s.templateSelections);
  const g = s.gramajIndex >= 0 ? s.gramajOptions[s.gramajIndex] ?? null : null;
  const extraPrice = groupsExtraPrice(s.groups, s.selections);
  const totalUnitPrice = Number(
    (getEffectivePrice(s.product) + extraPrice + calculateOptionsPriceModifier(tpl) + (g ? g.price_modifier : 0)).toFixed(2),
  );
  const lineTpl: SelectedOption[] = [...tpl];
  if (g) lineTpl.unshift(gramajTemplateOption(g, s.gramajIndex));
  const split = splitSelectedItems(Boolean(s.product.is_bundle), s.groups, s.selections);
  const n = normalizeSelectedOptions({ byGroup: nonSplitByGroup(s.selections, split), templateOptions: lineTpl });
  return { totalUnitPrice, lineKey: buildCartLineKey(String(s.product.id), n.byGroup, n.templateOptions) };
}

const product: Product = {
  id: 42,
  name: 'Tavuk Bowl',
  price: 300,
  discount_type: 'percent',
  discount_value: 10,
  calories: 500,
  protein: 40,
  carbs: 50,
  fats: 12,
  brand: 'kcalculate',
  gramaj_options: [
    { name: '150 g', price_modifier: 0, calorie_modifier: 0, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 0, is_default: true, display_order: 0 },
    { name: '250 g', price_modifier: 150, calorie_modifier: 160, protein_modifier: 30, carbs_modifier: 0, fats_modifier: 4, is_default: false, display_order: 1 },
  ] as any,
};

const groups: OptionGroup[] = [
  {
    id: 'g-baz', name: 'Baz seçimi', description: '', minSelection: 1, maxSelection: 1, isRequired: true, sortOrder: 0,
    items: [
      { id: 'b1', groupId: 'g-baz', name: 'Basmati', priceAdjustment: 0, sortOrder: 0, isAvailable: true },
      { id: 'b2', groupId: 'g-baz', name: 'Kinoa', priceAdjustment: 25, sortOrder: 1, isAvailable: true },
    ],
  },
  {
    id: 'g-gar', name: 'Garnitür', description: '', minSelection: 0, maxSelection: 2, isRequired: false, sortOrder: 1,
    items: [
      { id: 'r1', groupId: 'g-gar', name: 'Brokoli', priceAdjustment: 0, sortOrder: 0, isAvailable: true },
      { id: 'r2', groupId: 'g-gar', name: 'Ayran', priceAdjustment: 35, sortOrder: 1, isAvailable: true, linkedProductId: 900, calories: 70, protein: 3, carbs: 5, fats: 3 },
      { id: 'r3', groupId: 'g-gar', name: 'Maş Fasulye', priceAdjustment: 15, sortOrder: 2, isAvailable: true },
    ],
  },
];

const links: ProductOptionLink[] = [
  {
    id: 1, product_id: 42, template_id: 7, is_required_override: null, min_selections_override: null, max_selections_override: null,
    display_order: 0, effective_required: true, effective_min: 1, effective_max: 1,
    template: {
      id: 7, name: 'Sos', selection_type: 'single', is_required_default: true, min_selections: 1, max_selections: 1,
      values: [
        { id: 70, template_id: 7, name: 'Yoğurt', price_modifier: 0, calorie_modifier: 40, protein_modifier: 2, carbs_modifier: 3, fats_modifier: 2, is_default: true, display_order: 0 },
        { id: 71, template_id: 7, name: 'Acı', price_modifier: 10, calorie_modifier: 20, protein_modifier: 0, carbs_modifier: 4, fats_modifier: 0, is_default: false, display_order: 1 },
      ],
    },
  },
];

function state(over: Partial<ProductSelectionState> = {}): ProductSelectionState {
  const gramajOptions = normalizeGramajOptions(product);
  return {
    product,
    groups,
    selections: initialGroupSelections(groups),
    links,
    templateSelections: initialTemplateSelections(links),
    gramajOptions,
    gramajIndex: initialGramajIndex(gramajOptions),
    ...over,
  };
}

test('başlangıç: varsayılan gramaj 0, template varsayılanı, çok öğeli zorunlu grup boş', () => {
  const s = state();
  assert.equal(s.gramajIndex, 0);
  assert.deepEqual(s.templateSelections, { 7: [70] });
  assert.deepEqual(s.selections, {});
  const miss = missingSelections({ ...s, gramajCount: s.gramajOptions.length });
  assert.deepEqual(miss.map((m) => m.key), ['g:g-baz']);
});

test('seçim geçişi: tekli değiştirir+ilerler, çoklu en fazla N', () => {
  assert.deepEqual(toggleGroupSelection(groups[0], ['b1'], 'b2'), { next: ['b2'], advance: true });
  assert.deepEqual(toggleGroupSelection(groups[1], [], 'r1'), { next: ['r1'], advance: false });
  assert.deepEqual(toggleGroupSelection(groups[1], ['r1'], 'r3'), { next: ['r1', 'r3'], advance: true });
  assert.equal(toggleGroupSelection(groups[1], ['r1', 'r3'], 'r2'), null);
  assert.deepEqual(toggleGroupSelection(groups[1], ['r1', 'r3'], 'r1'), { next: ['r3'], advance: false });
  assert.deepEqual(toggleTemplateSelection(links[0], [70], 71), [71]);
});

test('aynı seçimle v2 addItem argümanı → sepet satırı bugünkü ekranla AYNI (lineKey + unitPrice)', () => {
  const s = state({ selections: { 'g-baz': ['b2'], 'g-gar': ['r1', 'r3'] }, templateSelections: { 7: [71] }, gramajIndex: 1 });
  const legacy = legacyScreen(s);
  const calls = buildCartAddCalls(s, 1);
  assert.equal(calls.length, 1);
  const line = cartStoreLine(calls[0].product, calls[0].options);
  assert.equal(line.lineKey, legacy.lineKey);
  assert.equal(line.unitPrice, legacy.totalUnitPrice);
  // 300 −%10 = 270 + 25 (kinoa) + 15 (maş) + 10 (acı) + 150 (250 g) = 470
  assert.equal(line.unitPrice, 470);
  const d = deriveProduct(s);
  assert.equal(d.lineKey, legacy.lineKey);
  assert.equal(d.totalUnitPrice, 470);
  assert.equal(d.originalUnitPrice, 500);
  assert.equal(d.discountBadge, '-%10');
});

test('linked opsiyon: ana satır + bağlı alt satır; toplam = bugünkü ekranın gösterdiği birim fiyat', () => {
  const s = state({ selections: { 'g-baz': ['b1'], 'g-gar': ['r2'] } });
  const legacy = legacyScreen(s);
  const calls = buildCartAddCalls(s, 1);
  assert.equal(calls.length, 2);
  const main = cartStoreLine(calls[0].product, calls[0].options);
  const child = cartStoreLine(calls[1].product, calls[1].options, calls[1].parentLineKey);
  assert.equal(main.lineKey, legacy.lineKey);
  assert.equal(calls[1].parentLineKey, legacy.lineKey);
  assert.equal(child.lineKey, `${legacy.lineKey}::x::900`);
  assert.equal(Number((main.unitPrice + child.unitPrice).toFixed(2)), legacy.totalUnitPrice);
  assert.equal(calls[1].quantity, 1);
  assert.equal(addTotal(deriveProduct(s), 1), legacy.totalUnitPrice);
  // 2 adet: ana satır 2, bağlı satır 1 (bugünkü ekran: ekle + stepper ile aynı durum)
  const two = buildCartAddCalls(s, 2);
  assert.equal(two[0].quantity, 2);
  assert.equal(two[1].quantity, 1);
  assert.equal(addTotal(deriveProduct(s), 2), Number((main.unitPrice * 2 + child.unitPrice).toFixed(2)));
});

test('makro: tekli ürün gramaj + template modifikatörüyle computeProductUnitMacros', () => {
  const s = state({ selections: { 'g-baz': ['b1'] }, gramajIndex: 1, templateSelections: { 7: [70] } });
  const d = deriveProduct(s);
  const ref = computeProductUnitMacros(product, [s.gramajOptions[1], ...buildTemplateOptions(links, { 7: [70] })]);
  assert.deepEqual(d.macros, { kcal: ref.kcal, protein: ref.protein, carbs: ref.carbs, fats: ref.fat });
  assert.equal(d.macros.kcal, 700);
});

test('bundle: slot seçimleri bundleSelections olur, split yok, makro seçim toplamı', () => {
  const bundle: Product = { id: 77, name: 'Koli', price: 900, is_bundle: true };
  const bGroups: OptionGroup[] = [
    {
      id: 's1', name: '1. Öğün', description: '', minSelection: 1, maxSelection: 1, isRequired: true, sortOrder: 0,
      items: [{ id: 'm1', groupId: 's1', name: 'Somon', priceAdjustment: 0, sortOrder: 0, isAvailable: true, linkedProductId: 5, calories: 520, protein: 40, carbs: 30, fats: 20 }],
    },
  ];
  const s: ProductSelectionState = {
    product: bundle, groups: bGroups, selections: initialGroupSelections(bGroups), links: [], templateSelections: {}, gramajOptions: [], gramajIndex: -1,
  };
  const calls = buildCartAddCalls(s, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.bundleSelections?.length, 1);
  assert.equal(calls[0].options.bundleSelections?.[0].linked_product_id, 5);
  const d = deriveProduct(s);
  assert.equal(d.macros.kcal, 520);
  assert.equal(cartStoreLine(calls[0].product, calls[0].options).unitPrice, 900);
});
