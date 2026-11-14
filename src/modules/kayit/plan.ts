// G42-S1 md.4 — Kayıt cevapları → MEVCUT kişisel plan motoru (G34 computePlan). Yeni formül YOK:
//  · kilo vermek / korumak / sağlıklı beslenmek / kilo almak → computePlan (goal lose/maintain/balanced/gain)
//  · kas kazanmak → computePlan(maintain) TDEE'si + app_settings `kayit_muscle_surplus_kcal` (250, tahmini);
//    makrolar aynı motorun computeMacros'u; hedef varsa süre aynı paceForDelta ile.
// Saf (RN yok) → tsx --test.
import { dislikeTerms } from './foods';
import {
  addDays,
  calorieFloor,
  computeMacros,
  computePlan,
  paceForDelta,
  round10,
  type PpCalcInput,
  type PpGoal,
  type PpResult,
} from '../personalPlan/calc';
import { emptyAnswers, PP_DISLIKES, type PpAnswers, type PpDislike, type PpSaved, type Weekday } from '../personalPlan/types';
import { K_COOKING, K_CUISINES, K_DIETS, K_GOALS, K_SPORTS, K_STRUGGLES, emptyKAnswers, mealsSplit, paceAsked, targetAsked, type KAnswers, type KGoal, type KStart } from './model';

export const MUSCLE_SURPLUS_DEFAULT = 250;
/** Tahmini tarih ARALIĞI bandı: motorun hafta sayısının %90'ı – %125'i (söz değil, aralık). */
export const RANGE_LOW = 0.9;
export const RANGE_HIGH = 1.25;

export function toPpGoal(g: KGoal): PpGoal {
  if (g === 'muscle') return 'maintain';
  return g;
}

export function calcInputOf(a: KAnswers): PpCalcInput | null {
  if (!a.goal || !a.gender || !a.birthYear || !a.heightCm || !a.weightKg || !a.activity) return null;
  return {
    goal: toPpGoal(a.goal),
    gender: a.gender,
    birthYear: a.birthYear,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    activity: a.activity,
    targetWeightKg: a.goal === 'muscle' ? null : a.targetWeightKg,
    pace: a.pace,
  };
}

export interface MealShare {
  slot: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'snack2';
  pct: number;
  kcal: number;
}

export interface KPlan {
  result: PpResult;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Tahmini tarih aralığı (YYYY-MM-DD); hedef yoksa null. */
  rangeFrom: string | null;
  rangeTo: string | null;
  meals: MealShare[];
  muscle: boolean;
}

const SHARES: Record<number, Array<[MealShare['slot'], number]>> = {
  2: [['lunch', 45], ['dinner', 55]],
  3: [['breakfast', 30], ['lunch', 35], ['dinner', 35]],
  4: [['breakfast', 25], ['lunch', 35], ['snack', 10], ['dinner', 30]],
  5: [['breakfast', 25], ['lunch', 30], ['snack', 10], ['dinner', 25], ['snack2', 10]],
};

/** Öğün dağılımı (kalori × pay, 10'a yuvarlı; son öğün farkı alır → toplam = kalori). */
export function mealDistribution(calories: number, count: number): MealShare[] {
  const rows = SHARES[Math.min(5, Math.max(2, count))];
  const out = rows.map(([slot, pct]) => ({ slot, pct, kcal: round10((calories * pct) / 100) }));
  const sum = out.reduce((s, r) => s + r.kcal, 0);
  out[out.length - 1].kcal += calories - sum;
  return out;
}

export function computeKayitPlan(
  a: KAnswers,
  o: { currentYear: number; startIso: string; muscleSurplus?: number },
): KPlan | null {
  const input = calcInputOf(a);
  if (!input) return null;
  const base = computePlan(input, o.currentYear, o.startIso);
  if (!base) return null;
  let result = base;
  const muscle = a.goal === 'muscle';
  if (muscle) {
    const surplus = Math.max(0, Math.round(o.muscleSurplus ?? MUSCLE_SURPLUS_DEFAULT));
    const calories = Math.max(calorieFloor(input.gender), round10(base.steps.tdee + surplus));
    const pace = paceForDelta(surplus);
    const hasTarget = a.targetWeightKg != null && !a.targetSkipped && a.targetWeightKg > input.weightKg && pace > 0;
    const weeks = hasTarget ? Math.ceil((a.targetWeightKg! - input.weightKg) / pace - 1e-9) : null;
    const targetDate = weeks != null ? addDays(o.startIso, weeks * 7) : null;
    result = {
      ...base,
      steps: { ...base.steps, requestedDelta: -surplus, rawCalories: base.steps.tdee + surplus, floored: false },
      calories,
      macros: computeMacros(calories, input.weightKg),
      effectivePace: hasTarget ? pace : 0,
      requestedPace: hasTarget ? pace : 0,
      weeks,
      requestedWeeks: weeks,
      targetDate,
      requestedTargetDate: targetDate,
      dateShifted: false,
      unreachable: false,
    };
  }
  const weeks = result.weeks;
  return {
    result,
    calories: result.calories,
    protein: result.macros.protein,
    carbs: result.macros.carbs,
    fat: result.macros.fat,
    rangeFrom: weeks != null ? addDays(o.startIso, Math.max(1, Math.round(weeks * RANGE_LOW)) * 7) : null,
    rangeTo: weeks != null ? addDays(o.startIso, Math.max(1, Math.round(weeks * RANGE_HIGH)) * 7) : null,
    meals: mealDistribution(result.calories, a.meals),
    muscle,
  };
}

