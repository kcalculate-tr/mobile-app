// G54-S1 md.4a — "Yemediğin bir şey var mı?" SAF besin sözlüğü (RN yok → node:test). Gruplu hazır çipler + yerel
// ~150 besinlik TR/EN arama listesi + serbest metin (özel öğe, `custom:` öneki). En çok 30 öğe. "Hepsini yerim" ile
// karşılıklı temizleme. Kayıt değeri: standart anahtarlar + `custom:<metin>`; plan/öneri üretiminde dışlanacak besin.
// Eski anahtarlar (G42: red_meat, dairy, legumes, nuts, …) aynı kalır → eski kayıtlar okunur.

export type DislikeGroup = 'meat' | 'sea' | 'dairy_egg' | 'grain' | 'legume_nut' | 'veg' | 'fruit' | 'taste' | 'other';
export const DISLIKE_MAX = 30;
export const CUSTOM_PREFIX = 'custom:';
export const CUSTOM_MAX_LEN = 40;

/** Hazır çip grupları (tasarım sırası). */
export const DISLIKE_GROUPS: readonly { key: DislikeGroup; items: readonly string[] }[] = [
  { key: 'meat', items: ['red_meat', 'chicken', 'turkey', 'offal', 'processed_meat'] },
  { key: 'sea', items: ['fish', 'seafood', 'tuna'] },
  { key: 'dairy_egg', items: ['milk', 'yogurt', 'cheese', 'egg'] },
  { key: 'grain', items: ['gluten', 'rice', 'pasta', 'bread'] },
  { key: 'legume_nut', items: ['legumes', 'peanut', 'nuts', 'soy', 'sesame'] },
  { key: 'veg', items: ['onion', 'garlic', 'eggplant', 'mushroom', 'pepper', 'tomato', 'broccoli', 'cauliflower', 'celery', 'okra'] },
  { key: 'fruit', items: ['strawberry', 'banana', 'avocado', 'citrus'] },
  { key: 'taste', items: ['spicy', 'sweet', 'coriander', 'sour'] },
  { key: 'other', items: ['caffeine', 'alcohol'] },
];

export const DISLIKE_GROUP_LABEL: Record<DislikeGroup, { tr: string; en: string }> = {
  meat: { tr: 'Et ve tavuk', en: 'Meat and poultry' },
  sea: { tr: 'Deniz ürünleri', en: 'Seafood' },
  dairy_egg: { tr: 'Süt ve yumurta', en: 'Dairy and eggs' },
  grain: { tr: 'Tahıl ve gluten', en: 'Grains and gluten' },
  legume_nut: { tr: 'Baklagil ve kuruyemiş', en: 'Legumes and nuts' },
  veg: { tr: 'Sebze', en: 'Vegetables' },
  fruit: { tr: 'Meyve', en: 'Fruit' },
  taste: { tr: 'Tat', en: 'Taste' },
  other: { tr: 'Diğer', en: 'Other' },
};

