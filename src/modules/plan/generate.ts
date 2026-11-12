// G33-S1 md.7 — Plan oluşturma: DETERMİNİSTİK şablon algoritması. SAF (RN yok).
//
// Fresh  = bu algoritmanın sonucu doğrudan (maliyetsiz; "Yenile" = variant + 1, sınırsız).
// Balance = aynı algoritma `candidatePlans` ile 3 aday üretir; `meal-plan-generate` edge
//           fonksiyonu YALNIZ adayları sıralar + kısa açıklama yazar. Makro/kalori LLM'den ALINMAZ.
//
// Kurallar:
//  • Günlük kcal ve protein hedefin ±%5'i içinde (`withinTolerance`); porsiyon çarpanı 0,05 adımla
//    0,5–2,0 arası, günün serbest yuvalarına ORTAK uygulanır (tarif gramajı oransal ölçeklenir).
//  • Diyet + alerjen filtresi (alerjen içeren tarif plana GİRMEZ). eatkcal ürünlerinin alerjen/diyet
//    verisi yok → alerjen ya da diyet filtresi seçiliyse eatkcal önerilmez (güvenli taraf).
//  • "eatkcal öğünleri dahil et" (yalnız İzmir): seçili günlerin 1., 3., 5.'sinde öğle eatkcal (≤ 3).
//  • "Planladığım öğünleri koru": dolu yuvalar sabit, yalnız boşlar doldurulur.
//  • Hafta içinde tekrar cezalı (çeşitlilik); eşitlikte sıralama sabit → aynı girdi = aynı plan.
import type { AllergenKey, DietKey, EatkcalOption, PlanItem, RecipeInfo, Slot } from './types';
import { SLOTS } from './types';
import { fitsDiet, freeOf, scaleMacros } from './nutrition';

export const TOLERANCE = 0.05;
export const PORTION_MIN = 0.5;
export const PORTION_MAX = 2;
export const PORTION_STEP = 0.05;
const CANDIDATES_PER_SLOT = 5;
const MAX_EATKCAL_PER_WEEK = 3;

export interface GenerateInput {
  recipes: readonly RecipeInfo[];
  days: readonly string[];
  target: { kcal: number; protein: number };
  diet: DietKey;
  avoid: readonly AllergenKey[];
  /** null → eatkcal dahil edilmez (kapalı ya da İzmir dışı). */
  eatkcal: readonly EatkcalOption[] | null;
  /** Var olan plan satırları ("Planladığım öğünleri koru" açıkken sabit). */
  keep: readonly PlanItem[];
  keepPlanned: boolean;
  /** Yeniden oluştur sayacı (aynı variant = aynı plan). */
  variant: number;
  lang?: 'tr' | 'en';
}

export interface DaySummary {
  date: string;
  kcal: number;
  protein: number;
  withinTolerance: boolean;
}

export interface GenerateResult {
  items: PlanItem[];
  days: DaySummary[];
  eatkcalDays: string[];
  /** Alerjen filtresiyle elenen tarif sayısı (Koç açıklaması "Fıstık içeren tarifler çıkarıldı"). */
  excludedByAllergen: number;
}

