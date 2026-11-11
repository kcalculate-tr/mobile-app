// G33-S1 — Öğün planı (Tur 26m) tipleri. SAF (RN yok) → tsx birim testleri doğrudan koşar.

/** Öğün yuvası — istemci kodu (sunucu meal_consumptions.meal_type için `toServerMealType`). */
export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOTS: readonly Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Alerjen anahtarları — TEK sözlük (kişisel plan akışı 26o da bunu kullanır). */
export type AllergenKey = 'peanut' | 'milk' | 'egg' | 'gluten' | 'seafood' | 'treenut' | 'sesame' | 'soy';
export const ALLERGENS: readonly AllergenKey[] = ['peanut', 'milk', 'egg', 'gluten', 'seafood', 'treenut', 'sesame', 'soy'];

/** Diyet tercihi — TEK sözlük (26o ile aynı). `all` = kısıt yok. */
export type DietKey = 'all' | 'vegetarian' | 'vegan' | 'pescatarian' | 'high_protein' | 'low_carb';
export const DIETS: readonly DietKey[] = ['all', 'vegetarian', 'vegan', 'pescatarian', 'high_protein', 'low_carb'];

/** Alışveriş kategorileri (tasarım sırası). */
export type ShopCategory = 'produce' | 'protein' | 'dairy' | 'grains' | 'spices' | 'other';
export const SHOP_CATEGORIES: readonly ShopCategory[] = ['produce', 'protein', 'dairy', 'grains', 'spices', 'other'];

/** Alışveriş listesindeki gösterim birimi. `g`/`ml` ağırlık; diğerleri adet benzeri (unitGrams ile çevrilir). */
export type ShopUnit = 'g' | 'ml' | 'adet' | 'dis' | 'dilim' | 'demet' | 'kutu' | 'yk' | 'tk' | 'ck';

export type Origin = 'plant' | 'dairy' | 'egg' | 'meat' | 'fish' | 'honey';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Ingredient {
  key: string;
  /** USDA FoodData Central kimliği (SR Legacy). */
  fdcId: number;
  nameTr: string;
  nameEn: string;
  category: ShopCategory;
  unit: ShopUnit;
  /** 1 birimin gramı (g/ml için 1). */
  unitGrams: number;
  allergens: AllergenKey[];
  origin: Origin;
  /** 100 g başına. */
  per100: Macros;
}

export interface RecipeIngredient {
  key: string;
  grams: number;
}

export interface Recipe {
  key: string;
  nameTr: string;
  nameEn: string;
  slot: Slot;
  ingredients: RecipeIngredient[];
}

/** Hesaplanmış tarif (makro/alerjen/diyet malzemelerden TÜRETİLİR). */
export interface RecipeInfo extends Recipe {
  macros: Macros;
  allergens: AllergenKey[];
  diets: DietKey[];
}

export type ItemSource = 'recipe' | 'eatkcal' | 'custom';

/** Plan satırı (meal_plan_items). Makro değerleri ekleme anındaki ANLIK değerdir. */
export interface PlanItem {
  id: string;
  date: string; // YYYY-MM-DD (Europe/Istanbul)
  slot: Slot;
  source: ItemSource;
  refId: string | null; // recipe key | eatkcal product id | null
  name: string;
  /** Tarif porsiyon çarpanı (1 = tarif). eatkcal/custom için 1. */
  portion: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** "Logla" sonrası meal_consumptions satırı. */
  loggedId: string | null;
  /** eatkcal ürün fiyatı (TL), yoksa null. */
  price?: number | null;
}

export interface EatkcalOption {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  price: number | null;
  slot?: Slot | null;
}

export type Tier = 'free' | 'fresh' | 'balance';
