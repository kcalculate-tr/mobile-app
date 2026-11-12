// G34-S1 · Tur 26o — Kişisel plan veri şeması (istemci). Sunucuda
// `user_nutrition_profiles.personal_plan` (jsonb) + tipli kolonlar (migration 20261112… g34).
// Saf tipler + doğrulayıcılar (RN yok → tsx --test).
import type { PpActivity, PpGender, PpGoal, PpPace, PpResult } from './calc';
import { ALLERGENS, DIETS, type AllergenKey, type DietKey } from '../plan/types';

export type PpExercise = 'walk' | 'run' | 'fitness' | 'pilates' | 'swim' | 'bike' | 'team' | 'none';
export const PP_EXERCISES: readonly PpExercise[] = ['walk', 'run', 'fitness', 'pilates', 'swim', 'bike', 'team', 'none'];
export const PP_EXERCISE_MINUTES = [15, 30, 45, 60, 90] as const;
/** Hafta günleri 0 = Pazartesi … 6 = Pazar. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** TEK diyet sözlüğü (G33 öğün planı formu ile ortak: src/modules/plan/types). */
export type PpDiet = DietKey;
export const PP_DIETS: readonly PpDiet[] = DIETS;
/** Sevmediğin yiyecekler (tasarım çipleri). */
export type PpDislike = 'fish' | 'mushroom' | 'eggplant' | 'broccoli' | 'dairy' | 'egg' | 'red_meat' | 'legumes' | 'onion' | 'spicy';
export const PP_DISLIKES: readonly PpDislike[] = ['fish', 'mushroom', 'eggplant', 'broccoli', 'dairy', 'egg', 'red_meat', 'legumes', 'onion', 'spicy'];
/** TEK alerjen sözlüğü (G33 öğün planı formu ile ortak: src/modules/plan/types). */
export type PpAllergen = AllergenKey;
export const PP_ALLERGENS: readonly PpAllergen[] = ALLERGENS;

export type PpFasting = 'off' | '14:10' | '16:8';
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'snack2';

export interface PpMeals {
  main: number; // 2–4
  snack: number; // 0–3
  /** Öğün saatleri "HH:MM" (yuva → saat). */
  times: Partial<Record<MealSlot, string>>;
  fasting: PpFasting;
  /** "Bazı öğünlerim eatkcal'dan gelsin" — yalnız İzmir'de görünür; varsayılan kapalı. */
  eatkcal: boolean;
}

export interface PpMeasures {
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  bodyFatPct?: number | null;
}

export interface PpReminders {
  meals: Partial<Record<MealSlot, boolean>>;
  weighIn: boolean;
  weighDay: Weekday;
  weighTime: string; // "HH:MM"
  /** İzin penceresi sonucu (akış izin reddedilse de tamamlanır). */
  permission?: 'granted' | 'denied' | 'skipped';
}

/** Akış cevapları (taslak + kayıt). */
export interface PpAnswers {
  consentHealth: boolean;
  consentAllergy: boolean;
  goal: PpGoal | null;
  gender: PpGender | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  units: 'metric' | 'imperial';
  targetWeightKg: number | null;
  pace: PpPace;
  activity: PpActivity | null;
  steps: number | null;
  exercise: PpExercise[];
  exerciseDays: number;
  exerciseMinutes: number;
  exerciseWeekdays: Weekday[];
  measures: PpMeasures;
  measuresSkipped: boolean;
  diet: PpDiet;
  dislikes: PpDislike[];
  allergens: PpAllergen[];
  meals: PpMeals;
  reminders: PpReminders;
}

/** Kaydedilen plan (personal_plan jsonb). */
export interface PpSaved {
  v: 1;
  answers: Omit<PpAnswers, 'consentHealth' | 'consentAllergy'>;
  result: PpResult;
  /** Kullanıcı "Düzenle" ile öneriden saptıysa son değerler (yoksa null = öneri). */
  custom: { calories: number; protein: number; fat: number; carbs: number } | null;
  startedAt: string; // YYYY-MM-DD
  startWeightKg: number;
  /** Son check-in'de kendiliğinden güncellenen hedef tarihi. */
  targetDate: string | null;
  updatedAt: string;
}

export const DEFAULT_MEALS: PpMeals = {
  main: 3,
  snack: 1,
  times: { breakfast: '08:00', lunch: '13:00', snack: '16:00', dinner: '19:30' },
  fasting: 'off',
  eatkcal: false,
};

export const DEFAULT_REMINDERS: PpReminders = {
  meals: { breakfast: true, lunch: true, snack: true, dinner: true },
  weighIn: true,
  weighDay: 3, // Perşembe
  weighTime: '08:00',
};

export function emptyAnswers(): PpAnswers {
  return {
    consentHealth: false,
    consentAllergy: false,
    goal: null,
    gender: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    units: 'metric',
    targetWeightKg: null,
    pace: 0.5,
    activity: null,
    steps: 6000,
    exercise: [],
    exerciseDays: 3,
    exerciseMinutes: 45,
    exerciseWeekdays: [0, 2, 4],
    measures: {},
    measuresSkipped: false,
    diet: 'all',
    dislikes: [],
    allergens: [],
    meals: { ...DEFAULT_MEALS, times: { ...DEFAULT_MEALS.times } },
    reminders: { ...DEFAULT_REMINDERS, meals: { ...DEFAULT_REMINDERS.meals } },
  };
}

/** Öğün düzenine göre yuvalar (ana 2–4, ara 0–3). */
export function mealSlots(main: number, snack: number): MealSlot[] {
  const out: MealSlot[] = [];
  if (main >= 3) out.push('breakfast');
  out.push('lunch');
  if (snack >= 1) out.push('snack');
  out.push('dinner');
  if (snack >= 2 || main >= 4) out.push('snack2');
  return out;
}

const DEFAULT_TIME: Record<MealSlot, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  snack: '16:00',
  dinner: '19:30',
  snack2: '21:30',
};

export function defaultTime(slot: MealSlot): string {
  return DEFAULT_TIME[slot];
}

export function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  let t = ((h || 0) * 60 + (m || 0) + minutes) % 1440;
  if (t < 0) t += 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Bozuk / eski jsonb'yi güvenle oku (eksik alanlar varsayılanla). */
export function parseSaved(raw: unknown): PpSaved | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<PpSaved>;
  if (o.v !== 1 || !o.answers || !o.result || typeof o.result.calories !== 'number') return null;
  const base = emptyAnswers();
  return {
    v: 1,
    answers: { ...base, ...o.answers, meals: { ...base.meals, ...(o.answers.meals ?? {}) }, reminders: { ...base.reminders, ...(o.answers.reminders ?? {}) } },
    result: o.result,
    custom: o.custom ?? null,
    startedAt: typeof o.startedAt === 'string' ? o.startedAt : '',
    startWeightKg: typeof o.startWeightKg === 'number' ? o.startWeightKg : (o.answers.weightKg ?? 0),
    targetDate: o.targetDate ?? o.result.targetDate ?? null,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
  };
}

/** Planın geçerli hedefleri (Düzenle ile sapıldıysa custom, değilse öneri). */
export function effectiveTargets(p: PpSaved): { calories: number; protein: number; fat: number; carbs: number } {
  if (p.custom) return p.custom;
  return { calories: p.result.calories, protein: p.result.macros.protein, fat: p.result.macros.fat, carbs: p.result.macros.carbs };
}
