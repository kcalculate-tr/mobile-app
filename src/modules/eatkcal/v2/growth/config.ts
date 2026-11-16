// G56-S1 — eatkcal ana sayfa sipariş artırma bölümleri: TEK yapılandırma dosyası.
// Eşikler, kategori eşlemeleri ve bölüm sınırları yalnız burada. Saf (RN / Supabase yok).
//
// Ürün şeması (canlı, 16 Kas, salt okuma): products.category (metin, kategori adı), calories/cal,
// protein, carbs, fats, is_available, in_stock, type (hepsi 'meal'). Etiket / diyet / içerik alanı YOK.
//  · Vegan ve Tatlı için mevcut bir kategori ya da etiket YOK → eşleme UYDURULMADI; kategori listesi
//    boş bırakıldı ve çip GİZLİ (filterChips). Alan/kategori eklenince yalnız buraya adı yazmak yeter.
//  · İçecek: "Detoks & Shake" kategorisi (10 ürünün tamamı detoks suyu ya da protein shake).

export type FilterKey = 'all' | 'high_protein' | 'under_500' | 'vegan' | 'low_carb' | 'dessert' | 'drinks';

export interface FilterRule {
  key: FilterKey;
  /** i18n anahtarı (ek56.chips.*). */
  labelKey: string;
  /** Protein (g) alt sınırı — dahil. */
  minProtein?: number;
  /** Karbonhidrat (g) üst sınırı — dahil. */
  maxCarbs?: number;
  /** kcal üst sınırı — HARİÇ ("500 kcal altı"). */
  underKcal?: number;
  /** Ürünün `category` alanı bunlardan biri olmalı (tam ad). Boş dizi → kural yok → çip gizli. */
  categories?: readonly string[];
}

export const FILTER_THRESHOLDS = {
  highProteinMinG: 30,
  lowCarbMaxG: 20,
  underKcal: 500,
} as const;

export const FILTERS: readonly FilterRule[] = [
  { key: 'all', labelKey: 'ek56.chips.all' },
  { key: 'high_protein', labelKey: 'ek56.chips.high_protein', minProtein: FILTER_THRESHOLDS.highProteinMinG },
  { key: 'under_500', labelKey: 'ek56.chips.under_500', underKcal: FILTER_THRESHOLDS.underKcal },
  { key: 'vegan', labelKey: 'ek56.chips.vegan', categories: [] },
  { key: 'low_carb', labelKey: 'ek56.chips.low_carb', maxCarbs: FILTER_THRESHOLDS.lowCarbMaxG },
  { key: 'dessert', labelKey: 'ek56.chips.dessert', categories: [] },
  { key: 'drinks', labelKey: 'ek56.chips.drinks', categories: ['Detoks & Shake'] },
];

/** Öneri bölümlerinde (kalan kalori, plan eşlemesi) gösterilmeyen yan ürün kategorileri. */
export const NON_MEAL_CATEGORIES: readonly string[] = ['Soslar'];

/** Kalan kalori bölümü. */
export const KCAL_SECTION = {
  /** Hedef dolduğunda gösterilen hafif ürünlerin üst sınırı (dahil). */
  lightMaxKcal: 400,
  maxCards: 10,
} as const;

/** Tekrar sipariş: son N tamamlanmış sipariş. */
export const REORDER_LIMIT = 3;

/** Bu hafta en çok sipariş edilenler: RPC limiti ve en az ürün sayısı (altı → bölüm gizli). */
export const TOP_SECTION = { limit: 10, minProducts: 3 } as const;

/**
 * Planından sipariş et — plan öğünü ↔ eatkcal ürünü eşlemesi.
 *  1) Plan satırında ürün kimliği varsa (source = 'eatkcal', refId) o ürün (satışta değilse satır gizli).
 *  2) Yoksa AYNI ÖĞÜN TİPİNDE kcal ±%10 içindeki en yakın ürün. Ürünlerde öğün tipi alanı yok →
 *     öğün tipi aşağıdaki kategori listesinden okunur (yalnız bu listedeki kategoriler aday olur).
 *  3) Eşleşme yoksa satır gizlenir; hiçbiri eşleşmezse bölüm gizli.
 */
export const PLAN_MATCH = {
  kcalTolerance: 0.1,
  slotCategories: {
    breakfast: ['Omlette Box', 'Mavi Haşhaşlı Bagel Ekmeği', 'Ekşi Maya Sandviç'],
    lunch: ["Bowl's", "Wrap's", 'Yüksek Protein', 'Yağ Yakımı', 'Dengeli ve Sağlıklı', 'Ekşi Maya Sandviç'],
    dinner: ["Bowl's", "Wrap's", 'Yüksek Protein', 'Yağ Yakımı', 'Dengeli ve Sağlıklı'],
    snack: ['Detoks & Shake'],
  } as Record<'breakfast' | 'lunch' | 'dinner' | 'snack', readonly string[]>,
} as const;
