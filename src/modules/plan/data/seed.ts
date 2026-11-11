// OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: scripts/plan-seed/source.json · üretici: node scripts/plan-seed/gen.mjs
// G33-S1 md.5 — TASLAK tarif tohumu (İlter/diyetisyen onayı bekliyor: docs/night/G33-TARIF-TASLAK.md).
// 100 g değerleri USDA FoodData Central SR Legacy (2018-04); her malzemede FDC ID. Makrolar burada YOK —
// uygulama `nutrition.ts` ile malzemelerden HESAPLAR.
import type { Ingredient, Recipe } from '../types';

export const SEED_INGREDIENTS: Ingredient[] = [
 {
  "key": "egg",
  "fdcId": 171287,
  "nameTr": "Yumurta",
  "nameEn": "Egg",
  "category": "dairy",
  "unit": "adet",
  "unitGrams": 50,
  "allergens": [
   "egg"
  ],
  "origin": "egg",
  "per100": {
   "kcal": 143,
   "protein": 12.56,
   "carbs": 0.72,
   "fat": 9.51
  }
 },
 {
  "key": "egg_white",
  "fdcId": 172183,
  "nameTr": "Yumurta akı",
  "nameEn": "Egg white",
  "category": "dairy",
  "unit": "adet",
  "unitGrams": 33,
  "allergens": [
   "egg"
  ],
  "origin": "egg",
  "per100": {
   "kcal": 52,
   "protein": 10.9,
   "carbs": 0.73,
   "fat": 0.17
  }
 },
 {
  "key": "tomato",
  "fdcId": 170457,
  "nameTr": "Domates",
  "nameEn": "Tomato",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 120,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 18,
   "protein": 0.88,
   "carbs": 3.89,
   "fat": 0.2
  }
 },
 {
  "key": "green_pepper",
  "fdcId": 170427,
  "nameTr": "Yeşil biber",
  "nameEn": "Green pepper",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 40,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 20,
   "protein": 0.86,
   "carbs": 4.64,
   "fat": 0.17
  }
 },
 {
  "key": "red_pepper",
  "fdcId": 170108,
  "nameTr": "Kırmızı biber",
  "nameEn": "Red bell pepper",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 120,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 26,
   "protein": 0.99,
   "carbs": 6.03,
   "fat": 0.3
  }
 },
 {
  "key": "onion",
  "fdcId": 170000,
  "nameTr": "Soğan",
  "nameEn": "Onion",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 110,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 40,
   "protein": 1.1,
   "carbs": 9.34,
   "fat": 0.1
  }
 },
 {
  "key": "garlic",
  "fdcId": 169230,
  "nameTr": "Sarımsak",
  "nameEn": "Garlic",
  "category": "produce",
  "unit": "dis",
  "unitGrams": 4,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 149,
   "protein": 6.36,
   "carbs": 33.06,
   "fat": 0.5
  }
 },
 {
  "key": "olive_oil",
  "fdcId": 171413,
  "nameTr": "Zeytinyağı",
  "nameEn": "Olive oil",
  "category": "spices",
  "unit": "yk",
  "unitGrams": 10,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 884,
   "protein": 0,
   "carbs": 0,
   "fat": 100
  }
 },
 {
  "key": "feta",
  "fdcId": 173420,
  "nameTr": "Beyaz peynir",
  "nameEn": "White cheese (feta)",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 265,
   "protein": 14.21,
   "carbs": 3.88,
   "fat": 21.49
  }
 },
 {
  "key": "mozzarella",
  "fdcId": 170847,
  "nameTr": "Az yağlı kaşar (mozzarella)",
  "nameEn": "Low-fat mozzarella",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 254,
   "protein": 24.26,
   "carbs": 2.77,
   "fat": 15.92
  }
 },
 {
  "key": "cottage",
  "fdcId": 173417,
  "nameTr": "Lor peyniri (az yağlı)",
  "nameEn": "Cottage cheese (low-fat)",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 72,
   "protein": 12.39,
   "carbs": 2.72,
   "fat": 1.02
  }
 },
 {
  "key": "ricotta",
  "fdcId": 171248,
  "nameTr": "Lor (ricotta)",
  "nameEn": "Ricotta",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 138,
   "protein": 11.39,
   "carbs": 5.14,
   "fat": 7.91
  }
 },
 {
  "key": "yogurt",
  "fdcId": 171284,
  "nameTr": "Yoğurt",
  "nameEn": "Yogurt",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 61,
   "protein": 3.47,
   "carbs": 4.66,
   "fat": 3.25
  }
 },
 {
  "key": "greek_yogurt",
  "fdcId": 170894,
  "nameTr": "Süzme yoğurt (yağsız)",
  "nameEn": "Greek yogurt (nonfat)",
  "category": "dairy",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 59,
   "protein": 10.19,
   "carbs": 3.6,
   "fat": 0.39
  }
 },
 {
  "key": "milk",
  "fdcId": 170872,
  "nameTr": "Süt (%1 yağlı)",
  "nameEn": "Milk (1%)",
  "category": "dairy",
  "unit": "ml",
  "unitGrams": 1,
  "allergens": [
   "milk"
  ],
  "origin": "dairy",
  "per100": {
   "kcal": 42,
   "protein": 3.37,
   "carbs": 4.99,
   "fat": 0.97
  }
 },
 {
  "key": "oats",
  "fdcId": 173904,
  "nameTr": "Yulaf",
  "nameEn": "Oats",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 379,
   "protein": 13.15,
   "carbs": 67.7,
   "fat": 6.52
  }
 },
 {
  "key": "banana",
  "fdcId": 173944,
  "nameTr": "Muz",
  "nameEn": "Banana",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 120,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 89,
   "protein": 1.09,
   "carbs": 22.84,
   "fat": 0.33
  }
 },
 {
  "key": "apple",
  "fdcId": 171688,
  "nameTr": "Elma",
  "nameEn": "Apple",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 180,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 52,
   "protein": 0.26,
   "carbs": 13.81,
   "fat": 0.17
  }
 },
 {
  "key": "strawberry",
  "fdcId": 167762,
  "nameTr": "Çilek",
  "nameEn": "Strawberries",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 32,
   "protein": 0.67,
   "carbs": 7.68,
   "fat": 0.3
  }
 },
 {
  "key": "blueberry",
  "fdcId": 171711,
  "nameTr": "Yaban mersini",
  "nameEn": "Blueberries",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 57,
   "protein": 0.74,
   "carbs": 14.49,
   "fat": 0.33
  }
 },
 {
  "key": "walnut",
  "fdcId": 170187,
  "nameTr": "Ceviz",
  "nameEn": "Walnuts",
  "category": "other",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "treenut"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 654,
   "protein": 15.23,
   "carbs": 13.71,
   "fat": 65.21
  }
 },
 {
  "key": "almond",
  "fdcId": 170567,
  "nameTr": "Badem",
  "nameEn": "Almonds",
  "category": "other",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "treenut"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 579,
   "protein": 21.15,
   "carbs": 21.55,
   "fat": 49.93
  }
 },
 {
  "key": "hazelnut",
  "fdcId": 170581,
  "nameTr": "Fındık",
  "nameEn": "Hazelnuts",
  "category": "other",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "treenut"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 628,
   "protein": 14.95,
   "carbs": 16.7,
   "fat": 60.75
  }
 },
 {
  "key": "peanut_butter",
  "fdcId": 172470,
  "nameTr": "Fıstık ezmesi (tuzsuz)",
  "nameEn": "Peanut butter (unsalted)",
  "category": "other",
  "unit": "yk",
  "unitGrams": 16,
  "allergens": [
   "peanut"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 598,
   "protein": 22.21,
   "carbs": 22.31,
   "fat": 51.36
  }
 },
 {
  "key": "honey",
  "fdcId": 169640,
  "nameTr": "Bal",
  "nameEn": "Honey",
  "category": "other",
  "unit": "tk",
  "unitGrams": 7,
  "allergens": [],
  "origin": "honey",
  "per100": {
   "kcal": 304,
   "protein": 0.3,
   "carbs": 82.4,
   "fat": 0
  }
 },
 {
  "key": "chickpea",
  "fdcId": 173757,
  "nameTr": "Nohut (haşlanmış)",
  "nameEn": "Chickpeas (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 164,
   "protein": 8.86,
   "carbs": 27.42,
   "fat": 2.59
  }
 },
 {
  "key": "red_lentil",
  "fdcId": 174284,
  "nameTr": "Kırmızı mercimek",
  "nameEn": "Red lentils",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 358,
   "protein": 23.91,
   "carbs": 63.1,
   "fat": 2.17
  }
 },
 {
  "key": "bulgur_cooked",
  "fdcId": 170287,
  "nameTr": "Bulgur (pişmiş)",
  "nameEn": "Bulgur (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 83,
   "protein": 3.08,
   "carbs": 18.58,
   "fat": 0.24
  }
 },
 {
  "key": "bulgur_dry",
  "fdcId": 170688,
  "nameTr": "Bulgur",
  "nameEn": "Bulgur",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 342,
   "protein": 12.29,
   "carbs": 75.87,
   "fat": 1.33
  }
 },
 {
  "key": "brown_rice",
  "fdcId": 169704,
  "nameTr": "Esmer pirinç (pişmiş)",
  "nameEn": "Brown rice (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 123,
   "protein": 2.74,
   "carbs": 25.58,
   "fat": 0.97
  }
 },
 {
  "key": "quinoa",
  "fdcId": 168917,
  "nameTr": "Kinoa (pişmiş)",
  "nameEn": "Quinoa (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 120,
   "protein": 4.4,
   "carbs": 21.3,
   "fat": 1.92
  }
 },
 {
  "key": "ww_bread",
  "fdcId": 172688,
  "nameTr": "Tam buğday ekmeği",
  "nameEn": "Whole-wheat bread",
  "category": "grains",
  "unit": "dilim",
  "unitGrams": 30,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 252,
   "protein": 12.45,
   "carbs": 42.71,
   "fat": 3.5
  }
 },
 {
  "key": "ww_pasta",
  "fdcId": 168910,
  "nameTr": "Tam buğday makarna (pişmiş)",
  "nameEn": "Whole-wheat pasta (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 149,
   "protein": 5.99,
   "carbs": 30.07,
   "fat": 1.71
  }
 },
 {
  "key": "ww_tortilla",
  "fdcId": 174081,
  "nameTr": "Tam buğday lavaş",
  "nameEn": "Whole-wheat tortilla",
  "category": "grains",
  "unit": "adet",
  "unitGrams": 45,
  "allergens": [
   "gluten"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 310,
   "protein": 9.76,
   "carbs": 45.89,
   "fat": 9.76
  }
 },
 {
  "key": "chicken",
  "fdcId": 171477,
  "nameTr": "Tavuk göğsü (pişmiş)",
  "nameEn": "Chicken breast (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "meat",
  "per100": {
   "kcal": 165,
   "protein": 31.02,
   "carbs": 0,
   "fat": 3.57
  }
 },
 {
  "key": "turkey",
  "fdcId": 171496,
  "nameTr": "Hindi göğsü (pişmiş)",
  "nameEn": "Turkey breast (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "meat",
  "per100": {
   "kcal": 147,
   "protein": 30.13,
   "carbs": 0,
   "fat": 2.08
  }
 },
 {
  "key": "beef",
  "fdcId": 171794,
  "nameTr": "Yağsız kıyma (pişmiş)",
  "nameEn": "Lean ground beef (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "meat",
  "per100": {
   "kcal": 230,
   "protein": 28.45,
   "carbs": 0,
   "fat": 12.04
  }
 },
 {
  "key": "salmon",
  "fdcId": 175168,
  "nameTr": "Somon fileto (pişmiş)",
  "nameEn": "Salmon fillet (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "seafood"
  ],
  "origin": "fish",
  "per100": {
   "kcal": 206,
   "protein": 22.1,
   "carbs": 0,
   "fat": 12.35
  }
 },
 {
  "key": "tuna",
  "fdcId": 173709,
  "nameTr": "Ton balığı (suda)",
  "nameEn": "Tuna (in water)",
  "category": "protein",
  "unit": "kutu",
  "unitGrams": 120,
  "allergens": [
   "seafood"
  ],
  "origin": "fish",
  "per100": {
   "kcal": 86,
   "protein": 19.44,
   "carbs": 0,
   "fat": 0.96
  }
 },
 {
  "key": "sea_bass",
  "fdcId": 173694,
  "nameTr": "Levrek (pişmiş)",
  "nameEn": "Sea bass (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "seafood"
  ],
  "origin": "fish",
  "per100": {
   "kcal": 124,
   "protein": 23.63,
   "carbs": 0,
   "fat": 2.56
  }
 },
 {
  "key": "shrimp",
  "fdcId": 175180,
  "nameTr": "Karides (pişmiş)",
  "nameEn": "Shrimp (cooked)",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "seafood"
  ],
  "origin": "fish",
  "per100": {
   "kcal": 99,
   "protein": 23.98,
   "carbs": 0.2,
   "fat": 0.28
  }
 },
 {
  "key": "cucumber",
  "fdcId": 168409,
  "nameTr": "Salatalık",
  "nameEn": "Cucumber",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 150,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 15,
   "protein": 0.65,
   "carbs": 3.63,
   "fat": 0.11
  }
 },
 {
  "key": "romaine",
  "fdcId": 169247,
  "nameTr": "Marul",
  "nameEn": "Romaine lettuce",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 300,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 17,
   "protein": 1.23,
   "carbs": 3.29,
   "fat": 0.3
  }
 },
 {
  "key": "spinach",
  "fdcId": 168462,
  "nameTr": "Ispanak",
  "nameEn": "Spinach",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 23,
   "protein": 2.86,
   "carbs": 3.63,
   "fat": 0.39
  }
 },
 {
  "key": "zucchini",
  "fdcId": 169291,
  "nameTr": "Kabak",
  "nameEn": "Zucchini",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 200,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 17,
   "protein": 1.21,
   "carbs": 3.11,
   "fat": 0.32
  }
 },
 {
  "key": "eggplant",
  "fdcId": 169228,
  "nameTr": "Patlıcan",
  "nameEn": "Eggplant",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 250,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 25,
   "protein": 0.98,
   "carbs": 5.88,
   "fat": 0.18
  }
 },
 {
  "key": "carrot",
  "fdcId": 170393,
  "nameTr": "Havuç",
  "nameEn": "Carrot",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 70,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 41,
   "protein": 0.93,
   "carbs": 9.58,
   "fat": 0.24
  }
 },
 {
  "key": "potato",
  "fdcId": 170440,
  "nameTr": "Patates (haşlanmış)",
  "nameEn": "Potato (boiled)",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 150,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 86,
   "protein": 1.71,
   "carbs": 20.01,
   "fat": 0.1
  }
 },
 {
  "key": "sweet_potato",
  "fdcId": 168483,
  "nameTr": "Tatlı patates (fırın)",
  "nameEn": "Sweet potato (baked)",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 150,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 90,
   "protein": 2.01,
   "carbs": 20.71,
   "fat": 0.15
  }
 },
 {
  "key": "broccoli",
  "fdcId": 170379,
  "nameTr": "Brokoli",
  "nameEn": "Broccoli",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 34,
   "protein": 2.82,
   "carbs": 6.64,
   "fat": 0.37
  }
 },
 {
  "key": "mushroom",
  "fdcId": 169251,
  "nameTr": "Mantar",
  "nameEn": "Mushrooms",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 22,
   "protein": 3.09,
   "carbs": 3.26,
   "fat": 0.34
  }
 },
 {
  "key": "avocado",
  "fdcId": 171705,
  "nameTr": "Avokado",
  "nameEn": "Avocado",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 150,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 160,
   "protein": 2,
   "carbs": 8.53,
   "fat": 14.66
  }
 },
 {
  "key": "lemon_juice",
  "fdcId": 167747,
  "nameTr": "Limon suyu",
  "nameEn": "Lemon juice",
  "category": "produce",
  "unit": "adet",
  "unitGrams": 40,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 22,
   "protein": 0.35,
   "carbs": 6.9,
   "fat": 0.24
  }
 },
 {
  "key": "parsley",
  "fdcId": 170416,
  "nameTr": "Maydanoz",
  "nameEn": "Parsley",
  "category": "produce",
  "unit": "demet",
  "unitGrams": 50,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 36,
   "protein": 2.97,
   "carbs": 6.33,
   "fat": 0.79
  }
 },
 {
  "key": "dill",
  "fdcId": 172233,
  "nameTr": "Dereotu",
  "nameEn": "Dill",
  "category": "produce",
  "unit": "demet",
  "unitGrams": 40,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 43,
   "protein": 3.46,
   "carbs": 7.02,
   "fat": 1.12
  }
 },
 {
  "key": "mint",
  "fdcId": 173475,
  "nameTr": "Nane",
  "nameEn": "Mint",
  "category": "produce",
  "unit": "demet",
  "unitGrams": 30,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 44,
   "protein": 3.29,
   "carbs": 8.41,
   "fat": 0.73
  }
 },
 {
  "key": "arugula",
  "fdcId": 169387,
  "nameTr": "Roka",
  "nameEn": "Arugula",
  "category": "produce",
  "unit": "demet",
  "unitGrams": 80,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 25,
   "protein": 2.58,
   "carbs": 3.65,
   "fat": 0.66
  }
 },
 {
  "key": "olives",
  "fdcId": 169094,
  "nameTr": "Siyah zeytin",
  "nameEn": "Black olives",
  "category": "other",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 116,
   "protein": 0.84,
   "carbs": 6.04,
   "fat": 10.9
  }
 },
 {
  "key": "tahini",
  "fdcId": 170189,
  "nameTr": "Tahin",
  "nameEn": "Tahini",
  "category": "spices",
  "unit": "yk",
  "unitGrams": 15,
  "allergens": [
   "sesame"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 595,
   "protein": 17,
   "carbs": 21.19,
   "fat": 53.76
  }
 },
 {
  "key": "tomato_paste",
  "fdcId": 170459,
  "nameTr": "Domates salçası",
  "nameEn": "Tomato paste",
  "category": "spices",
  "unit": "yk",
  "unitGrams": 15,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 82,
   "protein": 4.32,
   "carbs": 18.91,
   "fat": 0.47
  }
 },
 {
  "key": "sesame",
  "fdcId": 170150,
  "nameTr": "Susam",
  "nameEn": "Sesame seeds",
  "category": "spices",
  "unit": "tk",
  "unitGrams": 3,
  "allergens": [
   "sesame"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 573,
   "protein": 17.73,
   "carbs": 23.45,
   "fat": 49.67
  }
 },
 {
  "key": "tofu",
  "fdcId": 172475,
  "nameTr": "Tofu",
  "nameEn": "Tofu",
  "category": "protein",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [
   "soy"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 144,
   "protein": 17.27,
   "carbs": 2.78,
   "fat": 8.72
  }
 },
 {
  "key": "chia",
  "fdcId": 170554,
  "nameTr": "Chia tohumu",
  "nameEn": "Chia seeds",
  "category": "other",
  "unit": "tk",
  "unitGrams": 5,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 486,
   "protein": 16.54,
   "carbs": 42.12,
   "fat": 30.74
  }
 },
 {
  "key": "kidney_bean",
  "fdcId": 175194,
  "nameTr": "Barbunya (haşlanmış)",
  "nameEn": "Kidney beans (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 127,
   "protein": 8.67,
   "carbs": 22.8,
   "fat": 0.5
  }
 },
 {
  "key": "white_bean",
  "fdcId": 175203,
  "nameTr": "Kuru fasulye (haşlanmış)",
  "nameEn": "White beans (cooked)",
  "category": "grains",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 139,
   "protein": 9.73,
   "carbs": 25.09,
   "fat": 0.35
  }
 },
 {
  "key": "green_bean",
  "fdcId": 169961,
  "nameTr": "Taze fasulye",
  "nameEn": "Green beans",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 31,
   "protein": 1.83,
   "carbs": 6.97,
   "fat": 0.22
  }
 },
 {
  "key": "corn",
  "fdcId": 169998,
  "nameTr": "Mısır",
  "nameEn": "Sweet corn",
  "category": "produce",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 86,
   "protein": 3.27,
   "carbs": 18.7,
   "fat": 1.35
  }
 },
 {
  "key": "cinnamon",
  "fdcId": 171320,
  "nameTr": "Tarçın",
  "nameEn": "Cinnamon",
  "category": "spices",
  "unit": "ck",
  "unitGrams": 2,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 247,
   "protein": 3.99,
   "carbs": 80.59,
   "fat": 1.24
  }
 },
 {
  "key": "cumin",
  "fdcId": 170923,
  "nameTr": "Kimyon",
  "nameEn": "Cumin",
  "category": "spices",
  "unit": "ck",
  "unitGrams": 2,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 375,
   "protein": 17.81,
   "carbs": 44.24,
   "fat": 22.27
  }
 },
 {
  "key": "paprika",
  "fdcId": 171329,
  "nameTr": "Toz kırmızı biber",
  "nameEn": "Paprika",
  "category": "spices",
  "unit": "ck",
  "unitGrams": 2,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 282,
   "protein": 14.14,
   "carbs": 53.99,
   "fat": 12.89
  }
 },
 {
  "key": "soy_sauce",
  "fdcId": 174278,
  "nameTr": "Soya sosu",
  "nameEn": "Soy sauce",
  "category": "spices",
  "unit": "yk",
  "unitGrams": 15,
  "allergens": [
   "soy"
  ],
  "origin": "plant",
  "per100": {
   "kcal": 60,
   "protein": 10.51,
   "carbs": 5.57,
   "fat": 0.1
  }
 },
 {
  "key": "dates",
  "fdcId": 168191,
  "nameTr": "Hurma",
  "nameEn": "Dates",
  "category": "other",
  "unit": "adet",
  "unitGrams": 24,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 277,
   "protein": 1.81,
   "carbs": 74.97,
   "fat": 0.15
  }
 },
 {
  "key": "dried_apricot",
  "fdcId": 173941,
  "nameTr": "Kuru kayısı",
  "nameEn": "Dried apricots",
  "category": "other",
  "unit": "g",
  "unitGrams": 1,
  "allergens": [],
  "origin": "plant",
  "per100": {
   "kcal": 241,
   "protein": 3.39,
   "carbs": 62.64,
   "fat": 0.51
  }
 }
];

