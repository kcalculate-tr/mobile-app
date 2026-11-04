// "Takibe başla" saf eşleme + hesaplama (G12-S1 · FinTb*). RN/zustand İÇERMEZ,
// böylece `npm run test:unit` (tsx --test, Node) doğrudan koşar. Günlük hedef
// MEVCUT beslenme profili servisiyle (`lib/nutrition`) hesaplanır — yeni formül
// YOK (yalnız panel niyetlerini servisin tiplerine eşler).

import {
  type ActivityLevel,
  type Gender,
  type Goal,
  type MacroTargets,
  type NutritionProfileInput,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '../../../lib/nutrition';

/** Panel hedefleri (FinTbGoal). "Daha düzenli beslen" = koru (maintain). */
export type TbGoal = 'lose' | 'maintain' | 'gain' | 'regular';
/** Cinsiyet "yalnız hesaplama için" — belirtmeyen hesapta female formülüyle sürer. */
export type TbGender = 'female' | 'male' | 'unspecified';

export const PACE_OPTIONS = [0.25, 0.5, 0.75, 1] as const;
export type Pace = (typeof PACE_OPTIONS)[number];

export interface TbDraftValues {
  goal: TbGoal | null;
  pace: Pace;
  gender: TbGender | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  consent: boolean;
  activity: ActivityLevel | null;
}

/** Tempo yalnızca Kilo ver / Kas yap için sorulur (FinTbPace). */
export function goalNeedsPace(goal: TbGoal | null): boolean {
  return goal === 'lose' || goal === 'gain';
}

export function toServiceGoal(goal: TbGoal): Goal {
  if (goal === 'lose') return 'lose_weight';
  if (goal === 'gain') return 'gain_weight';
  return 'maintain'; // maintain + regular
}

export function toServiceGender(gender: TbGender): Gender {
  // "Belirtmek istemiyorum" → hesaplama için female formülü (daha korumacı taban).
  return gender === 'male' ? 'male' : 'female';
}

export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

export function isUnderage(birthYear: number | null, currentYear: number): boolean {
  if (!birthYear) return false;
  return ageFromBirthYear(birthYear, currentYear) < 18;
}

/**
 * Taslaktan servis girdisi üret. Zorunlu alanlardan biri eksik/geçersizse null.
 * `currentYear` dışarıdan verilir (saf fonksiyon; Date'e bağlı değil).
 */
export function buildProfileInput(
  d: TbDraftValues,
  currentYear: number,
): NutritionProfileInput | null {
  if (!d.goal || !d.gender || !d.birthYear || !d.heightCm || !d.weightKg || !d.activity) {
    return null;
  }
  const age = ageFromBirthYear(d.birthYear, currentYear);
  if (age <= 0 || age > 120 || d.heightCm <= 0 || d.weightKg <= 0) return null;
  return {
    age,
    gender: toServiceGender(d.gender),
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    activity: d.activity,
    goal: toServiceGoal(d.goal),
  };
}

export interface TbResult {
  input: NutritionProfileInput;
  bmr: number;
  tdee: number;
  macros: MacroTargets;
}

export function computeResult(d: TbDraftValues, currentYear: number): TbResult | null {
  const input = buildProfileInput(d, currentYear);
  if (!input) return null;
  return {
    input,
    bmr: Math.round(calculateBMR(input)),
    tdee: Math.round(calculateTDEE(input)),
    macros: calculateMacroTargets(input),
  };
}

/**
 * Seçilen tempoda (kg/hafta) ilk 1 kg kilometre taşına kalan GÜN sayısı.
 * Hedef kilosu girişi panellerde yok → kesin hedef tarihi S4/İLTER'E bağlar;
 * burada tempo hissini vermek için ilk-kilo kilometre taşı gösterilir.
 */
export function daysToFirstKg(pace: Pace): number {
  return Math.round((1 / pace) * 7);
}