/** Plan girdisini etkileyen cevapların imzası (L2'den geri → cevap değişti mi → yeniden hesap). */
export function planSignature(a: KAnswers): string {
  return JSON.stringify([a.goal, a.gender, a.birthYear, a.heightCm, a.weightKg, a.targetWeightKg, a.targetSkipped, a.pace, a.activity, a.meals, a.diet, a.dislikes]);
}

/** Kayıt cevapları → G34 PpSaved (savePlan / Kişisel planım aynı şemayı okur). */
export function toPpSaved(a: KAnswers, plan: KPlan, o: { startIso: string; nowIso: string; start: KStart | null }): PpSaved & { kayit: Record<string, unknown> } {
  const base = emptyAnswers();
  const split = mealsSplit(a.meals);
  const dislikes = a.dislikes.filter((d): d is PpDislike => (PP_DISLIKES as readonly string[]).includes(d));
  const answers: PpAnswers = {
    ...base,
    goal: a.goal ? toPpGoal(a.goal) : null,
    gender: a.gender,
    birthYear: a.birthYear,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    units: a.units,
    targetWeightKg: a.targetSkipped ? null : a.targetWeightKg,
    pace: a.pace,
    activity: a.activity,
    exercise: [],
    exerciseDays: a.noSport ? 0 : a.sportDays.length,
    exerciseWeekdays: (a.noSport ? [] : a.sportDays) as Weekday[],
    diet: a.diet ?? 'all',
    dislikes,
    meals: { ...base.meals, main: split.main, snack: split.snack },
  };
  const { consentHealth: _h, consentAllergy: _a, ...rest } = answers;
  void _h;
  void _a;
  return {
    v: 1,
    answers: rest,
    result: plan.result,
    custom: null,
    startedAt: o.startIso,
    startWeightKg: a.weightKg ?? 0,
    targetDate: plan.result.targetDate,
    updatedAt: o.nowIso,
    // Kayıt akışına özgü cevaplar (G34 şemasında karşılığı olmayanlar) — jsonb'de ayrı anahtar.
    kayit: {
      v: 1,
      goal: a.goal,
      sports: a.noSport ? [] : a.sports,
      noSport: a.noSport,
      // G54 md.4a: standart anahtarlar + `custom:<metin>` (plan/öneri/Koç dışlama listesi).
      dislikes: a.dislikes,
      eatsAll: a.eatsAll,
      // G54 md.4b: sevilen mutfaklar (öneri / Koç tercihi).
      cuisines: a.cuisines,
      meals: a.meals,
      cooking: a.cooking,
      struggle: a.struggle,
      start: o.start,
    },
  };
}

// ─── L2 tarifleri (Keşfet/G33 tarif kataloğundan uygun 3 tarif) ───────────────
export interface RecipeLike {
  key: string;
  nameTr: string;
  nameEn: string;
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  macros: { kcal: number };
  diets: string[];
  ingredients: { key: string }[];
}

/** Tarif yemediklerini içeriyor mu (G54: standart anahtar parçaları + serbest metin — foods.dislikeTerms). */
export function recipeAvoids(r: Pick<RecipeLike, 'ingredients'>, dislikes: readonly string[]): boolean {
  const parts = dislikeTerms(dislikes);
  return r.ingredients.some((i) => parts.some((p) => i.key.toLowerCase().includes(p)));
}

/** Kahvaltı · öğle · akşam için öğün payına en yakın, diyete uyan, yemediklerini içermeyen 3 tarif. */
export function pickRecipes<R extends RecipeLike>(recipes: readonly R[], a: Pick<KAnswers, 'diet' | 'dislikes'>, plan: Pick<KPlan, 'meals' | 'calories'>): R[] {
  const diet = a.diet ?? 'all';
  const pool = recipes.filter((r) => (diet === 'all' || r.diets.includes(diet)) && !recipeAvoids(r, a.dislikes));
  const out: R[] = [];
  for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
    const target = plan.meals.find((m) => m.slot === slot)?.kcal ?? plan.calories / 3;
    const best = pool
      .filter((r) => r.slot === slot && !out.includes(r))
      .sort((x, y) => Math.abs(x.macros.kcal - target) - Math.abs(y.macros.kcal - target))[0];
    if (best) out.push(best);
  }
  return out;
}