export const SEED_RECIPES: Recipe[] = [
 {
  "key": "menemen",
  "nameTr": "Menemen",
  "nameEn": "Menemen",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "egg",
    "grams": 100
   },
   {
    "key": "tomato",
    "grams": 150
   },
   {
    "key": "green_pepper",
    "grams": 50
   },
   {
    "key": "olive_oil",
    "grams": 5
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "yulaf_kasesi",
  "nameTr": "Yulaflı kahvaltı kasesi",
  "nameEn": "Oat breakfast bowl",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "oats",
    "grams": 50
   },
   {
    "key": "milk",
    "grams": 200
   },
   {
    "key": "banana",
    "grams": 60
   },
   {
    "key": "walnut",
    "grams": 10
   },
   {
    "key": "cinnamon",
    "grams": 1
   }
  ]
 },
 {
  "key": "peynirli_omlet",
  "nameTr": "Beyaz peynirli ıspanaklı omlet",
  "nameEn": "Spinach and white cheese omelette",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "egg",
    "grams": 100
   },
   {
    "key": "egg_white",
    "grams": 66
   },
   {
    "key": "feta",
    "grams": 30
   },
   {
    "key": "spinach",
    "grams": 30
   },
   {
    "key": "olive_oil",
    "grams": 5
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "lorlu_tost",
  "nameTr": "Lorlu tam buğday tost",
  "nameEn": "Ricotta whole-wheat toast",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "ww_bread",
    "grams": 60
   },
   {
    "key": "ricotta",
    "grams": 60
   },
   {
    "key": "tomato",
    "grams": 50
   },
   {
    "key": "cucumber",
    "grams": 50
   },
   {
    "key": "olives",
    "grams": 15
   }
  ]
 },
 {
  "key": "avokadolu_yumurta",
  "nameTr": "Avokadolu yumurtalı tost",
  "nameEn": "Avocado and egg toast",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "ww_bread",
    "grams": 40
   },
   {
    "key": "avocado",
    "grams": 50
   },
   {
    "key": "egg",
    "grams": 50
   },
   {
    "key": "tomato",
    "grams": 40
   }
  ]
 },
 {
  "key": "kahvalti_tabagi",
  "nameTr": "Fit kahvaltı tabağı",
  "nameEn": "Fit breakfast plate",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "egg",
    "grams": 100
   },
   {
    "key": "feta",
    "grams": 30
   },
   {
    "key": "cucumber",
    "grams": 80
   },
   {
    "key": "tomato",
    "grams": 80
   },
   {
    "key": "olives",
    "grams": 15
   },
   {
    "key": "ww_bread",
    "grams": 30
   },
   {
    "key": "walnut",
    "grams": 10
   }
  ]
 },
 {
  "key": "ispanakli_yumurta",
  "nameTr": "Yoğurtlu ıspanaklı yumurta",
  "nameEn": "Spinach eggs with yogurt",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "spinach",
    "grams": 150
   },
   {
    "key": "egg",
    "grams": 100
   },
   {
    "key": "yogurt",
    "grams": 60
   },
   {
    "key": "garlic",
    "grams": 3
   },
   {
    "key": "olive_oil",
    "grams": 5
   },
   {
    "key": "paprika",
    "grams": 1
   }
  ]
 },
 {
  "key": "chia_puding",
  "nameTr": "Yaban mersinli chia puding",
  "nameEn": "Blueberry chia pudding",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "milk",
    "grams": 200
   },
   {
    "key": "chia",
    "grams": 20
   },
   {
    "key": "blueberry",
    "grams": 60
   },
   {
    "key": "honey",
    "grams": 7
   },
   {
    "key": "almond",
    "grams": 10
   }
  ]
 },
 {
  "key": "tofu_kavurma",
  "nameTr": "Sebzeli tofu kavurma",
  "nameEn": "Vegetable tofu scramble",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "tofu",
    "grams": 150
   },
   {
    "key": "tomato",
    "grams": 60
   },
   {
    "key": "green_pepper",
    "grams": 40
   },
   {
    "key": "onion",
    "grams": 30
   },
   {
    "key": "olive_oil",
    "grams": 5
   },
   {
    "key": "cumin",
    "grams": 1
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "fistik_ezmeli_tost",
  "nameTr": "Fıstık ezmeli muzlu tost",
  "nameEn": "Peanut butter banana toast",
  "slot": "breakfast",
  "ingredients": [
   {
    "key": "ww_bread",
    "grams": 60
   },
   {
    "key": "peanut_butter",
    "grams": 16
   },
   {
    "key": "banana",
    "grams": 60
   }
  ]
 },
 {
  "key": "tavuklu_kinoa",
  "nameTr": "Tavuklu kinoa kasesi",
  "nameEn": "Chicken quinoa bowl",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "chicken",
    "grams": 120
   },
   {
    "key": "quinoa",
    "grams": 120
   },
   {
    "key": "cucumber",
    "grams": 50
   },
   {
    "key": "tomato",
    "grams": 50
   },
   {
    "key": "parsley",
    "grams": 10
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "somon_kinoa",
  "nameTr": "Somon kinoa kase",
  "nameEn": "Salmon quinoa bowl",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "salmon",
    "grams": 120
   },
   {
    "key": "quinoa",
    "grams": 100
   },
   {
    "key": "avocado",
    "grams": 40
   },
   {
    "key": "cucumber",
    "grams": 50
   },
   {
    "key": "arugula",
    "grams": 20
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "mercimek_corbasi",
  "nameTr": "Kırmızı mercimek çorbası",
  "nameEn": "Red lentil soup",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "red_lentil",
    "grams": 60
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "carrot",
    "grams": 40
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "tomato_paste",
    "grams": 10
   },
   {
    "key": "cumin",
    "grams": 1
   },
   {
    "key": "lemon_juice",
    "grams": 10
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "nohutlu_kisir",
  "nameTr": "Nohutlu kısır",
  "nameEn": "Bulgur salad with chickpeas",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "bulgur_cooked",
    "grams": 150
   },
   {
    "key": "chickpea",
    "grams": 60
   },
   {
    "key": "tomato",
    "grams": 50
   },
   {
    "key": "cucumber",
    "grams": 50
   },
   {
    "key": "parsley",
    "grams": 15
   },
   {
    "key": "mint",
    "grams": 3
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "lemon_juice",
    "grams": 15
   },
   {
    "key": "tomato_paste",
    "grams": 10
   }
  ]
 },
 {
  "key": "ton_salata",
  "nameTr": "Ton balıklı salata",
  "nameEn": "Tuna salad",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "tuna",
    "grams": 120
   },
   {
    "key": "romaine",
    "grams": 80
   },
   {
    "key": "tomato",
    "grams": 60
   },
   {
    "key": "cucumber",
    "grams": 60
   },
   {
    "key": "corn",
    "grams": 40
   },
   {
    "key": "kidney_bean",
    "grams": 60
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "hindili_durum",
  "nameTr": "Hindili tam buğday dürüm",
  "nameEn": "Turkey whole-wheat wrap",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "ww_tortilla",
    "grams": 60
   },
   {
    "key": "turkey",
    "grams": 80
   },
   {
    "key": "romaine",
    "grams": 30
   },
   {
    "key": "tomato",
    "grams": 40
   },
   {
    "key": "greek_yogurt",
    "grams": 30
   },
   {
    "key": "cucumber",
    "grams": 30
   }
  ]
 },
 {
  "key": "kuru_fasulye",
  "nameTr": "Zeytinyağlı kuru fasulye, bulgur pilavı",
  "nameEn": "White bean stew with bulgur",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "white_bean",
    "grams": 200
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "tomato_paste",
    "grams": 15
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "green_pepper",
    "grams": 30
   },
   {
    "key": "bulgur_cooked",
    "grams": 100
   }
  ]
 },
 {
  "key": "tavuk_salata",
  "nameTr": "Izgara tavuk salatası",
  "nameEn": "Grilled chicken salad",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "chicken",
    "grams": 130
   },
   {
    "key": "romaine",
    "grams": 100
   },
   {
    "key": "tomato",
    "grams": 80
   },
   {
    "key": "cucumber",
    "grams": 60
   },
   {
    "key": "feta",
    "grams": 20
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "lemon_juice",
    "grams": 10
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "nohutlu_ispanak",
  "nameTr": "Yoğurtlu nohutlu ıspanak",
  "nameEn": "Spinach with chickpeas and yogurt",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "spinach",
    "grams": 200
   },
   {
    "key": "chickpea",
    "grams": 120
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "tomato_paste",
    "grams": 10
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "yogurt",
    "grams": 80
   }
  ]
 },
 {
  "key": "mercimek_koftesi",
  "nameTr": "Mercimek köftesi",
  "nameEn": "Lentil patties",
  "slot": "lunch",
  "ingredients": [
   {
    "key": "red_lentil",
    "grams": 50
   },
   {
    "key": "bulgur_dry",
    "grams": 30
   },
   {
    "key": "onion",
    "grams": 30
   },
   {
    "key": "tomato_paste",
    "grams": 15
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "parsley",
    "grams": 15
   },
   {
    "key": "romaine",
    "grams": 50
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "izgara_somon",
  "nameTr": "Izgara somon, tatlı patates",
  "nameEn": "Grilled salmon with sweet potato",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "salmon",
    "grams": 150
   },
   {
    "key": "broccoli",
    "grams": 120
   },
   {
    "key": "sweet_potato",
    "grams": 120
   },
   {
    "key": "olive_oil",
    "grams": 5
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "tavuk_sote",
  "nameTr": "Tavuk sote, bulgur pilavı",
  "nameEn": "Chicken sauté with bulgur",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "chicken",
    "grams": 150
   },
   {
    "key": "green_pepper",
    "grams": 50
   },
   {
    "key": "tomato",
    "grams": 80
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "mushroom",
    "grams": 60
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "bulgur_cooked",
    "grams": 120
   }
  ]
 },
 {
  "key": "firin_levrek",
  "nameTr": "Fırın levrek, roka salatası",
  "nameEn": "Baked sea bass with arugula",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "sea_bass",
    "grams": 180
   },
   {
    "key": "arugula",
    "grams": 40
   },
   {
    "key": "tomato",
    "grams": 80
   },
   {
    "key": "onion",
    "grams": 20
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "lemon_juice",
    "grams": 15
   },
   {
    "key": "potato",
    "grams": 120
   }
  ]
 },
 {
  "key": "kofte_piyaz",
  "nameTr": "Izgara köfte, piyaz",
  "nameEn": "Grilled meatballs with bean salad",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "beef",
    "grams": 130
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "parsley",
    "grams": 15
   },
   {
    "key": "white_bean",
    "grams": 100
   },
   {
    "key": "tomato",
    "grams": 50
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "lemon_juice",
    "grams": 10
   }
  ]
 },
 {
  "key": "kiymali_patlican",
  "nameTr": "Fırında kıymalı patlıcan",
  "nameEn": "Baked eggplant with mince",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "eggplant",
    "grams": 250
   },
   {
    "key": "beef",
    "grams": 90
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "tomato",
    "grams": 100
   },
   {
    "key": "green_pepper",
    "grams": 30
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "greek_yogurt",
    "grams": 60
   }
  ]
 },
 {
  "key": "taze_fasulye",
  "nameTr": "Zeytinyağlı taze fasulye, yoğurt",
  "nameEn": "Green beans in olive oil with yogurt",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "green_bean",
    "grams": 250
   },
   {
    "key": "onion",
    "grams": 50
   },
   {
    "key": "tomato",
    "grams": 100
   },
   {
    "key": "olive_oil",
    "grams": 15
   },
   {
    "key": "yogurt",
    "grams": 100
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "karides_guvec",
  "nameTr": "Karides güveç",
  "nameEn": "Shrimp casserole",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "shrimp",
    "grams": 150
   },
   {
    "key": "tomato",
    "grams": 120
   },
   {
    "key": "green_pepper",
    "grams": 50
   },
   {
    "key": "onion",
    "grams": 40
   },
   {
    "key": "garlic",
    "grams": 5
   },
   {
    "key": "mushroom",
    "grams": 50
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "mozzarella",
    "grams": 20
   },
   {
    "key": "ww_bread",
    "grams": 30
   }
  ]
 },
 {
  "key": "tavuklu_makarna",
  "nameTr": "Tavuklu brokolili tam buğday makarna",
  "nameEn": "Chicken broccoli whole-wheat pasta",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "ww_pasta",
    "grams": 160
   },
   {
    "key": "chicken",
    "grams": 100
   },
   {
    "key": "broccoli",
    "grams": 80
   },
   {
    "key": "garlic",
    "grams": 3
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "greek_yogurt",
    "grams": 40
   }
  ]
 },
 {
  "key": "hindi_firin",
  "nameTr": "Sebzeli fırın hindi",
  "nameEn": "Oven turkey with vegetables",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "turkey",
    "grams": 140
   },
   {
    "key": "zucchini",
    "grams": 120
   },
   {
    "key": "carrot",
    "grams": 80
   },
   {
    "key": "potato",
    "grams": 120
   },
   {
    "key": "olive_oil",
    "grams": 10
   },
   {
    "key": "paprika",
    "grams": 1
   }
  ]
 },
 {
  "key": "tofu_sote",
  "nameTr": "Tofulu sebze sote, esmer pirinç",
  "nameEn": "Tofu vegetable stir-fry with brown rice",
  "slot": "dinner",
  "ingredients": [
   {
    "key": "tofu",
    "grams": 180
   },
   {
    "key": "broccoli",
    "grams": 80
   },
   {
    "key": "red_pepper",
    "grams": 60
   },
   {
    "key": "carrot",
    "grams": 50
   },
   {
    "key": "soy_sauce",
    "grams": 15
   },
   {
    "key": "sesame",
    "grams": 5
   },
   {
    "key": "olive_oil",
    "grams": 7
   },
   {
    "key": "brown_rice",
    "grams": 120
   }
  ]
 },
 {
  "key": "elma_badem",
  "nameTr": "Elma ve badem",
  "nameEn": "Apple and almonds",
  "slot": "snack",
  "ingredients": [
   {
    "key": "apple",
    "grams": 150
   },
   {
    "key": "almond",
    "grams": 15
   }
  ]
 },
 {
  "key": "suzme_yogurt_kasesi",
  "nameTr": "Süzme yoğurt kasesi",
  "nameEn": "Greek yogurt bowl",
  "slot": "snack",
  "ingredients": [
   {
    "key": "greek_yogurt",
    "grams": 150
   },
   {
    "key": "strawberry",
    "grams": 60
   },
   {
    "key": "honey",
    "grams": 7
   },
   {
    "key": "chia",
    "grams": 5
   }
  ]
 },
 {
  "key": "humus_havuc",
  "nameTr": "Humus ve havuç",
  "nameEn": "Hummus with carrots",
  "slot": "snack",
  "ingredients": [
   {
    "key": "chickpea",
    "grams": 60
   },
   {
    "key": "tahini",
    "grams": 10
   },
   {
    "key": "lemon_juice",
    "grams": 5
   },
   {
    "key": "olive_oil",
    "grams": 3
   },
   {
    "key": "carrot",
    "grams": 100
   }
  ]
 },
 {
  "key": "lorlu_salatalik",
  "nameTr": "Dereotlu lor, salatalık",
  "nameEn": "Cottage cheese with cucumber and dill",
  "slot": "snack",
  "ingredients": [
   {
    "key": "cottage",
    "grams": 150
   },
   {
    "key": "cucumber",
    "grams": 100
   },
   {
    "key": "dill",
    "grams": 3
   }
  ]
 },
 {
  "key": "muz_fistik",
  "nameTr": "Muz ve fıstık ezmesi",
  "nameEn": "Banana with peanut butter",
  "slot": "snack",
  "ingredients": [
   {
    "key": "banana",
    "grams": 100
   },
   {
    "key": "peanut_butter",
    "grams": 16
   }
  ]
 },
 {
  "key": "haslanmis_yumurta",
  "nameTr": "Haşlanmış yumurta, domates",
  "nameEn": "Boiled eggs with tomato",
  "slot": "snack",
  "ingredients": [
   {
    "key": "egg",
    "grams": 100
   },
   {
    "key": "tomato",
    "grams": 100
   },
   {
    "key": "cucumber",
    "grams": 50
   }
  ]
 },
 {
  "key": "kuru_meyve",
  "nameTr": "Kuru kayısı, ceviz, fındık",
  "nameEn": "Dried apricots and nuts",
  "slot": "snack",
  "ingredients": [
   {
    "key": "dried_apricot",
    "grams": 30
   },
   {
    "key": "walnut",
    "grams": 15
   },
   {
    "key": "hazelnut",
    "grams": 10
   }
  ]
 },
 {
  "key": "hurma_topu",
  "nameTr": "Hurmalı yulaf topları",
  "nameEn": "Date and oat bites",
  "slot": "snack",
  "ingredients": [
   {
    "key": "dates",
    "grams": 40
   },
   {
    "key": "oats",
    "grams": 15
   },
   {
    "key": "almond",
    "grams": 10
   },
   {
    "key": "cinnamon",
    "grams": 1
   }
  ]
 },
 {
  "key": "muzlu_sut",
  "nameTr": "Muzlu yulaflı süt",
  "nameEn": "Banana oat milk shake",
  "slot": "snack",
  "ingredients": [
   {
    "key": "milk",
    "grams": 250
   },
   {
    "key": "banana",
    "grams": 80
   },
   {
    "key": "oats",
    "grams": 15
   },
   {
    "key": "cinnamon",
    "grams": 1
   }
  ]
 },
 {
  "key": "kavrulmus_nohut",
  "nameTr": "Baharatlı kavrulmuş nohut",
  "nameEn": "Spiced roasted chickpeas",
  "slot": "snack",
  "ingredients": [
   {
    "key": "chickpea",
    "grams": 80
   },
   {
    "key": "olive_oil",
    "grams": 3
   },
   {
    "key": "paprika",
    "grams": 1
   },
   {
    "key": "cumin",
    "grams": 1
   }
  ]
 }
];