/** Yerel arama listesi (TR / EN). Hazır çiplerin hepsi + ek besinler. */
export const FOODS: Record<string, { tr: string; en: string }> = {
  // Gruplar
  red_meat: { tr: 'Kırmızı et', en: 'Red meat' },
  chicken: { tr: 'Tavuk', en: 'Chicken' },
  turkey: { tr: 'Hindi', en: 'Turkey' },
  offal: { tr: 'Sakatat', en: 'Offal' },
  processed_meat: { tr: 'İşlenmiş et', en: 'Processed meat' },
  fish: { tr: 'Balık', en: 'Fish' },
  seafood: { tr: 'Karides ve kabuklular', en: 'Shrimp and shellfish' },
  tuna: { tr: 'Ton balığı', en: 'Tuna' },
  milk: { tr: 'Süt', en: 'Milk' },
  yogurt: { tr: 'Yoğurt', en: 'Yogurt' },
  cheese: { tr: 'Peynir', en: 'Cheese' },
  egg: { tr: 'Yumurta', en: 'Egg' },
  gluten: { tr: 'Buğday ve gluten', en: 'Wheat and gluten' },
  rice: { tr: 'Pirinç', en: 'Rice' },
  pasta: { tr: 'Makarna', en: 'Pasta' },
  bread: { tr: 'Ekmek', en: 'Bread' },
  legumes: { tr: 'Baklagiller', en: 'Legumes' },
  peanut: { tr: 'Yer fıstığı', en: 'Peanuts' },
  nuts: { tr: 'Ceviz ve fındık', en: 'Walnuts and hazelnuts' },
  soy: { tr: 'Soya', en: 'Soy' },
  sesame: { tr: 'Susam', en: 'Sesame' },
  onion: { tr: 'Soğan', en: 'Onion' },
  garlic: { tr: 'Sarımsak', en: 'Garlic' },
  eggplant: { tr: 'Patlıcan', en: 'Eggplant' },
  mushroom: { tr: 'Mantar', en: 'Mushroom' },
  pepper: { tr: 'Biber', en: 'Pepper' },
  tomato: { tr: 'Domates', en: 'Tomato' },
  broccoli: { tr: 'Brokoli', en: 'Broccoli' },
  cauliflower: { tr: 'Karnabahar', en: 'Cauliflower' },
  celery: { tr: 'Kereviz', en: 'Celery' },
  okra: { tr: 'Bamya', en: 'Okra' },
  strawberry: { tr: 'Çilek', en: 'Strawberry' },
  banana: { tr: 'Muz', en: 'Banana' },
  avocado: { tr: 'Avokado', en: 'Avocado' },
  citrus: { tr: 'Narenciye', en: 'Citrus' },
  spicy: { tr: 'Acı', en: 'Spicy food' },
  sweet: { tr: 'Tatlı', en: 'Sweets' },
  coriander: { tr: 'Kişniş', en: 'Coriander' },
  sour: { tr: 'Ekşi', en: 'Sour food' },
  caffeine: { tr: 'Kafein', en: 'Caffeine' },
  alcohol: { tr: 'Alkol', en: 'Alcohol' },
  // G42 eski anahtarlar (yalnız aramada)
  dairy: { tr: 'Süt ürünleri', en: 'Dairy' },
  olive: { tr: 'Zeytin', en: 'Olives' },
  zucchini: { tr: 'Kabak', en: 'Zucchini' },
  spinach: { tr: 'Ispanak', en: 'Spinach' },
  lamb: { tr: 'Kuzu eti', en: 'Lamb' },
  oats: { tr: 'Yulaf', en: 'Oats' },
  potato: { tr: 'Patates', en: 'Potato' },
  parsley: { tr: 'Maydanoz', en: 'Parsley' },
  cinnamon: { tr: 'Tarçın', en: 'Cinnamon' },
  coconut: { tr: 'Hindistan cevizi', en: 'Coconut' },
  // Ek besinler
  beef: { tr: 'Dana eti', en: 'Beef' },
  pork: { tr: 'Domuz eti', en: 'Pork' },
  liver: { tr: 'Ciğer', en: 'Liver' },
  sausage: { tr: 'Sucuk', en: 'Sausage' },
  salami: { tr: 'Salam', en: 'Salami' },
  pastrami: { tr: 'Pastırma', en: 'Pastrami' },
  meatball: { tr: 'Köfte', en: 'Meatballs' },
  anchovy: { tr: 'Hamsi', en: 'Anchovy' },
  salmon: { tr: 'Somon', en: 'Salmon' },
  sardine: { tr: 'Sardalya', en: 'Sardines' },
  squid: { tr: 'Kalamar', en: 'Squid' },
  mussel: { tr: 'Midye', en: 'Mussels' },
  octopus: { tr: 'Ahtapot', en: 'Octopus' },
  crab: { tr: 'Yengeç', en: 'Crab' },
  butter: { tr: 'Tereyağı', en: 'Butter' },
  cream: { tr: 'Krema', en: 'Cream' },
  kefir: { tr: 'Kefir', en: 'Kefir' },
  ayran: { tr: 'Ayran', en: 'Ayran' },
  honey: { tr: 'Bal', en: 'Honey' },
  sugar: { tr: 'Şeker', en: 'Sugar' },
  chocolate: { tr: 'Çikolata', en: 'Chocolate' },
  corn: { tr: 'Mısır', en: 'Corn' },
  bulgur: { tr: 'Bulgur', en: 'Bulgur' },
  quinoa: { tr: 'Kinoa', en: 'Quinoa' },
  barley: { tr: 'Arpa', en: 'Barley' },
  chickpea: { tr: 'Nohut', en: 'Chickpeas' },
  lentil: { tr: 'Mercimek', en: 'Lentils' },
  beans: { tr: 'Kuru fasulye', en: 'Beans' },
  green_beans: { tr: 'Taze fasulye', en: 'Green beans' },
  peas: { tr: 'Bezelye', en: 'Peas' },
  almond: { tr: 'Badem', en: 'Almonds' },
  pistachio: { tr: 'Antep fıstığı', en: 'Pistachios' },
  cashew: { tr: 'Kaju', en: 'Cashews' },
  sunflower_seed: { tr: 'Ay çekirdeği', en: 'Sunflower seeds' },
  tahini: { tr: 'Tahin', en: 'Tahini' },
  peanut_butter: { tr: 'Fıstık ezmesi', en: 'Peanut butter' },
  tofu: { tr: 'Tofu', en: 'Tofu' },
  carrot: { tr: 'Havuç', en: 'Carrot' },
  cabbage: { tr: 'Lahana', en: 'Cabbage' },
  cucumber: { tr: 'Salatalık', en: 'Cucumber' },
  lettuce: { tr: 'Marul', en: 'Lettuce' },
  arugula: { tr: 'Roka', en: 'Arugula' },
  leek: { tr: 'Pırasa', en: 'Leek' },
  beet: { tr: 'Pancar', en: 'Beetroot' },
  radish: { tr: 'Turp', en: 'Radish' },
  artichoke: { tr: 'Enginar', en: 'Artichoke' },
  asparagus: { tr: 'Kuşkonmaz', en: 'Asparagus' },
  brussels: { tr: 'Brüksel lahanası', en: 'Brussels sprouts' },
  kale: { tr: 'Kara lahana', en: 'Kale' },
  sweet_potato: { tr: 'Tatlı patates', en: 'Sweet potato' },
  pumpkin: { tr: 'Bal kabağı', en: 'Pumpkin' },
  apple: { tr: 'Elma', en: 'Apple' },
  pear: { tr: 'Armut', en: 'Pear' },
  orange: { tr: 'Portakal', en: 'Orange' },
  lemon: { tr: 'Limon', en: 'Lemon' },
  grapefruit: { tr: 'Greyfurt', en: 'Grapefruit' },
  grape: { tr: 'Üzüm', en: 'Grapes' },
  watermelon: { tr: 'Karpuz', en: 'Watermelon' },
  melon: { tr: 'Kavun', en: 'Melon' },
  peach: { tr: 'Şeftali', en: 'Peach' },
  apricot: { tr: 'Kayısı', en: 'Apricot' },
  cherry: { tr: 'Kiraz', en: 'Cherries' },
  sour_cherry: { tr: 'Vişne', en: 'Sour cherries' },
  fig: { tr: 'İncir', en: 'Figs' },
  pomegranate: { tr: 'Nar', en: 'Pomegranate' },
  kiwi: { tr: 'Kivi', en: 'Kiwi' },
  pineapple: { tr: 'Ananas', en: 'Pineapple' },
  mango: { tr: 'Mango', en: 'Mango' },
  plum: { tr: 'Erik', en: 'Plums' },
  quince: { tr: 'Ayva', en: 'Quince' },
  date: { tr: 'Hurma', en: 'Dates' },
  raisin: { tr: 'Kuru üzüm', en: 'Raisins' },
  blueberry: { tr: 'Yaban mersini', en: 'Blueberries' },
  raspberry: { tr: 'Ahududu', en: 'Raspberries' },
  mint: { tr: 'Nane', en: 'Mint' },
  dill: { tr: 'Dereotu', en: 'Dill' },
  basil: { tr: 'Fesleğen', en: 'Basil' },
  cumin: { tr: 'Kimyon', en: 'Cumin' },
  ginger: { tr: 'Zencefil', en: 'Ginger' },
  mustard: { tr: 'Hardal', en: 'Mustard' },
  mayonnaise: { tr: 'Mayonez', en: 'Mayonnaise' },
  ketchup: { tr: 'Ketçap', en: 'Ketchup' },
  vinegar: { tr: 'Sirke', en: 'Vinegar' },
  capers: { tr: 'Kapari', en: 'Capers' },
  pickles: { tr: 'Turşu', en: 'Pickles' },
  olive_oil: { tr: 'Zeytinyağı', en: 'Olive oil' },
  fried: { tr: 'Kızartma', en: 'Fried food' },
  fast_food: { tr: 'Fast food', en: 'Fast food' },
  coffee: { tr: 'Kahve', en: 'Coffee' },
  tea: { tr: 'Çay', en: 'Tea' },
  energy_drink: { tr: 'Enerji içeceği', en: 'Energy drinks' },
  soda: { tr: 'Gazlı içecek', en: 'Fizzy drinks' },
  sweetener: { tr: 'Tatlandırıcı', en: 'Sweeteners' },
  gelatin: { tr: 'Jelatin', en: 'Gelatin' },
};