// ─── B yolu kısa profil → MEVCUT takip kapısı (Takibe başla kaydı) ────────────
export interface TakibeDraftLike {
  goal: 'lose' | 'maintain' | 'gain' | 'regular' | null;
  pace: 0.25 | 0.5 | 0.75;
  gender: 'female' | 'male' | 'unspecified' | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  consent: boolean;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | null;
}

/** Kısa profil (B-P1/P2/P3/P4/P5/P8) → saveTakibeProfile taslağı (yeni formül yok; servis hesaplar). */
export function toTakibeDraft(a: KAnswers, consent: boolean): TakibeDraftLike {
  const goal = a.goal === 'muscle' ? 'gain' : a.goal === 'balanced' ? 'regular' : a.goal;
  return { goal, pace: 0.5, gender: a.gender, birthYear: a.birthYear, heightCm: a.heightCm, weightKg: a.weightKg, consent, activity: a.activity };
}

// ─── G54-S1 md.5: kayıt sonrası düzenleme (tek sayfa özet) ────────────────────
/** Saf: kayıtlı plan (G34 PpSaved + `kayit` anahtarı) → kayıt cevapları (düzenleme taslağı). Eksik alan null kalır. */
export function fromPpSaved(p: PpSaved): KAnswers {
  const k = (p.kayit ?? {}) as Record<string, unknown>;
  const a = p.answers;
  const base = emptyKAnswers(a.units === 'imperial' ? 'imperial' : 'metric');
  const kGoal = typeof k.goal === 'string' && (K_GOALS as readonly string[]).includes(k.goal) ? (k.goal as KGoal) : a.goal;
  const arr = <T,>(v: unknown, ok: readonly T[]): T[] => (Array.isArray(v) ? (v.filter((x) => ok.includes(x as T)) as T[]) : []);
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    ...base,
    goal: kGoal ?? null,
    gender: a.gender,
    birthYear: a.birthYear,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    targetWeightKg: a.targetWeightKg,
    targetSkipped: kGoal === 'muscle' && a.targetWeightKg == null,
    pace: a.pace,
    activity: a.activity,
    sportDays: (a.exerciseWeekdays ?? []).filter((d) => d >= 0 && d <= 6) as KAnswers['sportDays'],
    noSport: k.noSport === true,
    sports: arr(k.sports, K_SPORTS),
    diet: (K_DIETS as readonly string[]).includes(a.diet) ? (a.diet as KAnswers['diet']) : null,
    cuisines: arr(k.cuisines, K_CUISINES),
    dislikes: strs(k.dislikes).length ? strs(k.dislikes) : [...(a.dislikes ?? [])],
    eatsAll: k.eatsAll === true,
    meals: typeof k.meals === 'number' ? k.meals : a.meals.main + a.meals.snack,
    cooking: typeof k.cooking === 'string' && (K_COOKING as readonly string[]).includes(k.cooking) ? (k.cooking as KAnswers['cooking']) : null,
    struggle: typeof k.struggle === 'string' && (K_STRUGGLES as readonly string[]).includes(k.struggle) ? (k.struggle as KAnswers['struggle']) : null,
  };
}

export type EditRowKey = 'goal' | 'gender' | 'birth' | 'height' | 'weight' | 'target' | 'pace' | 'activity' | 'sport' | 'diet' | 'cuisines' | 'dislikes' | 'meals' | 'cooking' | 'struggle';
export const EDIT_GROUPS: readonly { key: 'goal' | 'body' | 'move' | 'food'; rows: readonly EditRowKey[] }[] = [
  { key: 'goal', rows: ['goal', 'target', 'pace'] },
  { key: 'body', rows: ['gender', 'birth', 'height', 'weight'] },
  { key: 'move', rows: ['activity', 'sport'] },
  { key: 'food', rows: ['diet', 'cuisines', 'dislikes', 'meals', 'cooking', 'struggle'] },
];

/** Saf: özetteki görünür satırlar (hedef kilo / tempo yalnız kayıttaki aynı koşulla). */
export function visibleEditRows(a: Pick<KAnswers, 'goal'>): EditRowKey[] {
  return EDIT_GROUPS.flatMap((g) => g.rows).filter((r) => (r === 'target' ? targetAsked(a.goal) : r === 'pace' ? paceAsked(a.goal) : true));
}

/** Saf: kaydetmeden önce/sonra günlük hedefler (yuvarlanmış). */
export function editDiff(before: { calories: number; protein: number; carbs: number; fat: number }, after: KPlan): { from: number; to: number; changed: boolean; macros: { protein: number; carbs: number; fat: number } } {
  return { from: Math.round(before.calories), to: Math.round(after.calories), changed: Math.round(before.calories) !== Math.round(after.calories), macros: { protein: after.protein, carbs: after.carbs, fat: after.fat } };
}

/** Saf: taslak kayıtlı cevaplardan farklı mı (kaydedilmemiş değişiklik uyarısı). */
export function answersDirty(a: KAnswers, b: KAnswers): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