/** 32-bit FNV-1a — deterministik döndürme. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function quantizePortion(p: number): number {
  const q = Math.round(p / PORTION_STEP) * PORTION_STEP;
  return Math.round(Math.min(PORTION_MAX, Math.max(PORTION_MIN, q)) * 100) / 100;
}

export function within(value: number, target: number, tol = TOLERANCE): boolean {
  if (target <= 0) return true;
  return Math.abs(value - target) / target <= tol + 1e-9;
}

function eatkcalAllowed(diet: DietKey, avoid: readonly AllergenKey[]): boolean {
  return avoid.length === 0 && (diet === 'all' || diet === 'high_protein' || diet === 'low_carb');
}

function eatkcalFitsMacroDiet(o: EatkcalOption, diet: DietKey): boolean {
  if (diet === 'high_protein') return o.kcal > 0 && (o.protein * 4) / o.kcal >= 0.3;
  if (diet === 'low_carb') return o.kcal > 0 && (o.carbs * 4) / o.kcal <= 0.26;
  return true;
}

let idSeq = 0;
/** Yerel satır kimliği (sunucuya yazılırken uuid'e çevrilir; testte sabit önek). */
export function localId(prefix = 'gen'): string {
  idSeq = (idSeq + 1) % 1e9;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}`;
}

export function recipeItem(r: RecipeInfo, date: string, slot: Slot, portion: number, lang: 'tr' | 'en' = 'tr', id?: string): PlanItem {
  const m = scaleMacros(r.macros, portion);
  return {
    id: id ?? localId(),
    date,
    slot,
    source: 'recipe',
    refId: r.key,
    name: lang === 'en' ? r.nameEn : r.nameTr,
    portion,
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    loggedId: null,
    price: null,
  };
}

export function eatkcalItem(o: EatkcalOption, date: string, slot: Slot, id?: string): PlanItem {
  return {
    id: id ?? localId(),
    date,
    slot,
    source: 'eatkcal',
    refId: o.id,
    name: o.name,
    portion: 1,
    kcal: Math.round(o.kcal),
    protein: Math.round(o.protein * 10) / 10,
    carbs: Math.round(o.carbs * 10) / 10,
    fat: Math.round(o.fat * 10) / 10,
    loggedId: null,
    price: o.price,
  };
}

/** Filtrelenmiş tarif havuzu (yuva başına, anahtar sırasıyla sabit). */
export function filterPool(recipes: readonly RecipeInfo[], diet: DietKey, avoid: readonly AllergenKey[]) {
  const pool: Record<Slot, RecipeInfo[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  let excludedByAllergen = 0;
  for (const r of [...recipes].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    if (!fitsDiet(r, diet)) continue;
    if (!freeOf(r, avoid)) {
      excludedByAllergen++;
      continue;
    }
    pool[r.slot].push(r);
  }
  return { pool, excludedByAllergen };
}

export function generatePlan(input: GenerateInput): GenerateResult {
  const lang = input.lang ?? 'tr';
  const { pool, excludedByAllergen } = filterPool(input.recipes, input.diet, input.avoid);
  const days = [...input.days].sort();
  const used = new Map<string, number>();
  const items: PlanItem[] = [];
  const summaries: DaySummary[] = [];
  const eatkcalDays: string[] = [];

  const eatkcalPool =
    input.eatkcal && eatkcalAllowed(input.diet, input.avoid)
      ? [...input.eatkcal].filter((o) => o.kcal > 0 && eatkcalFitsMacroDiet(o, input.diet)).sort((a, b) => (a.id < b.id ? -1 : 1))
      : [];

  days.forEach((date, di) => {
    const fixed = new Map<Slot, PlanItem>();
    if (input.keepPlanned) for (const it of input.keep) if (it.date === date) fixed.set(it.slot, it);

    // eatkcal öğle (seçili günlerin 1., 3., 5.'si; en çok 3).
    if (eatkcalPool.length && !fixed.has('lunch') && di % 2 === 0 && eatkcalDays.length < MAX_EATKCAL_PER_WEEK) {
      const o = eatkcalPool[(hash(`e:${input.variant}`) + eatkcalDays.length) % eatkcalPool.length];
      if (o.kcal < input.target.kcal * 0.6) {
        fixed.set('lunch', eatkcalItem(o, date, 'lunch'));
        eatkcalDays.push(date);
      }
    }

    const free = SLOTS.filter((s) => !fixed.has(s));
    const cands: RecipeInfo[][] = free.map((slot) => {
      const list = pool[slot];
      if (!list.length) return [];
      const start = hash(`${input.variant}:${di}:${slot}`) % list.length;
      const rotated = list.map((_, k) => list[(start + k) % list.length]);
      // Az kullanılan önce (çeşitlilik); eşitlikte döndürme sırası.
      const ranked = rotated.map((r, k) => ({ r, k, u: used.get(r.key) ?? 0 })).sort((a, b) => a.u - b.u || a.k - b.k);
      return ranked.slice(0, CANDIDATES_PER_SLOT).map((x) => x.r);
    });

    const fixedK = [...fixed.values()].reduce((s, it) => s + it.kcal, 0);
    const fixedP = [...fixed.values()].reduce((s, it) => s + it.protein, 0);
    const activeIdx = free.map((_, i) => i).filter((i) => cands[i].length > 0);

    let best: { combo: RecipeInfo[]; portion: number; score: number } | null = null;
    const combo: RecipeInfo[] = [];
    const walk = (depth: number) => {
      if (depth === activeIdx.length) {
        const baseK = combo.reduce((s, r) => s + r.macros.kcal, 0);
        const baseP = combo.reduce((s, r) => s + r.macros.protein, 0);
        const portion = baseK > 0 ? quantizePortion((input.target.kcal - fixedK) / baseK) : 1;
        const k = fixedK + baseK * portion;
        const p = fixedP + baseP * portion;
        const repeats = combo.reduce((s, r) => s + (used.get(r.key) ?? 0), 0);
        const score =
          Math.abs(k - input.target.kcal) / Math.max(1, input.target.kcal) +
          (input.target.protein > 0 ? Math.abs(p - input.target.protein) / input.target.protein : 0) +
          0.15 * repeats +
          0.02 * Math.abs(portion - 1);
        if (!best || score < best.score - 1e-12) best = { combo: combo.slice(), portion, score };
        return;
      }
      for (const r of cands[activeIdx[depth]]) {
        combo.push(r);
        walk(depth + 1);
        combo.pop();
      }
    };
    walk(0);

    const dayItems: PlanItem[] = [];
    for (const slot of SLOTS) {
      const f = fixed.get(slot);
      if (f) {
        dayItems.push(f);
        continue;
      }
      const ai = activeIdx.findIndex((i) => free[i] === slot);
      const b = best as { combo: RecipeInfo[]; portion: number } | null;
      if (ai < 0 || !b) continue;
      const r = b.combo[ai];
      used.set(r.key, (used.get(r.key) ?? 0) + 1);
      dayItems.push(recipeItem(r, date, slot, b.portion, lang));
    }
    items.push(...dayItems);
    const kcal = dayItems.reduce((s, it) => s + it.kcal, 0);
    const protein = Math.round(dayItems.reduce((s, it) => s + it.protein, 0));
    summaries.push({ date, kcal, protein, withinTolerance: within(kcal, input.target.kcal) && within(protein, input.target.protein) });
  });

  return { items, days: summaries, eatkcalDays, excludedByAllergen };
}

/** Balance: Koç'a sunulacak N aday (variant, variant+1, …). */
export function candidatePlans(input: GenerateInput, n = 3): GenerateResult[] {
  return Array.from({ length: n }, (_, i) => generatePlan({ ...input, variant: input.variant + i }));
}

/** Plan özeti (edge fonksiyonuna gider — makro HESAPLANMIŞ, model değiştiremez). */
export function summarizeForCoach(r: GenerateResult) {
  const byDate = new Map<string, string[]>();
  for (const it of r.items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), `${it.slot}:${it.name}`]);
  return {
    days: r.days.map((d) => ({ date: d.date, kcal: d.kcal, protein: d.protein, meals: byDate.get(d.date) ?? [] })),
    eatkcal_days: r.eatkcalDays,
  };
}