export const FOOD_KEYS: readonly string[] = Object.keys(FOODS);

export function isCustom(k: string): boolean {
  return k.startsWith(CUSTOM_PREFIX);
}

/** Etiket: standart anahtar → dil; özel öğe → yazıldığı gibi; bilinmeyen anahtar → anahtar. */
export function dislikeLabel(k: string, lang: string): string {
  if (isCustom(k)) return k.slice(CUSTOM_PREFIX.length);
  const f = FOODS[k];
  return f ? (lang === 'en' ? f.en : f.tr) : k;
}

/** Arama karşılaştırması: TR küçük harf, aksan/şapka farkı yok sayılır (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u, â→a). */
export function norm(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u')
    .trim();
}

/** Saf: aramada öneri satırları (TR ve EN adlarında; önce baştan eşleşenler). En çok `limit`. */
export function searchFoods(query: string, limit = 8): string[] {
  const q0 = norm(query);
  if (!q0) return [];
  // Türkçe ünsüz yumuşaması (fıstık → fıstığı, kebap → kebabı): 4+ harfte son ünsüz düşürülmüş kök de aranır.
  const qs = q0.length >= 4 && /[kctpg]$/.test(q0) ? [q0, q0.slice(0, -1)] : [q0];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const k of FOOD_KEYS) {
    const a = norm(FOODS[k].tr);
    const b = norm(FOODS[k].en);
    const st = (q: string) => a.startsWith(q) || b.startsWith(q) || a.split(' ').some((w) => w.startsWith(q)) || b.split(' ').some((w) => w.startsWith(q));
    if (qs.some(st)) starts.push(k);
    else if (qs.some((q) => a.includes(q) || b.includes(q))) contains.push(k);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Saf: yazılan metin listede birebir var mı (TR/EN adı) → anahtar. */
export function exactFood(query: string): string | null {
  const q = norm(query);
  if (!q) return null;
  return FOOD_KEYS.find((k) => norm(FOODS[k].tr) === q || norm(FOODS[k].en) === q) ?? null;
}

/** Saf: "'[yazılan]' ekle" satırı gösterilsin mi (boş değil, listede birebir yok, zaten seçili değil, sınır dolmadı). */
export function canAddCustom(query: string, selected: readonly string[]): boolean {
  const t = query.trim();
  if (!t || exactFood(t)) return false;
  if (selected.length >= DISLIKE_MAX) return false;
  return !selected.some((s) => isCustom(s) && norm(s.slice(CUSTOM_PREFIX.length)) === norm(t));
}

export interface DislikeState {
  dislikes: string[];
  eatsAll: boolean;
}

/** Saf: çip aç/kapa. Seçince "Hepsini yerim" kalkar; sınır (30) doluysa yeni öğe eklenmez. */
export function toggleDislike(s: DislikeState, key: string): DislikeState {
  if (s.dislikes.includes(key)) return { dislikes: s.dislikes.filter((x) => x !== key), eatsAll: false };
  if (s.dislikes.length >= DISLIKE_MAX) return s;
  return { dislikes: [...s.dislikes, key], eatsAll: false };
}

/** Saf: serbest metin ekle (listede birebir varsa standart anahtar eklenir). */
export function addCustomDislike(s: DislikeState, text: string): DislikeState {
  const t = text.trim().slice(0, CUSTOM_MAX_LEN);
  if (!t) return s;
  const exact = exactFood(t);
  if (exact) return s.dislikes.includes(exact) ? s : toggleDislike(s, exact);
  if (!canAddCustom(t, s.dislikes)) return s;
  return { dislikes: [...s.dislikes, `${CUSTOM_PREFIX}${t}`], eatsAll: false };
}

/** Saf: "Hepsini yerim" — açılınca diğer seçimler temizlenir. */
export function toggleEatsAll(s: DislikeState): DislikeState {
  return s.eatsAll ? { dislikes: s.dislikes, eatsAll: false } : { dislikes: [], eatsAll: true };
}

/** Tarif malzeme anahtarında aranan parçalar (tarif tohum sözlüğü İngilizce anahtarlı). */
const PARTS: Record<string, string[]> = {
  red_meat: ['beef', 'lamb', 'veal', 'mince', 'kofte', 'steak'],
  processed_meat: ['sausage', 'salami', 'sucuk', 'pastrami', 'ham', 'bacon'],
  offal: ['liver', 'offal', 'kidney', 'tripe'],
  dairy: ['milk', 'yogurt', 'cheese', 'feta', 'labne', 'butter', 'cream', 'kefir'],
  milk: ['milk'],
  cheese: ['cheese', 'feta', 'labne'],
  legumes: ['lentil', 'chickpea', 'bean'],
  nuts: ['walnut', 'hazelnut', 'almond', 'pistachio', 'nut'],
  peanut: ['peanut'],
  spicy: ['chili', 'pepper_flake', 'isot', 'spicy'],
  fish: ['salmon', 'tuna', 'fish', 'sea_bass', 'cod', 'anchovy', 'sardine'],
  seafood: ['shrimp', 'squid', 'mussel', 'seafood', 'crab', 'octopus'],
  gluten: ['wheat', 'flour', 'bread', 'pasta', 'bulgur', 'couscous', 'gluten'],
  citrus: ['orange', 'lemon', 'lime', 'grapefruit', 'mandarin'],
  sweet: ['sugar', 'honey', 'chocolate', 'syrup'],
  caffeine: ['coffee', 'tea', 'caffeine'],
  sour: ['vinegar', 'lemon', 'sumac', 'pomegranate_molasses'],
  sesame: ['sesame', 'tahini'],
  soy: ['soy', 'tofu', 'edamame'],
};

/** Saf: seçilenler → tarifte dışlanacak malzeme parçaları (özel öğeler küçük harfle aynen). */
export function dislikeTerms(dislikes: readonly string[]): string[] {
  const out = new Set<string>();
  for (const d of dislikes) {
    if (isCustom(d)) {
      const t = norm(d.slice(CUSTOM_PREFIX.length));
      if (t) out.add(t);
      continue;
    }
    for (const p of PARTS[d] ?? [d]) out.add(p);
  }
  return [...out];
}
