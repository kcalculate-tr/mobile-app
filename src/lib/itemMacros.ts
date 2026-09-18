// Tek paylaşılan makro hesap kaynağı — sepet, ürün detayı, checkout toplamı
// ve sipariş/tracker kaydı hep BURADAN geçer. Amaç: "sepette makro eksik
// görünüyor" teşhisinde bulunan iki kök nedeni ortadan kaldırmak —
// (1) sepetin ürün eklenirken makroyu bir daha güncellenmeyecek şekilde
// "fotoğraflaması", (2) bundle olmayan ürünlerde seçili ekstra/opsiyonların
// sepette gösterilen makroya hiç yansımaması.
//
// Kural: bir alan (kcal/protein/carbs/fat) DB'de boş veya 0 ise "veri yok"
// sayılır ve null döner — çağıran taraf bunu "—" göstermek için kullanır,
// alanı GİZLEMEZ (bkz. formatMacroCompact / CartScreen).

export interface ItemMacros {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MacroProductLike {
  calories?: number | null;
  cal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
}

export interface MacroModifierLike {
  calorie_modifier?: number | null;
  protein_modifier?: number | null;
  carbs_modifier?: number | null;
  fats_modifier?: number | null;
}

export interface MacroBundleChildLike {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  // BundleSelection tip alanı `fat` (tekil); bazı kaynaklarda (option_items)
  // `fats` geçebilir — ikisi de kabul edilir.
  fat?: number | null;
  fats?: number | null;
}

const EMPTY_MACROS: ItemMacros = { kcal: null, protein: null, carbs: null, fat: null };

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Bu uygulamanın DB kuralı: 0 ve NULL aynı anlama gelir ("veri girilmemiş") —
// bkz. 2026-09-18 sepet-makro-teşhis raporu (44 üründe dört alan da ya NULL
// ya 0, kısmi eksik yok).
const hasValue = (v: unknown): boolean => num(v) > 0;

const roundG = (n: number): number => Math.round(n * 10) / 10;

function sumModifiers(options: MacroModifierLike[] | null | undefined) {
  return (options ?? []).reduce(
    (acc, o) => ({
      kcal: acc.kcal + num(o?.calorie_modifier),
      protein: acc.protein + num(o?.protein_modifier),
      carbs: acc.carbs + num(o?.carbs_modifier),
      fat: acc.fat + num(o?.fats_modifier),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * Bundle OLMAYAN tek bir ürünün BİR ADEDİNİN makrosu: ürünün kendi DB
 * değeri + seçili opsiyon/gramaj modifikatörlerinin toplamı. Ürünün taban
 * değeri boş/0 ise (veri yok) modifikatör olsa bile o alan null döner.
 */
export function computeProductUnitMacros(
  product: MacroProductLike | null | undefined,
  templateOptions?: MacroModifierLike[] | null,
): ItemMacros {
  const mods = sumModifiers(templateOptions);
  const baseKcal = product?.calories ?? product?.cal;
  return {
    kcal: hasValue(baseKcal) ? Math.max(0, Math.round(num(baseKcal) + mods.kcal)) : null,
    protein: hasValue(product?.protein) ? Math.max(0, roundG(num(product?.protein) + mods.protein)) : null,
    carbs: hasValue(product?.carbs) ? Math.max(0, roundG(num(product?.carbs) + mods.carbs)) : null,
    fat: hasValue(product?.fats) ? Math.max(0, roundG(num(product?.fats) + mods.fat)) : null,
  };
}

/**
 * Bundle (menü/paket) satırının BİR ADEDİNİN makrosu: seçilen öğünlerin
 * (slot'ların) toplamı. Hiç seçim yoksa veya toplam sıfırsa null (—) —
 * DB'de bundle'ın kendi satırının boş olması tasarım gereğidir, üzerine
 * modifikatör uygulanmaz (mevcut davranış korunur).
 */
export function computeBundleUnitMacros(
  selections: MacroBundleChildLike[] | null | undefined,
): ItemMacros {
  if (!selections || selections.length === 0) return EMPTY_MACROS;
  const totals = selections.reduce<{ kcal: number; protein: number; carbs: number; fat: number }>(
    (acc, s) => ({
      kcal: acc.kcal + num(s?.calories),
      protein: acc.protein + num(s?.protein),
      carbs: acc.carbs + num(s?.carbs),
      fat: acc.fat + num(s?.fat ?? s?.fats),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: totals.kcal > 0 ? Math.round(totals.kcal) : null,
    protein: totals.protein > 0 ? roundG(totals.protein) : null,
    carbs: totals.carbs > 0 ? roundG(totals.carbs) : null,
    fat: totals.fat > 0 ? roundG(totals.fat) : null,
  };
}

function multiplyMacros(m: ItemMacros, quantity: number): ItemMacros {
  return {
    kcal: m.kcal == null ? null : Math.round(m.kcal * quantity),
    protein: m.protein == null ? null : roundG(m.protein * quantity),
    carbs: m.carbs == null ? null : roundG(m.carbs * quantity),
    fat: m.fat == null ? null : roundG(m.fat * quantity),
  };
}

/**
 * Ürün + seçili ekstra/opsiyonlar (bundle ise alt ürün seçimleri) → BİR
 * ADEDİN makrosu (adet ÇARPILMAZ). `bundleSelections` doluysa bundle dalı,
 * değilse ürün+modifikatör dalı kullanılır — çağıran taraf ayrım yapmaz.
 */
export function computeUnitMacros(input: {
  product?: MacroProductLike | null;
  templateOptions?: MacroModifierLike[] | null;
  bundleSelections?: MacroBundleChildLike[] | null;
}): ItemMacros {
  const isBundleLine = Array.isArray(input.bundleSelections) && input.bundleSelections.length > 0;
  return isBundleLine
    ? computeBundleUnitMacros(input.bundleSelections)
    : computeProductUnitMacros(input.product, input.templateOptions);
}

/**
 * TEK PAYLAŞILAN GİRİŞ NOKTASI: ürün + adet + seçili ekstra/opsiyonlar
 * (bundle ise alt ürün seçimleri) → satırın TOPLAM (adet dahil) makrosu.
 * Sepet, ürün detayı (adet=1), checkout toplamı ve sipariş/tracker kaydı
 * (birim başı — bkz. computeUnitMacros) hep aynı hesaptan geçer.
 */
export function computeLineMacros(input: {
  product?: MacroProductLike | null;
  quantity?: number;
  templateOptions?: MacroModifierLike[] | null;
  bundleSelections?: MacroBundleChildLike[] | null;
}): ItemMacros {
  const quantity = Math.max(0, input.quantity ?? 1);
  return multiplyMacros(computeUnitMacros(input), quantity);
}

/** Birden fazla satırın makrosunu toplar (null + null = null, null + sayı = sayı). */
export function addMacros(a: ItemMacros, b: ItemMacros): ItemMacros {
  return {
    kcal: a.kcal == null && b.kcal == null ? null : (a.kcal ?? 0) + (b.kcal ?? 0),
    protein: a.protein == null && b.protein == null ? null : (a.protein ?? 0) + (b.protein ?? 0),
    carbs: a.carbs == null && b.carbs == null ? null : (a.carbs ?? 0) + (b.carbs ?? 0),
    fat: a.fat == null && b.fat == null ? null : (a.fat ?? 0) + (b.fat ?? 0),
  };
}

export const MISSING_MACRO_TEXT = '—';

/** "480" / "—" — pill içinde "kcal" son eki ayrıca eklenir. */
export function formatMacroKcal(v: number | null): string {
  return v == null ? MISSING_MACRO_TEXT : String(Math.round(v));
}

/** "42g" / "42.5g" / "—" */
export function formatMacroGrams(v: number | null): string {
  if (v == null) return MISSING_MACRO_TEXT;
  return `${v % 1 === 0 ? v : v.toFixed(1)}g`;
}

/** "480 kcal • P 42g • K 38g • Y 12g" — eksik alan "—" olur, gizlenmez. */
export function formatMacroCompact(m: ItemMacros): string {
  const kcal = m.kcal == null ? MISSING_MACRO_TEXT : `${formatMacroKcal(m.kcal)} kcal`;
  return `${kcal} • P ${formatMacroGrams(m.protein)} • K ${formatMacroGrams(m.carbs)} • Y ${formatMacroGrams(m.fat)}`;
}
